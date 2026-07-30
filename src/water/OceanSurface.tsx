import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { WaterCommandBus } from '../game/WaterCommandBus'
import type { CoarseWaterField } from './CoarseWaterField'
import {
  createFarOceanMaterial,
  createOceanMaterial,
} from './OceanMaterial'
import {
  createFarOceanGeometry,
  DEFAULT_FAR_OCEAN_SIZE,
} from './FarOceanGeometry'
import { WaterSimulation } from './WaterSimulation'
import {
  DEFAULT_WATER_RENDER_QUALITY,
  WATER_RENDER_QUALITY_SETTINGS,
  type WaterRenderQuality,
} from './waterRenderQuality'

interface OceanSurfaceProps {
  readonly commandBus: WaterCommandBus
  readonly farOceanSize?: number
  readonly gameplayField: CoarseWaterField
  readonly quality?: WaterRenderQuality
}
export function OceanSurface({
  commandBus,
  farOceanSize = DEFAULT_FAR_OCEAN_SIZE,
  gameplayField,
  quality = DEFAULT_WATER_RENDER_QUALITY,
}: OceanSurfaceProps) {
  const { gl } = useThree()
  const renderQuality = WATER_RENDER_QUALITY_SETTINGS[quality]
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
  const farMaterial = useMemo(() => createFarOceanMaterial(), [])
  const farGeometry = useMemo(
    () =>
      createFarOceanGeometry(
        gameplayField.worldSize,
        farOceanSize,
        renderQuality.farVertexSpacing,
      ),
    [
      farOceanSize,
      gameplayField.worldSize,
      renderQuality.farVertexSpacing,
    ],
  )
  const lastCommandSequence = useRef(0)

  useEffect(() => {
    return () => {
      farGeometry.dispose()
      farMaterial.dispose()
      material.dispose()
      simulation.dispose()
    }
  }, [farGeometry, farMaterial, material, simulation])

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
    farMaterial.uniforms.uTime.value = clock.elapsedTime
  }, -10)

  return (
    <>
      <mesh
        name="far-ocean-skirt"
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={farGeometry}
        material={farMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      <mesh
        name="simulated-near-ocean"
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
        frustumCulled={false}
      >
        <planeGeometry
          args={[
            gameplayField.worldSize,
            gameplayField.worldSize,
            renderQuality.nearSegments,
            renderQuality.nearSegments,
          ]}
        />
      </mesh>
    </>
  )
}
