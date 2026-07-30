export interface WaterVector2 {
  readonly x: number
  readonly z: number
}
export interface WaterVector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface WaterSample {
  readonly height: number
  readonly normal: WaterVector3
  readonly velocity: WaterVector2
  readonly turbulence: number
}

export interface WaterSampler {
  sample(x: number, z: number, time: number): WaterSample
}
