import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, MeshTransmissionMaterial, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'

const themeColors = {
  clear: { color: '#ffffff', glow: '#ffda47' },
  clouds: { color: '#ffffff', glow: '#a8c0ff' },
  rain: { color: '#ffffff', glow: '#3b82f6' },
  drizzle: { color: '#ffffff', glow: '#60a5fa' },
  thunderstorm: { color: '#ffffff', glow: '#8b5cf6' },
  snow: { color: '#ffffff', glow: '#e2e8f0' },
  default: { color: '#ffffff', glow: '#38bdf8' },
}

function WeatherEffects({ weatherType }) {
  const isRain = weatherType === 'rain' || weatherType === 'drizzle' || weatherType === 'thunderstorm'
  
  return (
    <group>
      {isRain && (
        <Sparkles 
          count={120} 
          scale={15} 
          size={2} 
          speed={0.4} 
          opacity={0.3} 
          color="#93c5fd" 
        />
      )}
      {weatherType === 'snow' && (
        <Sparkles 
          count={150} 
          scale={15} 
          size={4} 
          speed={0.15} 
          opacity={0.6} 
          color="#ffffff" 
        />
      )}
      {weatherType === 'clear' && (
        <Stars 
          radius={50} 
          depth={50} 
          count={100} 
          factor={4} 
          saturation={0} 
          fade 
          speed={0.5} 
        />
      )}
    </group>
  )
}

function CinematicObject({ weatherType, mouse }) {
  const meshRef = useRef()
  const config = useMemo(() => ({
    backside: true,
    samples: 8,
    resolution: 512,
    transmission: 0.95,
    roughness: 0.05,
    thickness: 1.5,
    ior: 1.2,
    chromaticAberration: 0.04,
    anisotropy: 0.1,
    distortion: 0.05,
    distortionScale: 0.2,
    temporalDistortion: 0.1,
    clearcoat: 1,
    attenuationDistance: 1.5,
    attenuationColor: '#ffffff',
    color: themeColors[weatherType]?.color || themeColors.default.color,
  }), [weatherType])

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Intentional, slow premium rotation
      meshRef.current.rotation.y += delta * 0.15
      meshRef.current.rotation.z += delta * 0.1
      
      // Subtly track mouse with high smoothing
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, mouse.x * 0.8, 0.02)
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, mouse.y * -0.5, 0.02)
    }
  })

  return (
    <Float speed={1.2} rotationIntensity={0.5} floatIntensity={1.5}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <MeshTransmissionMaterial {...config} />
      </mesh>
    </Float>
  )
}

export default function WeatherScene({ weatherType, mouse }) {
  const glowColor = themeColors[weatherType]?.glow || themeColors.default.glow

  return (
    <Canvas
      dpr={[1, 1.5]}
      // Performance optimized: demand mode for battery efficiency
      frameloop="always" 
      camera={{ position: [0, 0, 10], fov: 35 }}
      gl={{ 
        antialias: true, 
        alpha: true, 
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping
      }}
    >
      <ambientLight intensity={0.5} />
      
      {/* Cinematic Rim Lighting */}
      <spotLight 
        position={[10, 10, 10]} 
        angle={0.15} 
        penumbra={1} 
        intensity={2} 
        castShadow 
        color={glowColor}
      />
      <pointLight position={[-10, -10, -10]} intensity={1.5} color={glowColor} />
      
      <CinematicObject weatherType={weatherType} mouse={mouse} />
      <WeatherEffects weatherType={weatherType} />
      
      <Environment preset="studio" />
    </Canvas>
  )
}
