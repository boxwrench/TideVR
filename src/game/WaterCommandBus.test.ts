import { describe, expect, it } from 'vitest'
import { WaterCommandBus } from './WaterCommandBus'

describe('water command stream', () => {
  it('assigns monotonic sequences and lets consumers keep independent cursors', () => {
    const commands = new WaterCommandBus()
    const swell = commands.emit({
      kind: 'swell',
      position: { x: 2, z: 4 },
      direction: { x: 0, z: 1 },
      radius: 5,
      strength: 0.75,
      issuedAt: 1,
    })
    const current = commands.emit({
      kind: 'current',
      position: { x: 3, z: 5 },
      direction: { x: 1, z: 0 },
      radius: 2,
      strength: 0.5,
      issuedAt: 2,
    })

    expect(swell.sequence).toBe(1)
    expect(current.sequence).toBe(2)
    expect(commands.readAfter(0)).toEqual([swell, current])
    expect(commands.readAfter(swell.sequence)).toEqual([current])
    expect(commands.readAfter(current.sequence)).toEqual([])
  })
})
