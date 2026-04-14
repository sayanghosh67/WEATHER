import { Suspense, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useTexture, Stars, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

/* ─── Constants ──────────────────────────────────────── */
const EARTH_RADIUS   = 3.5
const EARTH_SEGMENTS = 56
const AUTO_SPEED     = 0.04   // rad/s — slow, steady rotation

/* ─── Helpers ────────────────────────────────────────── */

/**
 * Lat/lon in degrees → 3D position on sphere surface.
 *
 * Three.js SphereGeometry builds vertices as:
 *   x = -cos(phi) * sin(theta)   ← negative cos!
 *   y =  cos(theta)
 *   z =  sin(phi) * sin(theta)
 * where phi = (lon+180)*PI/180 and theta = (90-lat)*PI/180.
 */
function latLonToVec3(lat, lon, r) {
  const phi   = (lon + 180) * (Math.PI / 180)
  const theta = (90  - lat) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),   // MUST be negative
     r * Math.cos(theta),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

/**
 * Target Earth Y rotation so the given longitude faces the camera.
 *
 * Derivation: after Y-rotation α, z' of any point = sin(theta)*sin(phi+α).
 * Maximum z' (camera-facing) when phi+α = π/2 → α = π/2 - phi.
 * So: targetY = π/2 - (lon+180)*π/180 = -lon*π/180 - π/2
 */
function lonToFaceY(lon) {
  return -lon * (Math.PI / 180) - Math.PI / 2
}

/** Shortest-path normalise to [-PI, PI] */
function shortestArc(diff) {
  return diff - Math.floor((diff + Math.PI) / (Math.PI * 2)) * Math.PI * 2
}

/* ─── City Marker ────────────────────────────────────── */
function CityMarker({ cityCoords }) {
  const dotRef  = useRef()
  const ringRef = useRef()

  const pos = useMemo(
    () => cityCoords
      ? latLonToVec3(cityCoords.lat, cityCoords.lon, EARTH_RADIUS + 0.06)
      : null,
    [cityCoords],
  )

  useFrame(({ clock }) => {
    if (!cityCoords) return
    const t = clock.elapsedTime
    if (dotRef.current)  dotRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.38)
    if (ringRef.current) {
      const p = (t * 0.8) % 1
      ringRef.current.scale.setScalar(1 + p * 3)
      ringRef.current.material.opacity = (1 - p) * 0.75
    }
  })

  if (!cityCoords || !pos) return null

  return (
    <group position={pos}>
      {/* Glowing dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshBasicMaterial color="#00e5ff" />
      </mesh>

      {/* Expanding ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.14, 32]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Point light at city */}
      <pointLight color="#00e5ff" intensity={4} distance={2} decay={2} />
    </group>
  )
}

/* ─── Earth Globe (Suspense-loaded) ──────────────────── */
function EarthGlobe({ cityCoords, weatherType, mouse, isSearching }) {
  const groupRef = useRef()   // mouse parallax
  const earthRef = useRef()  // rotation target

  const [dayTex, bumpTex] = useTexture([
    'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png',
  ])

  /* Configure textures once */
  useMemo(() => {
    [dayTex, bumpTex].forEach((t) => {
      t.colorSpace   = THREE.SRGBColorSpace
      t.minFilter    = THREE.LinearMipmapLinearFilter
      t.generateMipmaps = true
    })
  }, [dayTex, bumpTex])

  /* Animation state (all refs — zero re-renders) */
  const rotY    = useRef(0)      // current accumulated Y rotation
  const targetY = useRef(null)   // desired Y to face searched city
  const phase   = useRef('idle') // 'idle' | 'focusing' | 'focused'
  const timer   = useRef(0)

  /* Trigger Google-Earth style animation on city change */
  useEffect(() => {
    if (!cityCoords) return
    targetY.current = lonToFaceY(cityCoords.lon)
    phase.current   = 'focusing'
    timer.current   = 0
  }, [cityCoords])

  useFrame((state, delta) => {
    if (!earthRef.current || !groupRef.current) return

    /* Subtle mouse parallax on the group */
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x, mouse.x * 0.4, 0.015,
    )
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y, mouse.y * -0.25, 0.015,
    )

    /* Camera FOV zoom: narrow on search, restore after */
    const fovTarget = isSearching ? 26 : 35
    if (Math.abs(state.camera.fov - fovTarget) > 0.05) {
      state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, fovTarget, delta * 1.8)
      state.camera.updateProjectionMatrix()
    }

    /* ── State machine ──────────────────────────────── */
    timer.current += delta

    if (phase.current === 'idle') {
      rotY.current += delta * AUTO_SPEED
      earthRef.current.rotation.y = rotY.current

    } else if (phase.current === 'focusing') {
      /* Cinematic rotation to searched city */
      const diff = shortestArc(targetY.current - rotY.current)
      /* Ease: fast start, slow finish (quadratic) */
      const t    = Math.min(timer.current / 2.5, 1)  // 0..1 over 2.5 s
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      rotY.current += diff * Math.min(delta * (3.5 * (1 - ease * 0.6)), 0.18)
      earthRef.current.rotation.y = rotY.current

      if (Math.abs(diff) < 0.008 || timer.current > 4) {
        phase.current = 'focused'
        timer.current = 0
      }

    } else if (phase.current === 'focused') {
      /* Very slow drift — city stays centered */
      rotY.current += delta * AUTO_SPEED * 0.12
      earthRef.current.rotation.y = rotY.current
      if (timer.current > 6) phase.current = 'idle'
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={earthRef}>
        {/* ── Earth sphere ── */}
        <mesh castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[EARTH_RADIUS, EARTH_SEGMENTS, EARTH_SEGMENTS]} />
          <meshPhongMaterial
            map={dayTex}
            bumpMap={bumpTex}
            bumpScale={0.05}
            specular={new THREE.Color(0x080c18)}
            shininess={5}
          />
        </mesh>

        {/* Inner atmospheric skin */}
        <mesh castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[EARTH_RADIUS * 1.016, 32, 32]} />
          <meshLambertMaterial
            color="#1040cc"
            transparent
            opacity={0.06}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>

        {/* City marker — child of Earth so it rotates with it */}
        <CityMarker cityCoords={cityCoords} />
      </group>

      {/* Outer halo — static, doesn't rotate with Earth */}
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[EARTH_RADIUS * 1.055, 32, 32]} />
        <meshLambertMaterial
          color="#0055ff"
          transparent
          opacity={0.032}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ─── Weather Particle Layer ─────────────────────────── */
function WeatherEffects({ weatherType }) {
  const isRain = ['rain', 'drizzle', 'thunderstorm'].includes(weatherType)
  return (
    <group>
      {isRain && (
        <Sparkles count={75} scale={18} size={1.3} speed={0.28} opacity={0.18} color="#60afff" />
      )}
      {weatherType === 'snow' && (
        <Sparkles count={110} scale={18} size={3}   speed={0.10} opacity={0.50} color="#ddeeff" />
      )}
      {weatherType === 'clear' && (
        <Stars radius={60} depth={50} count={80} factor={3} saturation={0.15} fade speed={0.22} />
      )}
      {/* Always-on faint blue field */}
      <Sparkles count={12} scale={22} size={0.7} speed={0.05} opacity={0.06} color="#00bfff" />
    </group>
  )
}

/* ─── Scene Root ─────────────────────────────────────── */
export default function WeatherScene({ weatherType, mouse, cityCoords, isSearching }) {
  const themeGlow = {
    clear: '#a8dcff', clouds: '#7aa8d4', rain: '#00bfff',
    drizzle: '#38bdf8', thunderstorm: '#818cf8', snow: '#cce8ff', default: '#00bfff',
  }
  const glow = themeGlow[weatherType] ?? themeGlow.default

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ position: [0, 0, 10], fov: 35 }}
      gl={{
        antialias:           true,
        alpha:               true,
        powerPreference:     'high-performance',
        toneMapping:         THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.85,
      }}
    >
      <ambientLight intensity={0.35} color="#030c22" />
      <directionalLight position={[8, 5, 5]} intensity={1.8} color="#ddeeff" />
      <pointLight position={[-9, 6, 4]}  intensity={2.0} color={glow} />
      <pointLight position={[ 6, -6, -6]} intensity={0.7} color="#001230" />

      {/* Earth — wrapped in Suspense for texture loading */}
      <Suspense fallback={null}>
        <EarthGlobe
          cityCoords={cityCoords}
          weatherType={weatherType}
          mouse={mouse}
          isSearching={isSearching}
        />
      </Suspense>

      <WeatherEffects weatherType={weatherType} />
    </Canvas>
  )
}
