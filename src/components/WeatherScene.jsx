import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Stars, Sparkles } from '@react-three/drei'
import * as THREE from 'three'


function WeatherParticles({ weatherType }) {
  if (weatherType === 'rain' || weatherType === 'drizzle') {
    return <Sparkles count={400} scale={15} size={3} speed={0.9} opacity={0.5} color="#90cdf4" />
  }
  if (weatherType === 'snow') {
    return <Sparkles count={400} scale={15} size={5} speed={0.3} opacity={0.8} color="#ffffff" />
  }
  if (weatherType === 'clear') {
    return (
      <group>
        <Sparkles count={80} scale={15} size={6} speed={0.1} opacity={0.3} color="#fef08a" />
        <Stars radius={10} depth={20} count={300} factor={4} saturation={1} fade speed={1} />
      </group>
    )
  }
  if (weatherType === 'thunderstorm') {
    return <Sparkles count={300} scale={15} size={4} speed={1.5} opacity={0.7} color="#c084fc" />
  }
  return <Sparkles count={150} scale={15} size={2.5} speed={0.4} opacity={0.2} color="#cbd5e1" />
}

function PremiumEarth() {
  const groupRef = useRef()
  const atmosphereRef = useRef()
  const [texture, setTexture] = useState(null)

  // Robust manual loading to guarantee the app doesn't crash if the texture network request is blocked
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (tex) => setTexture(tex),
      undefined,
      (err) => {
        console.error("Network issue loading texture, using fallback holographic globe.", err)
        setTexture('failed') // Fallback state
      }
    )
  }, [])

  useFrame((state, delta) => {
    // Continuous rotation behind the dashboard
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04
      groupRef.current.rotation.x = 0.2 // Slight tilt
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y -= delta * 0.02
    }
  })

  // 1. Fallback Holographic Globe (If user network blocks GitHub/Unpkg)
  if (texture === 'failed') {
    return (
      <group position={[0, -2, -3]} scale={3.5} ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#0044ff" wireframe={true} transparent opacity={0.4} />
        </mesh>
        <mesh ref={atmosphereRef}>
          <sphereGeometry args={[1.05, 32, 32]} />
          <meshPhysicalMaterial 
            color="#38bdf8" 
            transparent={true} 
            opacity={0.1} 
            roughness={0} 
            clearcoat={1} 
            transmission={0.9} 
          />
        </mesh>
      </group>
    )
  }

  // 2. Loading State Placeholder
  if (!texture) return null

  // 3. Ultra-Premium Textured Earth Globe
  return (
    <group position={[0, -2, -3]} scale={3.6} ref={groupRef}>
      {/* Textured Terrain */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial 
          map={texture} 
          roughness={0.6} 
          metalness={0.1} 
          color="#a0c4ff" // Slight blue tint for dark mode integration
        />
      </mesh>
      
      {/* Glasstic Premium Atmosphere Shell */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.025, 64, 64]} />
        <meshPhysicalMaterial 
          color="#38bdf8" 
          transparent={true} 
          opacity={0.2} 
          roughness={0.1} 
          clearcoat={1} 
          transmission={0.6} 
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Outer Halo Glow */}
      <mesh>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshBasicMaterial 
          color="#38bdf8" 
          transparent={true} 
          opacity={0.06} 
          blending={THREE.AdditiveBlending} 
          side={THREE.BackSide} 
        />
      </mesh>
    </group>
  )
}

export default function WeatherScene({ weatherType }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always" 
      camera={{ position: [0, 0, 8], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.4} />
      
      <directionalLight position={[10, 5, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-10, -5, -5]} intensity={0.8} color="#38bdf8" />
      
      <PremiumEarth />
      <WeatherParticles weatherType={weatherType} />
      
      <Environment preset="city" />
      <ContactShadows position={[0, -5, 0]} opacity={0.5} scale={20} blur={3} far={8} color="#000000" />
    </Canvas>
  )
}
