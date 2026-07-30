export interface ButtonState {
  readonly pressed: boolean
}

export interface GamepadState {
  readonly axes: ReadonlyArray<number>
  readonly buttons: ReadonlyArray<ButtonState | undefined>
}

export interface QuestInputState {
  readonly turn: number
  readonly forward: number
  readonly boost: boolean
  readonly casting: boolean
  readonly cycleAbility: boolean
}

export interface MovementKeyState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  boost: boolean
}

const CAST_KEYS = new Set(['e', 'shift'])

/**
 * Tracks casting keys independently so releasing one key cannot cancel a cast
 * while another casting key is still held.
 */
export function updateCastingKeys(
  pressedKeys: Set<string>,
  key: string,
  pressed: boolean,
): boolean {
  const normalizedKey = key.toLowerCase()
  if (!CAST_KEYS.has(normalizedKey)) return pressedKeys.size > 0

  if (pressed) pressedKeys.add(normalizedKey)
  else pressedKeys.delete(normalizedKey)
  return pressedKeys.size > 0
}

export function createMovementKeyState(): MovementKeyState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  }
}

export function updateMovementKey(
  state: MovementKeyState,
  key: string,
  pressed: boolean,
): boolean {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      state.forward = pressed
      return true
    case 's':
    case 'arrowdown':
      state.backward = pressed
      return true
    case 'a':
    case 'arrowleft':
      state.left = pressed
      return true
    case 'd':
    case 'arrowright':
      state.right = pressed
      return true
    case ' ':
      state.boost = pressed
      return true
    default:
      return false
  }
}

export function resetMovementKeys(state: MovementKeyState): void {
  state.forward = false
  state.backward = false
  state.left = false
  state.right = false
  state.boost = false
}

function sampleThumbstick(
  gamepad: GamepadState | undefined,
): { x: number; y: number } {
  if (!gamepad) return { x: 0, y: 0 }

  const { axes } = gamepad
  return {
    x:
      axes.length > 2 && Math.abs(axes[2] ?? 0) > 0.1
        ? (axes[2] ?? 0)
        : (axes[0] ?? 0),
    y:
      axes.length > 3 && Math.abs(axes[3] ?? 0) > 0.1
        ? (axes[3] ?? 0)
        : (axes[1] ?? 0),
  }
}

export function sampleQuestInput(
  leftGamepad: GamepadState | undefined,
  rightGamepad: GamepadState | undefined,
): QuestInputState {
  const thumbstick = sampleThumbstick(leftGamepad)

  return {
    // Tide's positive heading rotates the board toward +X, so positive stick X
    // remains positive. SnowVR uses the opposite heading convention.
    turn: Math.abs(thumbstick.x) > 0.15 ? thumbstick.x : 0,
    forward: Math.abs(thumbstick.y) > 0.15 ? -thumbstick.y : 0,
    boost: Boolean(
      leftGamepad?.buttons[0]?.pressed ||
        leftGamepad?.buttons[1]?.pressed,
    ),
    casting: Boolean(
      rightGamepad?.buttons[0]?.pressed ||
        rightGamepad?.buttons[1]?.pressed,
    ),
    cycleAbility: Boolean(
      rightGamepad?.buttons[4]?.pressed ||
        rightGamepad?.buttons[5]?.pressed,
    ),
  }
}

export function shouldEmitTelemetry(
  previous: HydroboardTelemetry | undefined,
  next: HydroboardTelemetry,
  now: number,
  lastEmissionTime: number,
  intervalMs = 100,
): boolean {
  return (
    previous === undefined ||
    previous.isCasting !== next.isCasting ||
    now - lastEmissionTime >= intervalMs
  )
}
import type { HydroboardTelemetry } from '../player/hydroboardTelemetry'

export type { HydroboardTelemetry } from '../player/hydroboardTelemetry'
