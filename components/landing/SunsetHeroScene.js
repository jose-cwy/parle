import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMemo, useRef } from 'react'

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** 3D sun only — sits over the photo sun and sinks on scroll. */
function SunScene({ progress = 0 }) {
  const sunGroupRef = useRef(null)
  const coreRef = useRef(null)
  const glowRef = useRef(null)

  const coreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f4a04a'),
        emissive: new THREE.Color('#ff8c2a'),
        emissiveIntensity: 0.85,
        roughness: 0.55,
        metalness: 0.05,
      }),
    []
  )

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff9a3c'),
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  )

  useFrame((state) => {
    const p = clamp01(progress)
    const ease = p * p * (3 - 2 * p)

    if (sunGroupRef.current) {
      sunGroupRef.current.position.x = (state.pointer.x || 0) * 0.04
      sunGroupRef.current.position.y = lerp(0.06, -0.52, ease) + (state.pointer.y || 0) * 0.02
    }

    if (coreRef.current) {
      const s = lerp(1, 0.88, ease)
      coreRef.current.scale.setScalar(s)
      coreRef.current.rotation.y += 0.002
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(lerp(1.35, 1.1, ease))
      glowRef.current.material.opacity = lerp(0.45, 0.18, ease)
    }
  })

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0.2, 1.5]} intensity={1.2} color="#ffb35a" distance={4} />
      <group ref={sunGroupRef} position={[0, 0.06, 0]}>
        <mesh ref={glowRef} material={glowMat} position={[0, 0, -0.05]}>
          <sphereGeometry args={[0.38, 48, 48]} />
        </mesh>
        <mesh ref={coreRef} material={coreMat}>
          <sphereGeometry args={[0.26, 64, 64]} />
        </mesh>
      </group>
    </>
  )
}

export default function SunsetHeroScene({ progress = 0 }) {
  return (
    <div className="sunsetHeroScene sunsetHeroScene--overlay" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <SunScene progress={progress} />
      </Canvas>
    </div>
  )
}
