import type { SwellCommand } from '../game/WaterCommandBus'
import type { WaterSampler } from './types'

const CUE_SAMPLE_INTERVALS = 12
const CUE_SEARCH_BEYOND_RADIUS = 12
const MIN_FORWARD_FLOW = 0.04

export interface SwellCue {
  readonly x: number
  readonly z: number
  readonly height: number
  readonly distance: number
  readonly confidence: number
}

/**
 * Finds the strongest forward-moving part of a Swell in the gameplay water
 * field. The visual cue therefore follows simulated water instead of advancing
 * from elapsed time independently of the solver.
 */
export function findSwellCue(
  command: SwellCommand,
  water: WaterSampler,
  time: number,
): SwellCue | null {
  const directionLength = Math.hypot(command.direction.x, command.direction.z)
  if (directionLength < 0.00001) return null

  const directionX = command.direction.x / directionLength
  const directionZ = command.direction.z / directionLength
  const maxDistance = command.radius + CUE_SEARCH_BEYOND_RADIUS
  const spacing = maxDistance / CUE_SAMPLE_INTERVALS
  let previousHeight = water.sample(
    command.position.x,
    command.position.z,
    time,
  ).height
  let sampleDistance = spacing
  let sampleX = command.position.x + directionX * sampleDistance
  let sampleZ = command.position.z + directionZ * sampleDistance
  let surface = water.sample(sampleX, sampleZ, time)

  let bestSignal = 0
  let bestX = 0
  let bestZ = 0
  let bestHeight = 0
  let bestDistance = 0

  for (let index = 1; index < CUE_SAMPLE_INTERVALS; index++) {
    const nextDistance = (index + 1) * spacing
    const nextSurface = water.sample(
      command.position.x + directionX * nextDistance,
      command.position.z + directionZ * nextDistance,
      time,
    )
    const forwardFlow =
      surface.velocity.x * directionX + surface.velocity.z * directionZ
    const crestProminence = Math.max(
      0,
      surface.height - (previousHeight + nextSurface.height) * 0.5,
    )
    const signal =
      forwardFlow * 0.72 + crestProminence * 1.4 + surface.turbulence * 0.08

    if (forwardFlow >= MIN_FORWARD_FLOW && signal > bestSignal) {
      bestSignal = signal
      bestX = sampleX
      bestZ = sampleZ
      bestHeight = surface.height
      bestDistance = sampleDistance
    }

    previousHeight = surface.height
    sampleDistance = nextDistance
    sampleX = command.position.x + directionX * sampleDistance
    sampleZ = command.position.z + directionZ * sampleDistance
    surface = nextSurface
  }

  if (bestSignal === 0) return null

  return {
    x: bestX,
    z: bestZ,
    height: bestHeight,
    distance: bestDistance,
    confidence: Math.min(1, Math.max(0, (bestSignal - MIN_FORWARD_FLOW) / 0.7)),
  }
}
