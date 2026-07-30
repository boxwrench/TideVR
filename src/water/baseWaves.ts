import type { WaterSample } from './types'

export interface BaseWave {
  readonly amplitude: number
  readonly directionX: number
  readonly directionZ: number
  readonly wavelength: number
  readonly angularFrequency: number
  readonly phase: number
}

function direction(x: number, z: number): { x: number; z: number } {
  const inverseLength = 1 / Math.hypot(x, z)
  return { x: x * inverseLength, z: z * inverseLength }
}

const directionA = direction(1, 0.2)
const directionB = direction(-0.35, 1)
const directionC = direction(0.7, -1)
const directionD = direction(-1, -0.45)

/**
 * Shared source of truth for the broad ocean. OceanMaterial generates its GLSL
 * constants from this array so board contact and rendered crests stay aligned.
 */
export const BASE_WAVES: ReadonlyArray<BaseWave> = [
  {
    amplitude: 0.2,
    directionX: directionA.x,
    directionZ: directionA.z,
    wavelength: 26,
    angularFrequency: 0.58,
    phase: 0,
  },
  {
    amplitude: 0.11,
    directionX: directionB.x,
    directionZ: directionB.z,
    wavelength: 15,
    angularFrequency: 0.82,
    phase: 1.7,
  },
  {
    amplitude: 0.055,
    directionX: directionC.x,
    directionZ: directionC.z,
    wavelength: 9,
    angularFrequency: 1.16,
    phase: 3.1,
  },
  {
    amplitude: 0.025,
    directionX: directionD.x,
    directionZ: directionD.z,
    wavelength: 5.5,
    angularFrequency: 1.55,
    phase: 0.9,
  },
]

export interface BaseWaveState {
  readonly height: number
  readonly slopeX: number
  readonly slopeZ: number
}

export function sampleBaseWaveState(x: number, z: number, time: number): BaseWaveState {
  let height = 0
  let slopeX = 0
  let slopeZ = 0

  for (const wave of BASE_WAVES) {
    const waveNumber = (Math.PI * 2) / wave.wavelength
    const phase =
      waveNumber * (x * wave.directionX + z * wave.directionZ) -
      wave.angularFrequency * time +
      wave.phase
    const sine = Math.sin(phase)
    const derivative = wave.amplitude * waveNumber * Math.cos(phase)

    height += wave.amplitude * sine
    slopeX += derivative * wave.directionX
    slopeZ += derivative * wave.directionZ
  }

  return { height, slopeX, slopeZ }
}

export function sampleBaseWater(x: number, z: number, time: number): WaterSample {
  const state = sampleBaseWaveState(x, z, time)
  const inverseNormalLength = 1 / Math.hypot(state.slopeX, 1, state.slopeZ)

  return {
    height: state.height,
    normal: {
      x: -state.slopeX * inverseNormalLength,
      y: inverseNormalLength,
      z: -state.slopeZ * inverseNormalLength,
    },
    velocity: { x: 0, z: 0 },
    turbulence: Math.min(1, Math.hypot(state.slopeX, state.slopeZ) * 1.8),
  }
}
