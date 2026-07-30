import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WATER_RENDER_QUALITY,
  WATER_RENDER_QUALITY_SETTINGS,
  resolveWaterRenderQuality,
} from './waterRenderQuality'

describe('water render quality', () => {
  it('defaults to the balanced medium tier', () => {
    expect(DEFAULT_WATER_RENDER_QUALITY).toBe('medium')
  })

  it('increases near detail and far density monotonically', () => {
    const { low, medium, high } = WATER_RENDER_QUALITY_SETTINGS

    expect(low.nearSegments).toBeLessThan(medium.nearSegments)
    expect(medium.nearSegments).toBeLessThan(high.nearSegments)
    expect(low.farVertexSpacing).toBeGreaterThan(
      medium.farVertexSpacing,
    )
    expect(medium.farVertexSpacing).toBeGreaterThan(
      high.farVertexSpacing,
    )
  })

  it('accepts supported URL values and safely defaults invalid ones', () => {
    expect(resolveWaterRenderQuality('low')).toBe('low')
    expect(resolveWaterRenderQuality('high')).toBe('high')
    expect(resolveWaterRenderQuality('ultra')).toBe('medium')
    expect(resolveWaterRenderQuality(null)).toBe('medium')
  })
})
