import { describe, expect, it } from 'vitest'
import {
  LOOP_FADE_IN_SECONDS,
  LOOP_FADE_OUT_SECONDS,
  LOOP_REBASE_DISTANCE,
  LOOP_TRIGGER_Z,
  createLoopTransitionState,
  rebaseLoopCoordinate,
  stepLoopTransition,
} from './loopTransition'

describe('masked ocean loop transition', () => {
  it('stays transparent before the rebase trigger', () => {
    const result = stepLoopTransition(
      createLoopTransitionState(),
      1,
      LOOP_TRIGGER_Z - 0.01,
    )

    expect(result.state.phase).toBe('idle')
    expect(result.opacity).toBe(0)
    expect(result.shouldRebase).toBe(false)
  })

  it('fades out before requesting a rebase', () => {
    const result = stepLoopTransition(
      createLoopTransitionState(),
      LOOP_FADE_OUT_SECONDS / 2,
      LOOP_TRIGGER_Z,
    )

    expect(result.state.phase).toBe('fading-out')
    expect(result.opacity).toBeCloseTo(0.5)
    expect(result.shouldRebase).toBe(false)
  })

  it('rebases once at full opacity and preserves coordinate overshoot', () => {
    const first = stepLoopTransition(
      {
        phase: 'fading-out',
        elapsed: LOOP_FADE_OUT_SECONDS - 0.01,
      },
      0.02,
      LOOP_TRIGGER_Z + 3,
    )

    expect(first.state).toEqual({ phase: 'fading-in', elapsed: 0 })
    expect(first.opacity).toBe(1)
    expect(first.shouldRebase).toBe(true)
    expect(rebaseLoopCoordinate(LOOP_TRIGGER_Z + 3)).toBe(
      LOOP_TRIGGER_Z + 3 - LOOP_REBASE_DISTANCE,
    )

    const next = stepLoopTransition(
      first.state,
      0,
      rebaseLoopCoordinate(LOOP_TRIGGER_Z + 3),
    )
    expect(next.shouldRebase).toBe(false)
  })

  it('fades back to a transparent idle state', () => {
    const middle = stepLoopTransition(
      { phase: 'fading-in', elapsed: 0 },
      LOOP_FADE_IN_SECONDS / 2,
      0,
    )
    expect(middle.opacity).toBeCloseTo(0.5)

    const finished = stepLoopTransition(
      middle.state,
      LOOP_FADE_IN_SECONDS,
      0,
    )
    expect(finished.state.phase).toBe('idle')
    expect(finished.opacity).toBe(0)
  })

  it('does not rewind a transition for a negative frame delta', () => {
    const result = stepLoopTransition(
      { phase: 'fading-out', elapsed: 0.1 },
      -1,
      LOOP_TRIGGER_Z,
    )

    expect(result.state).toEqual({
      phase: 'fading-out',
      elapsed: 0.1,
    })
  })
})
