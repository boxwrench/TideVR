import { describe, expect, it } from 'vitest'
import { sampleBaseWater, sampleBaseWaveState } from './baseWaves'

describe('analytic base waves', () => {
  it('returns a normalized surface normal', () => {
    const sample = sampleBaseWater(7.5, -13.25, 2.4)
    const normalLength = Math.hypot(
      sample.normal.x,
      sample.normal.y,
      sample.normal.z,
    )

    expect(normalLength).toBeCloseTo(1, 8)
    expect(sample.normal.y).toBeGreaterThan(0)
  })

  it('reports slopes that match centered height differences', () => {
    const x = -4.5
    const z = 11.2
    const time = 3.75
    const epsilon = 0.001
    const state = sampleBaseWaveState(x, z, time)
    const slopeX =
      (sampleBaseWaveState(x + epsilon, z, time).height -
        sampleBaseWaveState(x - epsilon, z, time).height) /
      (2 * epsilon)
    const slopeZ =
      (sampleBaseWaveState(x, z + epsilon, time).height -
        sampleBaseWaveState(x, z - epsilon, time).height) /
      (2 * epsilon)

    expect(state.slopeX).toBeCloseTo(slopeX, 5)
    expect(state.slopeZ).toBeCloseTo(slopeZ, 5)
  })
})
