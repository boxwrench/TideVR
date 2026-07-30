import { describe, expect, it } from 'vitest'
import type { SwellCommand } from '../game/WaterCommandBus'
import { CoarseWaterField } from './CoarseWaterField'
import type { WaterSample, WaterSampler } from './types'
import { findSwellCue } from './swellCue'

const command: SwellCommand = {
  kind: 'swell',
  sequence: 1,
  position: { x: 2, z: -3 },
  direction: { x: 2, z: 0 },
  radius: 4,
  strength: 1,
  issuedAt: 0,
}

function waterWithFlowAt(crestX: number): WaterSampler {
  return {
    sample(x: number): WaterSample {
      const flow = Math.exp(-Math.pow((x - crestX) / 1.2, 2)) * 1.8
      return {
        height: flow * 0.35,
        normal: { x: 0, y: 1, z: 0 },
        velocity: { x: flow, z: 0 },
        turbulence: flow * 0.25,
      }
    },
  }
}

describe('field-derived Swell cue', () => {
  it('tracks forward-moving water instead of elapsed-time travel', () => {
    const cue = findSwellCue(command, waterWithFlowAt(10), 0.25)

    expect(cue).not.toBeNull()
    expect(cue?.x).toBeCloseTo(10, 0)
    expect(cue?.z).toBeCloseTo(-3, 6)
    expect(cue?.distance).toBeCloseTo(8, 0)
    expect(cue?.confidence).toBeGreaterThan(0.8)
  })

  it('does not create a traveling cue without simulated forward flow', () => {
    const stillWater: WaterSampler = {
      sample: () => ({
        height: 0.4,
        normal: { x: 0, y: 1, z: 0 },
        velocity: { x: 0, z: 0 },
        turbulence: 0.6,
      }),
    }

    expect(findSwellCue(command, stillWater, 3)).toBeNull()
  })

  it('finds the crest signal produced by the gameplay water solver', () => {
    const field = new CoarseWaterField({
      resolution: 65,
      worldSize: 40,
      updateRate: 30,
    })
    const centeredCommand = {
      ...command,
      position: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
    }
    field.enqueue([centeredCommand])
    field.update(1 / 30)

    const cue = findSwellCue(centeredCommand, field, 1 / 30)
    expect(cue).not.toBeNull()
    expect(cue?.distance).toBeLessThan(centeredCommand.radius * 1.5)
    expect(cue?.confidence).toBeGreaterThan(0)
  })

  it('rejects commands without an aim direction', () => {
    expect(
      findSwellCue(
        { ...command, direction: { x: 0, z: 0 } },
        waterWithFlowAt(2),
        0,
      ),
    ).toBeNull()
  })
})
