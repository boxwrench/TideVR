import { describe, expect, it } from 'vitest'
import {
  REFERENCE_REFRESH_RATE,
  getReferenceFrameScale,
  referenceProbabilityToFrameProbability,
} from './frameTiming'

describe('frame-independent timing', () => {
  it('preserves an authored per-frame strength at 72 Hz', () => {
    expect(
      getReferenceFrameScale(1 / REFERENCE_REFRESH_RATE),
    ).toBeCloseTo(1, 8)
  })

  it.each([72, 80, 90, 120])(
    'applies equal strength per second at %i Hz',
    (rate) => {
      expect(getReferenceFrameScale(1 / rate) * rate).toBeCloseTo(
        REFERENCE_REFRESH_RATE,
        8,
      )
    },
  )

  it.each([72, 80, 90, 120])(
    'preserves equal event survival over one second at %i Hz',
    (rate) => {
      const perFrame = referenceProbabilityToFrameProbability(
        0.35,
        1 / rate,
      )
      const survival = Math.pow(1 - perFrame, rate)
      expect(survival).toBeCloseTo(
        Math.pow(1 - 0.35, REFERENCE_REFRESH_RATE),
        8,
      )
    },
  )

  it('clamps invalid authored probabilities and negative deltas', () => {
    expect(referenceProbabilityToFrameProbability(-1, 1 / 72)).toBe(0)
    expect(referenceProbabilityToFrameProbability(2, 1 / 72)).toBe(1)
    expect(getReferenceFrameScale(-1)).toBe(0)
  })
})
