import { describe, expect, it } from 'vitest'
import { getXrChaseYaw } from './chaseCamera'

describe('XR chase camera orientation', () => {
  it('faces WebXR forward toward a board travelling along positive Z', () => {
    expect(getXrChaseYaw(0)).toBe(Math.PI)
  })

  it('preserves the board heading after applying the WebXR forward offset', () => {
    expect(getXrChaseYaw(Math.PI / 2)).toBe(Math.PI * 1.5)
  })
})
