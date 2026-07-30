export interface WorldPoint {
  readonly x: number
  readonly z: number
}

interface BaseWaterCommand {
  readonly sequence: number
  readonly position: WorldPoint
  readonly direction: WorldPoint
  readonly radius: number
  readonly strength: number
  readonly issuedAt: number
}

export interface SwellCommand extends BaseWaterCommand {
  readonly kind: 'swell'
}

export interface CurrentCommand extends BaseWaterCommand {
  readonly kind: 'current'
}

export interface VortexCommand extends BaseWaterCommand {
  readonly kind: 'vortex'
}

export interface WakeCommand extends BaseWaterCommand {
  readonly kind: 'wake'
}

export type WaterCommand =
  | SwellCommand
  | CurrentCommand
  | VortexCommand
  | WakeCommand

type WithoutSequence<T> = T extends unknown ? Omit<T, 'sequence'> : never
export type WaterCommandDraft = WithoutSequence<WaterCommand>

const RETAINED_COMMANDS = 256

/**
 * Small append-only command log. The CPU and GPU simulations keep independent
 * cursors so neither one owns or consumes the other's input.
 */
export class WaterCommandBus {
  private nextSequence = 1
  private commands: WaterCommand[] = []

  emit(draft: WaterCommandDraft): WaterCommand {
    const command = { ...draft, sequence: this.nextSequence++ } as WaterCommand
    this.commands.push(command)

    if (this.commands.length > RETAINED_COMMANDS) {
      this.commands.splice(0, this.commands.length - RETAINED_COMMANDS)
    }

    return command
  }

  readAfter(sequence: number): ReadonlyArray<WaterCommand> {
    if (this.commands.length === 0) return []
    return this.commands.filter((command) => command.sequence > sequence)
  }
}
