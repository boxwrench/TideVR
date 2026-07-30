import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { WaterCommandBus } from '../game/WaterCommandBus'
import type { CoarseWaterField } from './CoarseWaterField'
import { createOceanMaterial } from './OceanMaterial'
import { WaterSimulation } from './WaterSimulation'

interface OceanSurfaceProps {
  readonly commandBus: WaterCommandBus
  readonly gameplayField: CoarseWaterField
}
export function OceanSurface({
  commandBus,
  gameplayField,
}: OceanSurfaceProps) {
  const { gl } = useThree()
  const simulation = useMemo(
    () =>
      new WaterSimulation({
        resolution: 512,
        worldSize: gameplayField.worldSize,
        updateRate: 30,
      }),
    [gameplayField.worldSize],
  )
  const material = useMemo(
    () =>
      createOceanMaterial(
        simulation.texture,
        simulation.resolution,
        simulation.worldSize,
      ),
    [simulation],
  )
  const lastCommandSequence = useRef(0)

  useEffect(() => {
    return () => {
      material.dispose()
      simulation.dispose()
    }
  }, [material, simulation])

  useFrame(({ clock }, deltaTime) => {
    const commands = commandBus.readAfter(lastCommandSequence.current)
    if (commands.length > 0) {
      lastCommandSequence.current = commands[commands.length - 1].sequence
      gameplayField.enqueue(commands)
    }

    gameplayField.update(deltaTime)
    simulation.update(gl, deltaTime, commands)
    material.uniforms.uDynamicWater.value = simulation.texture
    material.uniforms.uTime.value = clock.elapsedTime

    if (gl.xr.isPresenting) gl.xr.setFoveation(0.5)
  }, -10)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      frustumCulled={false}
    >
      <planeGeometry
        args={[
          gameplayField.worldSize,
          gameplayField.worldSize,
          192,
          192,
        ]}
      />
    </mesh>
  )
}
