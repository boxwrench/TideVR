import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HYDROBOARD_WATER_FORCES,
  calculateHydroboardWaterAcceleration,
  type HydroboardWaterForcesInput,
} from './hydroboardPhysics'

const ACTIVE_WATER_INPUT: HydroboardWaterForcesInput = {
  boardVelocity: { x: 2, z: -1 },
  waterVelocity: { x: 6, z: 3 },
  surfaceNormal: { x: 0.2, y: 0.8, z: -0.1 },
  contactState: 'water',
}

describe('hydroboard water coupling', () => {
  it('does not couple current or surface slope while airborne', () => {
    const acceleration = calculateHydroboardWaterAcceleration({
      ...ACTIVE_WATER_INPUT,
      contactState: 'airborne',
    })

    expect(acceleration).toEqual({ x: 0, z: 0 })
  })

  it('adds no current acceleration when the board matches the water velocity', () => {
    const acceleration = calculateHydroboardWaterAcceleration({
      boardVelocity: { x: 5, z: -2 },
      waterVelocity: { x: 5, z: -2 },
      surfaceNormal: { x: 0, y: 1, z: 0 },
      contactState: 'water',
    })

    expect(acceleration).toEqual({ x: 0, z: 0 })
  })

  it('retains only the configured fraction of coupling during landing', () => {
    const waterAcceleration =
      calculateHydroboardWaterAcceleration(ACTIVE_WATER_INPUT)
    const landingAcceleration = calculateHydroboardWaterAcceleration({
      ...ACTIVE_WATER_INPUT,
      contactState: 'landing',
    })

    expect(landingAcceleration.x).toBeCloseTo(
      waterAcceleration.x *
        DEFAULT_HYDROBOARD_WATER_FORCES.landingCoupling,
    )
    expect(landingAcceleration.z).toBeCloseTo(
      waterAcceleration.z *
        DEFAULT_HYDROBOARD_WATER_FORCES.landingCoupling,
    )
    expect(Math.hypot(landingAcceleration.x, landingAcceleration.z)).toBeLessThan(
      Math.hypot(waterAcceleration.x, waterAcceleration.z),
    )
  })

  it('combines relative-current and slope acceleration at full water contact', () => {
    const acceleration =
      calculateHydroboardWaterAcceleration(ACTIVE_WATER_INPUT)

    // Relative-current acceleration: (4, 4) * 0.35 = (1.4, 1.4)
    // Slope acceleration: (0.2, -0.1) / 0.8 * 4.2 = (1.05, -0.525)
    expect(acceleration.x).toBeCloseTo(2.45)
    expect(acceleration.z).toBeCloseTo(0.875)
  })

  it('does not make the normal-throttle launch threshold unreachable', () => {
    const launchThresholdSpeed = 9
    const acceleration = calculateHydroboardWaterAcceleration({
      boardVelocity: { x: 0, z: launchThresholdSpeed },
      waterVelocity: { x: 0, z: 0 },
      surfaceNormal: { x: 0, y: 1, z: 0 },
      contactState: 'water',
    })
    const normalThrottleAcceleration = 11.5
    const hullDragAtThreshold = 0.34 * launchThresholdSpeed

    expect(
      normalThrottleAcceleration +
        acceleration.z -
        hullDragAtThreshold,
    ).toBeGreaterThan(0)
  })
})
