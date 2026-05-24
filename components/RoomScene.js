import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { motion, useTransform } from 'framer-motion'
import * as THREE from 'three'

/* ─── Atmospheric particles — warm orbs drifting in the dark ── */
const ORBS = [
  { pos: [-2.2,  0.8, 2.5], color: '#ffaa50', size: 0.06, speed: 0.6, delay: 0   },
  { pos: [ 2.5, -0.4, 3.0], color: '#ff9030', size: 0.05, speed: 0.9, delay: 0.8 },
  { pos: [-0.8,  1.4, 2.0], color: '#4a8a82', size: 0.04, speed: 0.7, delay: 1.4 },
  { pos: [ 1.2,  0.2, 3.5], color: '#ffcc70', size: 0.07, speed: 0.5, delay: 0.3 },
  { pos: [-1.8, -0.6, 2.8], color: '#ffaa50', size: 0.04, speed: 1.1, delay: 2.0 },
  { pos: [ 0.4,  1.8, 2.2], color: '#ff8820', size: 0.05, speed: 0.8, delay: 1.1 },
  { pos: [ 3.0,  0.8, 4.0], color: '#4a8a82', size: 0.06, speed: 0.6, delay: 0.6 },
  { pos: [-3.2,  0.2, 3.2], color: '#ffcc70', size: 0.04, speed: 0.9, delay: 1.8 },
]

function Orb({ position, color, size, speed, delay }) {
  const meshRef = useRef()
  const clock = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    clock.current += delta * speed
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(clock.current + delay) * 0.18
      meshRef.current.position.x = position[0] + Math.cos(clock.current * 0.6 + delay) * 0.08
      const pulse = 0.7 + Math.sin(clock.current * 1.4 + delay) * 0.3
      meshRef.current.material.opacity = pulse * 0.6
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} />
    </mesh>
  )
}

/* ─── Camera dolly + atmosphere scene ──────────────────────── */
function AtmosphereScene({ scrollProgress }) {
  const { camera } = useThree()
  const warmLightRef = useRef()
  const coolLightRef = useRef()

  useFrame(() => {
    const p = scrollProgress.get()

    // Smooth camera dolly forward: z=6 (far) → z=1.5 (close)
    const targetZ = 6 - p * 4.5
    camera.position.z += (targetZ - camera.position.z) * 0.07

    // Slight Y shift — camera tilts slightly up as you enter
    const targetY = -p * 0.15
    camera.position.y += (targetY - camera.position.y) * 0.07

    // Warm light intensifies as we scroll in (approaching the lamp)
    if (warmLightRef.current) {
      warmLightRef.current.intensity = 0.4 + p * 2.8
    }
    if (coolLightRef.current) {
      coolLightRef.current.intensity = 0.6 - p * 0.3
    }
  })

  return (
    <>
      {/* Cinematic fog — dark at distance, clears as we enter */}
      <fog attach="fog" args={['#0d0a08', 2, 12]} />

      {/* Warm lamp light — center of room, intensifies on scroll */}
      <pointLight
        ref={warmLightRef}
        position={[0.8, 1.5, 0]}
        color="#ffaa50"
        intensity={0.4}
        distance={12}
        decay={2}
      />

      {/* Cool moonlight — from the right (window side) */}
      <pointLight
        ref={coolLightRef}
        position={[4, 2, -1]}
        color="#8090d8"
        intensity={0.6}
        distance={10}
        decay={2}
      />

      {/* Ambient fill — very subtle so the darks stay dark */}
      <ambientLight intensity={0.12} color="#2a1a10" />

      {/* Atmospheric floating orbs */}
      {ORBS.map((orb, i) => (
        <Orb key={i} position={orb.pos} color={orb.color} size={orb.size} speed={orb.speed} delay={orb.delay} />
      ))}

      {/*
       * ─────────────────────────────────────────────────────────────
       * GLTF MODEL DROP-IN
       * When room-model.glb is ready:
       *   1. Add import { useGLTF } from '@react-three/drei'
       *   2. Uncomment: const { scene } = useGLTF('/room-model.glb')
       *   3. Add: <primitive object={scene} scale={1} position={[0, -1, 0]} />
       *   4. Remove the placeholder background image in the parent component
       *   5. Set Canvas gl.alpha to false and add a background color
       * ─────────────────────────────────────────────────────────────
       */}
    </>
  )
}

/* ─── Main exported component ───────────────────────────────── */
export default function RoomScene({ scrollProgress }) {
  const [mounted, setMounted] = useState(false)

  // Only render on client (Three.js is not SSR-compatible)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Scroll-driven zoom — GIF scales up as camera moves in
  const gifScale = useTransform(scrollProgress, [0, 1], [1.0, 1.42])
  const gifY = useTransform(scrollProgress, [0, 1], ['0%', '-7%'])

  // Fog overlay deepens at start, clears as we enter
  const fogOpacity = useTransform(scrollProgress, [0, 0.15, 0.5], [0.6, 0.25, 0.0])

  // Vignette — edge darkening stays constant
  if (!mounted) return null

  return (
    <div
      className="room-canvas-wrapper"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0d0a08' }}
    >
      {/* ── Animated room background (GIF scales on scroll) ── */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-6%',
          scale: gifScale,
          y: gifY,
          willChange: 'transform',
        }}
      >
        <img
          src="/images/ref2.gif"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          draggable={false}
        />
      </motion.div>

      {/* ── Cinematic vignette — dark oval frame ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 75% at 50% 55%, transparent 35%, rgba(8,5,3,0.55) 70%, rgba(5,3,2,0.88) 100%)
          `,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Entry fog — fades out as you scroll in ── */}
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(13,10,8,0.3) 0%, rgba(8,5,3,0.85) 100%)',
          opacity: fogOpacity,
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* ── Three.js atmospheric canvas — transparent overlay ── */}
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 55 }}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      >
        <AtmosphereScene scrollProgress={scrollProgress} />
      </Canvas>

      {/* ── Film grain overlay ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.09,
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.9) 0.4px, transparent 0.4px),
            radial-gradient(rgba(200,150,80,0.3) 0.3px, transparent 0.3px)
          `,
          backgroundSize: '5px 5px, 9px 9px',
          backgroundPosition: '0 0, 2px 3px',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  )
}
