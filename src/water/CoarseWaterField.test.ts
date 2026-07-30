import { describe, expect, it } from 'vitest'
import type { WaterCommand } from '../game/WaterCommandBus'
import { sampleBaseWater } from './baseWaves'
import { CoarseWaterField } from './CoarseWaterField'

function command(
  kind: WaterCommand['kind'],
  overrides: Partial<WaterCommand> = {},
): WaterCommand {
  return {
    kind,
    sequence: 1,
    position: { x: 0, z: 0 },
    direction: { x: 1, z: 0 },
    radius: 8,
    strength: 1,
    issuedAt: 0,
    ...overrides,
  } as WaterCommand
}

describe('coarse gameplay water', () => {
  it('matches analytic base water before dynamic commands', () => {
    const field = new CoarseWaterField({
      resolution: 32,
      worldSize: 80,
      updateRate: 30,
    })
    const expected = sampleBaseWater(3, -6, 1.5)
    const actual = field.sample(3, -6, 1.5)

    expect(actual.height).toBeCloseTo(expected.height, 8)
    expect(actual.velocity).toEqual({ x: 0, z: 0 })
  })

  it('turns a Current command into board-facing horizontal velocity', () => {
    const field = new CoarseWaterField({
      resolution: 33,
      worldSize: 80,
      updateRate: 30,
    })
    field.enqueue([command('current')])
    field.update(1 / 30)

    const sample = field.sample(0, 0, 1 / 30)
    expect(sample.velocity.x).toBeGreaterThan(1)
    expect(Math.abs(sample.velocity.z)).toBeLessThan(0.05)
    expect(sample.turbulence).toBeGreaterThan(0)
  })

  it('gives a painted Current a raised bank beside its flow channel', () => {
    const field = new CoarseWaterField({
      resolution: 65,
      worldSize: 40,
      updateRate: 30,
    })
    const before = field.sample(0, 1.8, 1 / 30).height
    field.enqueue([
      command('current', {
        direction: { x: 1, z: 0 },
        radius: 4,
      }),
    ])
    field.update(1 / 30)

    expect(field.sample(0, 1.8, 1 / 30).height).toBeGreaterThan(before)
  })

  it('turns a Vortex command into a temporary depression', () => {
    const field = new CoarseWaterField({
      resolution: 33,
      worldSize: 80,
      updateRate: 30,
    })
    const baseHeight = field.sample(0, 0, 1 / 30).height
    field.enqueue([command('vortex')])
    field.update(1 / 30)

    expect(field.sample(0, 0, 1 / 30).height).toBeLessThan(baseHeight)
  })

  it('carves a foamy wake trough with raised rails', () => {
    const field = new CoarseWaterField({
      resolution: 65,
      worldSize: 40,
      updateRate: 30,
    })
    const beforeCenter = field.sample(0, 0, 1 / 30).height
    const beforeRail = field.sample(0, 1.25, 1 / 30).height
    field.enqueue([
      command('wake', {
        direction: { x: 1, z: 0 },
        radius: 2.5,
      }),
    ])
    field.update(1 / 30)

    const center = field.sample(0, 0, 1 / 30)
    const rail = field.sample(0, 1.25, 1 / 30)
    expect(center.height).toBeLessThan(beforeCenter)
    expect(rail.height).toBeGreaterThan(beforeRail)
    expect(center.turbulence).toBeGreaterThan(0.2)
  })
})
