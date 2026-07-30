export const REFERENCE_REFRESH_RATE = 72

/**
 * Converts a frame delta to the equivalent number of 72 Hz reference frames.
 * Large deltas are capped to avoid a hitch causing an extreme one-frame burst.
 */
export function getReferenceFrameScale(deltaTime: number): number {
  return (
    Math.max(0, Math.min(deltaTime, 0.05)) *
    REFERENCE_REFRESH_RATE
  )
}

/**
 * Converts a probability authored per 72 Hz frame to an equivalent probability
 * for the current frame duration.
 */
export function referenceProbabilityToFrameProbability(
  referenceFrameProbability: number,
  deltaTime: number,
): number {
  const probability = Math.max(
    0,
    Math.min(1, referenceFrameProbability),
  )
  return 1 - Math.pow(
    1 - probability,
    getReferenceFrameScale(deltaTime),
  )
}
