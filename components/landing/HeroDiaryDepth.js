import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getMoonAlbedoCanvas } from '../../lib/moonTexture'

function Moon({ scrollOffset = 0 }) {
  const meshRef = useRef(null)
  const { size } = useThree()
  const [texture, setTexture] = useState(null)

  useEffect(() => {
    const canvas = getMoonAlbedoCanvas(Math.max(120, Math.min(220, size.width * 0.22)))
    if (!canvas) return
    const t = new THREE.CanvasTexture(canvas)
    t.anisotropy = 4
    t.needsUpdate = true
    setTexture(t)
    return () => t.dispose()
  }, [size.width])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f5f3ef'),
        roughness: 0.95,
        metalness: 0,
      }),
    []
  )

  useEffect(() => {
    if (!texture) return
    material.map = texture
    material.needsUpdate = true
  }, [texture, material])

  useFrame((state) => {
    if (!meshRef.current) return
    const { x, y } = state.pointer
    meshRef.current.rotation.y = x * 0.2 + scrollOffset * 0.15
    meshRef.current.rotation.x = -y * 0.14
    meshRef.current.position.y = 0.25 + scrollOffset * 0.12
    meshRef.current.position.x = 0.7 + scrollOffset * 0.08
  })

  return (
    <mesh ref={meshRef} position={[0.7, 0.25, 0]} material={material}>
      <sphereGeometry args={[0.62, 48, 48]} />
    </mesh>
  )
}

function Dust({ scrollOffset = 0 }) {
  const pointsRef = useRef(null)
  const positions = useMemo(() => {
    const count = 72
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 6
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4
      arr[i * 3 + 2] = Math.random() * -2.5
    }
    return arr
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.z = state.clock.elapsedTime * 0.018 + scrollOffset * 0.05
    pointsRef.current.position.y = scrollOffset * -0.15
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.032}
        color="#e8e4dc"
        transparent
        opacity={0.38}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function Scene({ scrollProgress = 0 }) {
  const scrollOffset = scrollProgress * 1.2
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2, 2, 3]} intensity={0.5} color="#f0ebe4" />
      <pointLight position={[1.2, 0.6, 1.8]} intensity={0.55} color="#e8a860" />
      <pointLight position={[-1.5, 0.2, 1]} intensity={0.25} color="#8a9ac8" />
      <Dust scrollOffset={scrollOffset} />
      <Moon scrollOffset={scrollOffset} />
    </>
  )
}

export default function HeroDiaryDepth({ scrollProgress = 0 }) {
  return (
    <div className="hero-diary-depth" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  )
}
