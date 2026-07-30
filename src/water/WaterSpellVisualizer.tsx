import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type {
  WakeCommand,
  WaterCommand,
  WaterCommandBus,
} from '../game/WaterCommandBus'
import type { WaterSampler } from './types'

interface WaterSpellVisualizerProps {
  readonly commandBus: WaterCommandBus
  readonly water: WaterSampler
}

type VisibleSpellCommand = Exclude<WaterCommand, { readonly kind: 'wake' }>

interface ActiveEffect {
  readonly command: VisibleSpellCommand
  readonly startedAt: number
}

interface ActiveWake {
  readonly command: WakeCommand
  readonly startedAt: number
}

const MAX_EFFECTS = 40
const MAX_WAKE_SEGMENTS = 72
const WAKE_LIFETIME = 5.5
const EFFECT_LIFETIME = {
  swell: 3.8,
  current: 2.2,
  vortex: 4.2,
} as const

export function WaterSpellVisualizer({
  commandBus,
  water,
}: WaterSpellVisualizerProps) {
  const swellRef = useRef<THREE.InstancedMesh>(null)
  const currentRef = useRef<THREE.InstancedMesh>(null)
  const vortexRef = useRef<THREE.InstancedMesh>(null)
  const wakeLeftRef = useRef<THREE.InstancedMesh>(null)
  const wakeRightRef = useRef<THREE.InstancedMesh>(null)
  const lastSequence = useRef(0)
  const effects = useRef<ActiveEffect[]>([])
  const wakes = useRef<ActiveWake[]>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const commands = commandBus.readAfter(lastSequence.current)
    if (commands.length > 0) {
      lastSequence.current = commands[commands.length - 1].sequence
      effects.current.push(
        ...commands
          .filter(
            (command): command is VisibleSpellCommand =>
              command.kind !== 'wake',
          )
          .map((command) => ({ command, startedAt: now })),
      )
      wakes.current.push(
        ...commands
          .filter(
            (command): command is WakeCommand => command.kind === 'wake',
          )
          .map((command) => ({ command, startedAt: now })),
      )
      if (effects.current.length > MAX_EFFECTS * 3) {
        effects.current.splice(0, effects.current.length - MAX_EFFECTS * 3)
      }
      if (wakes.current.length > MAX_WAKE_SEGMENTS) {
        wakes.current.splice(
          0,
          wakes.current.length - MAX_WAKE_SEGMENTS,
        )
      }
    }

    effects.current = effects.current.filter(
      ({ command, startedAt }) =>
        now - startedAt < EFFECT_LIFETIME[command.kind],
    )
    wakes.current = wakes.current.filter(
      ({ startedAt }) => now - startedAt < WAKE_LIFETIME,
    )

    updateInstances('swell', swellRef.current, now)
    updateInstances('current', currentRef.current, now)
    updateInstances('vortex', vortexRef.current, now)
    updateWakeInstances(wakeLeftRef.current, wakeRightRef.current, now)
  })

  function updateInstances(
    kind: VisibleSpellCommand['kind'],
    mesh: THREE.InstancedMesh | null,
    now: number,
  ): void {
    if (mesh === null) return

    let instance = 0
    for (const effect of effects.current) {
      if (effect.command.kind !== kind || instance >= MAX_EFFECTS) continue

      const { command } = effect
      const age = now - effect.startedAt
      const life = EFFECT_LIFETIME[kind]
      const remainingScale = THREE.MathUtils.clamp((life - age) * 2.5, 0, 1)
      const travel =
        kind === 'swell' ? age * (2.4 + command.strength * 2.8) : 0
      const x = command.position.x + command.direction.x * travel
      const z = command.position.z + command.direction.z * travel
      const surface = water.sample(x, z, now)

      dummy.position.set(x, surface.height + 0.09, z)
      dummy.rotation.set(0, 0, 0)

      if (kind === 'current') {
        dummy.rotation.y = Math.atan2(
          command.direction.x,
          command.direction.z,
        )
        dummy.scale.set(
          remainingScale * (0.8 + command.strength),
          remainingScale,
          remainingScale * Math.max(1, command.radius * 0.82),
        )
      } else {
        const pulse =
          kind === 'swell'
            ? command.radius * (0.58 + age * 0.16)
            : command.radius * (0.72 + Math.sin(age * 5) * 0.035)
        dummy.rotation.x = -Math.PI / 2
        dummy.scale.setScalar(pulse * remainingScale)
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(instance, dummy.matrix)
      instance += 1
    }

    mesh.count = instance
    mesh.instanceMatrix.needsUpdate = true
  }

  function updateWakeInstances(
    leftMesh: THREE.InstancedMesh | null,
    rightMesh: THREE.InstancedMesh | null,
    now: number,
  ): void {
    if (leftMesh === null || rightMesh === null) return

    let instance = 0
    for (const wake of wakes.current) {
      if (instance >= MAX_WAKE_SEGMENTS) break

      const { command, startedAt } = wake
      const age = now - startedAt
      const fade = THREE.MathUtils.clamp(
        (WAKE_LIFETIME - age) * 1.5,
        0,
        1,
      )
      const directionLength = Math.max(
        0.001,
        Math.hypot(command.direction.x, command.direction.z),
      )
      const forwardX = command.direction.x / directionLength
      const forwardZ = command.direction.z / directionLength
      const rightX = forwardZ
      const rightZ = -forwardX
      const railOffset = command.radius * 0.45
      const segmentLength = 0.9 + command.strength * 1.5
      const segmentWidth = 0.09 + command.strength * 0.08
      const rotation = Math.atan2(forwardX, forwardZ)

      for (const [side, mesh] of [
        [-1, leftMesh],
        [1, rightMesh],
      ] as const) {
        const x = command.position.x + rightX * railOffset * side
        const z = command.position.z + rightZ * railOffset * side
        const surface = water.sample(x, z, now)
        dummy.position.set(x, surface.height + 0.075, z)
        dummy.rotation.set(0, rotation, 0)
        dummy.scale.set(segmentWidth * fade, 1, segmentLength)
        dummy.updateMatrix()
        mesh.setMatrixAt(instance, dummy.matrix)
      }

      instance += 1
    }

    leftMesh.count = instance
    rightMesh.count = instance
    leftMesh.instanceMatrix.needsUpdate = true
    rightMesh.instanceMatrix.needsUpdate = true
  }

  return (
    <>
      <instancedMesh
        ref={swellRef}
        args={[undefined, undefined, MAX_EFFECTS]}
        frustumCulled={false}
        renderOrder={30}
      >
        <ringGeometry args={[0.86, 1, 48]} />
        <meshBasicMaterial
          color="#73e6ff"
          transparent
          opacity={0.72}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={currentRef}
        args={[undefined, undefined, MAX_EFFECTS]}
        frustumCulled={false}
        renderOrder={30}
      >
        <boxGeometry args={[0.22, 0.025, 1]} />
        <meshBasicMaterial
          color="#58ffc8"
          transparent
          opacity={0.58}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={vortexRef}
        args={[undefined, undefined, MAX_EFFECTS]}
        frustumCulled={false}
        renderOrder={30}
      >
        <ringGeometry args={[0.66, 1, 64]} />
        <meshBasicMaterial
          color="#c48cff"
          transparent
          opacity={0.76}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      {[wakeLeftRef, wakeRightRef].map((ref, index) => (
        <instancedMesh
          key={index}
          ref={ref}
          args={[undefined, undefined, MAX_WAKE_SEGMENTS]}
          frustumCulled={false}
          renderOrder={28}
        >
          <boxGeometry args={[1, 0.018, 1]} />
          <meshBasicMaterial
            color="#d9ffff"
            transparent
            opacity={0.68}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      ))}
    </>
  )
}
