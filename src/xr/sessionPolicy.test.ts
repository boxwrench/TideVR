import { describe, expect, it } from 'vitest'
import {
  selectQuestFrameRate,
  shouldEnableXrEmulator,
} from './sessionPolicy'

describe('XR session policy', () => {
  it('selects 72 Hz explicitly when the runtime offers it', () => {
    expect(
      selectQuestFrameRate(new Float32Array([72, 80, 90, 120])),
    ).toBe(72)
  })

  it('leaves the runtime frame rate unchanged when 72 Hz is unavailable', () => {
    expect(selectQuestFrameRate([80, 90, 120])).toBe(false)
  })

  it('only enables emulation for an explicit development query', () => {
    expect(shouldEnableXrEmulator(true, '?emulate=1')).toBe(true)
    expect(shouldEnableXrEmulator(true, '?emulate=0')).toBe(false)
    expect(shouldEnableXrEmulator(true, '')).toBe(false)
    expect(shouldEnableXrEmulator(false, '?emulate=1')).toBe(false)
  })
})
