import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { WaterSampler } from '../water/types'

interface BuoyProps {
  readonly position: readonly [number, number]
  readonly color: string
  readonly water: WaterSampler
}
function Buoy({ position, color, water }: BuoyProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current === null) return
    const sample = water.sample(position[0], position[1], clock.elapsedTime)
    groupRef.current.position.y = sample.height + 0.85
    groupRef.current.rotation.z =
      Math.atan2(-sample.normal.x, sample.normal.y) * 0.45
    groupRef.current.rotation.x =
      Math.atan2(sample.normal.z, sample.normal.y) * 0.45
  })

  return (
    <group ref={groupRef} position={[position[0], 0.85, position[1]]}>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.42, 0.58, 1.55, 12]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.19, 12, 8]} />
        <meshStandardMaterial
          color="#eafcff"
          emissive={color}
          emissiveIntensity={1.6}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <ringGeometry args={[0.55, 0.82, 24]} />
        <meshBasicMaterial
          color="#eafcff"
          transparent
          opacity={0.46}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

const GATES = [
  { center: [-10, -25], width: 9, color: '#6df4ff' },
  { center: [8, -5], width: 10, color: '#69ffc5' },
  { center: [-14, 17], width: 8, color: '#c38cff' },
  { center: [12, 38], width: 10, color: '#ffc86b' },
] as const

interface BuoyCourseProps {
  readonly water: WaterSampler
}

export function BuoyCourse({ water }: BuoyCourseProps) {
  return (
    <>
      {GATES.flatMap((gate, index) => {
        const halfWidth = gate.width * 0.5
        return [
          <Buoy
            key={`${index}-left`}
            position={[gate.center[0] - halfWidth, gate.center[1]]}
            color={gate.color}
            water={water}
          />,
          <Buoy
            key={`${index}-right`}
            position={[gate.center[0] + halfWidth, gate.center[1]]}
            color={gate.color}
            water={water}
          />,
        ]
      })}

      <group position={[0, 0, 62]}>
        <mesh position={[0, 5.5, 0]}>
          <cylinderGeometry args={[0.35, 0.7, 11, 10]} />
          <meshStandardMaterial color="#132e3f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 11.3, 0]}>
          <sphereGeometry args={[0.65, 16, 10]} />
          <meshStandardMaterial
            color="#fff3bd"
            emissive="#74e8ff"
            emissiveIntensity={4}
          />
          <pointLight color="#8cecff" intensity={8} distance={32} />
        </mesh>
      </group>

      <group position={[-58, 1.1, 48]} rotation={[0, 0.35, 0]}>
        <mesh>
          <boxGeometry args={[12, 1.2, 2.2]} />
          <meshStandardMaterial color="#102735" roughness={0.85} />
        </mesh>
        <mesh position={[1, 1.1, 0]}>
          <boxGeometry args={[3.5, 1.2, 1.7]} />
          <meshStandardMaterial color="#102735" roughness={0.85} />
        </mesh>
      </group>
    </>
  )
}
