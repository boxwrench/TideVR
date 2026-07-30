import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FAR_OCEAN_SIZE,
  createFarOceanGeometry,
} from './FarOceanGeometry'

describe('far-ocean skirt geometry', () => {
  it('surrounds the near patch without filling its center', () => {
    const nearSize = 180
    const geometry = createFarOceanGeometry(nearSize)
    const position = geometry.getAttribute('position')
    const inner = nearSize * 0.5
    const outer = DEFAULT_FAR_OCEAN_SIZE * 0.5
    let staysInsideOuterBounds = true
    let staysOutsideNearPatch = true

    for (let index = 0; index < position.count; index += 1) {
      const x = Math.abs(position.getX(index))
      const y = Math.abs(position.getY(index))
      staysInsideOuterBounds &&= x <= outer && y <= outer
      staysOutsideNearPatch &&= x >= inner || y >= inner
    }

    expect(staysInsideOuterBounds).toBe(true)
    expect(staysOutsideNearPatch).toBe(true)
    expect(geometry.index?.count).toBeGreaterThan(0)
    geometry.dispose()
  })

  it('rejects a far layer that cannot surround the near patch', () => {
    expect(() => createFarOceanGeometry(180, 180)).toThrow(
      /larger than the near ocean/,
    )
    expect(() => createFarOceanGeometry(180, 900, 0)).toThrow(
      /vertex spacing must be positive/,
    )
  })

  it('reduces geometry density when vertex spacing increases', () => {
    const dense = createFarOceanGeometry(180, 900, 6)
    const sparse = createFarOceanGeometry(180, 900, 12)

    expect(
      sparse.getAttribute('position').count,
    ).toBeLessThan(dense.getAttribute('position').count)

    dense.dispose()
    sparse.dispose()
  })
})
