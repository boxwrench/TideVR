export const LOOP_TRIGGER_Z = 76
export const LOOP_REBASE_DISTANCE = 138
export const LOOP_FADE_OUT_SECONDS = 0.35
export const LOOP_FADE_IN_SECONDS = 0.55

export type LoopTransitionPhase =
  | 'idle'
  | 'fading-out'
  | 'fading-in'

export interface LoopTransitionState {
  phase: LoopTransitionPhase
  elapsed: number
}

export interface LoopTransitionStep {
  state: LoopTransitionState
  opacity: number
  shouldRebase: boolean
}

export function createLoopTransitionState(): LoopTransitionState {
  return { phase: 'idle', elapsed: 0 }
}

export function rebaseLoopCoordinate(z: number): number {
  return z - LOOP_REBASE_DISTANCE
}

export function stepLoopTransition(
  current: LoopTransitionState,
  deltaTime: number,
  boardZ: number,
): LoopTransitionStep {
  const delta = Math.max(0, deltaTime)
  let state = current

  if (state.phase === 'idle') {
    if (boardZ < LOOP_TRIGGER_Z) {
      return { state, opacity: 0, shouldRebase: false }
    }
    state = { phase: 'fading-out', elapsed: 0 }
  }

  if (state.phase === 'fading-out') {
    const elapsed = Math.min(
      LOOP_FADE_OUT_SECONDS,
      state.elapsed + delta,
    )
    if (elapsed >= LOOP_FADE_OUT_SECONDS) {
      return {
        state: { phase: 'fading-in', elapsed: 0 },
        opacity: 1,
        shouldRebase: true,
      }
    }
    return {
      state: { phase: 'fading-out', elapsed },
      opacity: elapsed / LOOP_FADE_OUT_SECONDS,
      shouldRebase: false,
    }
  }

  const elapsed = Math.min(
    LOOP_FADE_IN_SECONDS,
    state.elapsed + delta,
  )
  if (elapsed >= LOOP_FADE_IN_SECONDS) {
    return {
      state: createLoopTransitionState(),
      opacity: 0,
      shouldRebase: false,
    }
  }
  return {
    state: { phase: 'fading-in', elapsed },
    opacity: 1 - elapsed / LOOP_FADE_IN_SECONDS,
    shouldRebase: false,
  }
}
