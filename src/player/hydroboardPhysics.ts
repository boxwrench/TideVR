import type { HydroboardContactState } from './hydroboardTelemetry'
import type { WaterVector2, WaterVector3 } from '../water/types'

export interface HydroboardWaterForcesConfig {
  /** Acceleration in m/s² contributed by a unit water-surface slope. */
  readonly slopeAcceleration: number
  /** Per-second response toward the local water-current velocity. */
  readonly currentResponse: number
  /** Fraction of normal water coupling retained during the landing state. */
  readonly landingCoupling: number
  /** Prevents near-vertical normals from producing unbounded slope forces. */
  readonly minNormalY: number
}

export const DEFAULT_HYDROBOARD_WATER_FORCES: HydroboardWaterForcesConfig = {
  slopeAcceleration: 4.2,
  // The board already has hull drag in the movement step. A modest response
  // keeps relative-current coupling truthful without making ordinary riding
  // settle below the 9 m/s launch threshold.
  currentResponse: 0.35,
  landingCoupling: 0.35,
  minNormalY: 0.3,
}

export interface HydroboardWaterForcesInput {
  readonly boardVelocity: WaterVector2
  readonly waterVelocity: WaterVector2
  readonly surfaceNormal: WaterVector3
  readonly contactState: HydroboardContactState
}

/**
 * Calculates horizontal acceleration from the sampled water surface.
 *
 * The current term is based on board velocity relative to the water, so a
 * board already moving with the current receives no additional current force.
 * The returned acceleration is in m/s²; callers apply it once with their
 * frame delta.
 */
export function calculateHydroboardWaterAcceleration(
  input: HydroboardWaterForcesInput,
  config: HydroboardWaterForcesConfig = DEFAULT_HYDROBOARD_WATER_FORCES,
): WaterVector2 {
  const coupling = getContactCoupling(
    input.contactState,
    config.landingCoupling,
  )
  if (coupling === 0) return { x: 0, z: 0 }

  const normalY = Math.max(config.minNormalY, input.surfaceNormal.y)
  const relativeCurrentX =
    input.waterVelocity.x - input.boardVelocity.x
  const relativeCurrentZ =
    input.waterVelocity.z - input.boardVelocity.z

  return {
    x:
      coupling *
      (relativeCurrentX * config.currentResponse +
        (input.surfaceNormal.x / normalY) * config.slopeAcceleration),
    z:
      coupling *
      (relativeCurrentZ * config.currentResponse +
        (input.surfaceNormal.z / normalY) * config.slopeAcceleration),
  }
}

function getContactCoupling(
  contactState: HydroboardContactState,
  landingCoupling: number,
): number {
  switch (contactState) {
    case 'water':
      return 1
    case 'landing':
      return Math.max(0, Math.min(1, landingCoupling))
    case 'airborne':
      return 0
  }
}
