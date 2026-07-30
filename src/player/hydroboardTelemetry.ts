export type HydroboardContactState = 'water' | 'airborne' | 'landing'

/**
 * Low-frequency rider data intended for UI and audio consumers.
 *
 * `carvingIntensity` and `charge` are normalized to the 0..1 range. The
 * controller can publish this at a modest cadence; none of the consumers need
 * a React state update for every rendered frame.
 */
export interface HydroboardTelemetry {
  readonly speed: number
  readonly carvingIntensity: number
  readonly isCasting: boolean
  readonly contactState: HydroboardContactState
  readonly aimDistance: number
  readonly beaconDistance: number
  readonly charge?: number
}

export const INITIAL_HYDROBOARD_TELEMETRY: HydroboardTelemetry = {
  speed: 0,
  carvingIntensity: 0,
  isCasting: false,
  contactState: 'water',
  aimDistance: 0,
  beaconDistance: 107,
}
