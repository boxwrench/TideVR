import { describe, expect, it } from 'vitest'
import {
  createMovementKeyState,
  resetMovementKeys,
  sampleQuestInput,
  shouldEmitTelemetry,
  updateCastingKeys,
  updateMovementKey,
  type HydroboardTelemetry,
} from './inputState'

const button = (pressed = false) => ({ pressed })

describe('desktop input state', () => {
  it('keeps casting active until every casting key is released', () => {
    const keys = new Set<string>()

    expect(updateCastingKeys(keys, 'Shift', true)).toBe(true)
    expect(updateCastingKeys(keys, 'e', true)).toBe(true)
    expect(updateCastingKeys(keys, 'Shift', false)).toBe(true)
    expect(updateCastingKeys(keys, 'e', false)).toBe(false)
  })

  it('ignores unrelated casting keys without changing held keys', () => {
    const keys = new Set(['e'])

    expect(updateCastingKeys(keys, 'q', false)).toBe(true)
    expect(keys).toEqual(new Set(['e']))
  })

  it('updates and resets movement keys', () => {
    const state = createMovementKeyState()

    expect(updateMovementKey(state, 'w', true)).toBe(true)
    expect(updateMovementKey(state, 'ArrowLeft', true)).toBe(true)
    expect(updateMovementKey(state, ' ', true)).toBe(true)
    expect(updateMovementKey(state, 'q', true)).toBe(false)
    expect(state).toMatchObject({ forward: true, left: true, boost: true })

    resetMovementKeys(state)
    expect(state).toEqual(createMovementKeyState())
  })
})

describe('Quest input mapping', () => {
  it('maps the left stick, left trigger or grip, and right trigger or grip', () => {
    const left = {
      axes: [0, 0, 0.5, -0.75],
      buttons: [button(true), button(false)],
    }
    const right = { axes: [], buttons: [button(true)] }

    expect(sampleQuestInput(left, right)).toMatchObject({
      turn: 0.5,
      forward: 0.75,
      boost: true,
      casting: true,
    })

    right.buttons[0] = button(false)
    expect(sampleQuestInput(left, right).casting).toBe(false)

    right.buttons[1] = button(true)
    expect(sampleQuestInput(left, right).casting).toBe(true)
  })

  it('falls back to the primary axes and applies a dead zone', () => {
    expect(
      sampleQuestInput(
        { axes: [0.1, -0.15], buttons: [] },
        undefined,
      ),
    ).toMatchObject({ turn: 0, forward: 0 })

    expect(
      sampleQuestInput(
        { axes: [-0.5, 0.4], buttons: [] },
        undefined,
      ),
    ).toMatchObject({ turn: -0.5, forward: -0.4 })
  })

  it('cycles abilities from either right-controller face button', () => {
    const right = {
      axes: [],
      buttons: [
        button(),
        button(),
        button(),
        button(),
        button(true),
        button(),
      ],
    }

    expect(sampleQuestInput(undefined, right).cycleAbility).toBe(true)
  })
})

describe('telemetry emission', () => {
  const idle: HydroboardTelemetry = {
    speed: 4,
    carvingIntensity: 0.2,
    isCasting: false,
    contactState: 'water',
    aimDistance: 12,
    beaconDistance: 107,
  }

  it('emits immediately on casting edges and otherwise throttles updates', () => {
    expect(shouldEmitTelemetry(undefined, idle, 0, 0)).toBe(true)
    expect(
      shouldEmitTelemetry(idle, { ...idle, speed: 5 }, 50, 0),
    ).toBe(false)
    expect(
      shouldEmitTelemetry(idle, { ...idle, isCasting: true }, 50, 0),
    ).toBe(true)
    expect(
      shouldEmitTelemetry(idle, { ...idle, speed: 5 }, 100, 0),
    ).toBe(true)
  })

  it('supports a caller-selected interval', () => {
    expect(shouldEmitTelemetry(idle, idle, 199, 0, 200)).toBe(false)
    expect(shouldEmitTelemetry(idle, idle, 200, 0, 200)).toBe(true)
  })
})
