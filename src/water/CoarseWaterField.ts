import type { WaterCommand } from '../game/WaterCommandBus'
import { sampleBaseWaveState } from './baseWaves'
import type { WaterSample, WaterSampler } from './types'

export interface CoarseWaterFieldOptions {
  readonly resolution?: number
  readonly worldSize?: number
  readonly updateRate?: number
}

const CHANNELS = 4
const HEIGHT = 0
const VELOCITY_X = 1
const VELOCITY_Z = 2
const FOAM = 3

/**
 * Low-resolution gameplay mirror of the visual water field. The board samples
 * this class directly; rendering never reads it back from the GPU.
 */
export class CoarseWaterField implements WaterSampler {
  readonly resolution: number
  readonly worldSize: number

  private readonly fixedStep: number
  private readonly cellSize: number
  private state: Float32Array
  private nextState: Float32Array
  private accumulator = 0
  private pendingCommands: WaterCommand[] = []

  constructor({
    resolution = 64,
    worldSize = 180,
    updateRate = 30,
  }: CoarseWaterFieldOptions = {}) {
    this.resolution = resolution
    this.worldSize = worldSize
    this.fixedStep = 1 / updateRate
    this.cellSize = worldSize / (resolution - 1)
    this.state = new Float32Array(resolution * resolution * CHANNELS)
    this.nextState = new Float32Array(this.state.length)
  }

  enqueue(commands: ReadonlyArray<WaterCommand>): void {
    this.pendingCommands.push(...commands)
  }

  update(deltaTime: number): void {
    this.accumulator = Math.min(this.accumulator + deltaTime, this.fixedStep * 3)

    let steps = 0
    while (this.accumulator >= this.fixedStep && steps < 2) {
      if (this.pendingCommands.length > 0) {
        for (const command of this.pendingCommands) this.applyCommand(command)
        this.pendingCommands.length = 0
      }

      this.step(this.fixedStep)
      this.accumulator -= this.fixedStep
      steps++
    }
  }

  sample(x: number, z: number, time: number): WaterSample {
    const base = sampleBaseWaveState(x, z, time)
    const dynamic = this.sampleDynamic(x, z)
    const slopeX = base.slopeX + dynamic.slopeX
    const slopeZ = base.slopeZ + dynamic.slopeZ
    const inverseNormalLength = 1 / Math.hypot(slopeX, 1, slopeZ)

    return {
      height: base.height + dynamic.height,
      normal: {
        x: -slopeX * inverseNormalLength,
        y: inverseNormalLength,
        z: -slopeZ * inverseNormalLength,
      },
      velocity: {
        x: dynamic.velocityX,
        z: dynamic.velocityZ,
      },
      turbulence: Math.min(
        1,
        dynamic.foam + Math.hypot(slopeX, slopeZ) * 1.35,
      ),
    }
  }

  private offset(x: number, z: number, channel: number): number {
    return (z * this.resolution + x) * CHANNELS + channel
  }

  private clampIndex(value: number): number {
    return Math.max(0, Math.min(this.resolution - 1, value))
  }

  private step(deltaTime: number): void {
    const last = this.resolution - 1
    const pressure = 6.5
    const depth = 0.8
    const velocityDamping = Math.exp(-0.72 * deltaTime)
    const heightDamping = Math.exp(-0.16 * deltaTime)
    const foamDamping = Math.exp(-0.52 * deltaTime)

    for (let z = 0; z < this.resolution; z++) {
      const zDown = Math.max(0, z - 1)
      const zUp = Math.min(last, z + 1)

      for (let x = 0; x < this.resolution; x++) {
        const xLeft = Math.max(0, x - 1)
        const xRight = Math.min(last, x + 1)
        const index = this.offset(x, z, 0)

        const heightLeft = this.state[this.offset(xLeft, z, HEIGHT)]
        const heightRight = this.state[this.offset(xRight, z, HEIGHT)]
        const heightDown = this.state[this.offset(x, zDown, HEIGHT)]
        const heightUp = this.state[this.offset(x, zUp, HEIGHT)]
        const neighborHeight =
          (heightLeft + heightRight + heightDown + heightUp) * 0.25
        const gradientX = (heightRight - heightLeft) / (2 * this.cellSize)
        const gradientZ = (heightUp - heightDown) / (2 * this.cellSize)

        const velocityLeft = this.state[this.offset(xLeft, z, VELOCITY_X)]
        const velocityRight = this.state[this.offset(xRight, z, VELOCITY_X)]
        const velocityDown = this.state[this.offset(x, zDown, VELOCITY_Z)]
        const velocityUp = this.state[this.offset(x, zUp, VELOCITY_Z)]
        const divergence =
          (velocityRight - velocityLeft + velocityUp - velocityDown) /
          (2 * this.cellSize)

        const velocityX =
          (this.state[index + VELOCITY_X] - pressure * gradientX * deltaTime) *
          velocityDamping
        const velocityZ =
          (this.state[index + VELOCITY_Z] - pressure * gradientZ * deltaTime) *
          velocityDamping
        const transportedHeight =
          this.state[index + HEIGHT] - depth * divergence * deltaTime
        const height =
          (transportedHeight +
            (neighborHeight - transportedHeight) * 0.035) *
          heightDamping
        const slopeEnergy = Math.hypot(gradientX, gradientZ)
        const foam = Math.max(
          this.state[index + FOAM] * foamDamping,
          Math.min(1, slopeEnergy * 2.2 + Math.abs(divergence) * 0.4),
        )

        this.nextState[index + HEIGHT] = Math.max(
          -1.25,
          Math.min(1.25, height),
        )
        this.nextState[index + VELOCITY_X] = Math.max(
          -5.5,
          Math.min(5.5, velocityX),
        )
        this.nextState[index + VELOCITY_Z] = Math.max(
          -5.5,
          Math.min(5.5, velocityZ),
        )
        this.nextState[index + FOAM] = foam
      }
    }

    const previous = this.state
    this.state = this.nextState
    this.nextState = previous
  }

  private applyCommand(command: WaterCommand): void {
    const halfSize = this.worldSize * 0.5
    const minX = this.clampIndex(
      Math.floor(((command.position.x - command.radius + halfSize) / this.worldSize) * (this.resolution - 1)),
    )
    const maxX = this.clampIndex(
      Math.ceil(((command.position.x + command.radius + halfSize) / this.worldSize) * (this.resolution - 1)),
    )
    const minZ = this.clampIndex(
      Math.floor(((command.position.z - command.radius + halfSize) / this.worldSize) * (this.resolution - 1)),
    )
    const maxZ = this.clampIndex(
      Math.ceil(((command.position.z + command.radius + halfSize) / this.worldSize) * (this.resolution - 1)),
    )

    for (let z = minZ; z <= maxZ; z++) {
      const worldZ = (z / (this.resolution - 1) - 0.5) * this.worldSize

      for (let x = minX; x <= maxX; x++) {
        const worldX = (x / (this.resolution - 1) - 0.5) * this.worldSize
        const deltaX = worldX - command.position.x
        const deltaZ = worldZ - command.position.z
        const distance = Math.hypot(deltaX, deltaZ)
        if (distance >= command.radius) continue

        const normalizedDistance = distance / command.radius
        const falloff = (1 - normalizedDistance * normalizedDistance) ** 2
        const index = this.offset(x, z, 0)
        const directionLength = Math.max(
          0.00001,
          Math.hypot(command.direction.x, command.direction.z),
        )
        const forwardX = command.direction.x / directionLength
        const forwardZ = command.direction.z / directionLength
        const rightX = forwardZ
        const rightZ = -forwardX
        const normalizedAcross =
          (deltaX * rightX + deltaZ * rightZ) / command.radius

        if (command.kind === 'swell') {
          const crest = Math.exp(
            -Math.pow((normalizedDistance - 0.42) / 0.22, 2),
          )
          this.state[index + HEIGHT] +=
            falloff * (0.48 + crest * 0.42) * command.strength
          this.state[index + VELOCITY_X] +=
            forwardX * falloff * 2.35 * command.strength
          this.state[index + VELOCITY_Z] +=
            forwardZ * falloff * 2.35 * command.strength
          this.state[index + FOAM] = Math.max(
            this.state[index + FOAM],
            Math.max(falloff * 0.48, crest * 0.92) * command.strength,
          )
        } else if (command.kind === 'current') {
          const channel =
            Math.exp(-Math.pow(normalizedAcross / 0.24, 2)) * falloff
          const banks =
            Math.exp(
              -Math.pow(
                (Math.abs(normalizedAcross) - 0.46) / 0.16,
                2,
              ),
            ) * falloff
          this.state[index + HEIGHT] +=
            (banks * 0.22 - channel * 0.1) * command.strength
          this.state[index + VELOCITY_X] +=
            forwardX * falloff * 2.45 * command.strength
          this.state[index + VELOCITY_Z] +=
            forwardZ * falloff * 2.45 * command.strength
          this.state[index + FOAM] = Math.max(
            this.state[index + FOAM],
            Math.max(channel * 0.58, banks * 0.9),
          )
        } else if (command.kind === 'vortex') {
          const inverseDistance = distance > 0.001 ? 1 / distance : 0
          const radialX = deltaX * inverseDistance
          const radialZ = deltaZ * inverseDistance
          const tangentX = -radialZ
          const tangentZ = radialX
          const pull = falloff * 2.65 * command.strength
          const rim = Math.exp(
            -Math.pow((normalizedDistance - 0.68) / 0.14, 2),
          )

          this.state[index + HEIGHT] +=
            (rim * 0.22 - falloff * 0.72) * command.strength
          this.state[index + VELOCITY_X] +=
            (tangentX - radialX * 0.28) * pull
          this.state[index + VELOCITY_Z] +=
            (tangentZ - radialZ * 0.28) * pull
          this.state[index + FOAM] = Math.max(
            this.state[index + FOAM],
            Math.max(falloff * 0.38, rim),
          )
        } else {
          const center =
            Math.exp(-Math.pow(normalizedAcross / 0.2, 2)) * falloff
          const rails =
            Math.exp(
              -Math.pow(
                (Math.abs(normalizedAcross) - 0.48) / 0.13,
                2,
              ),
            ) * falloff

          this.state[index + HEIGHT] +=
            (rails * 0.16 - center * 0.13) * command.strength
          this.state[index + VELOCITY_X] +=
            forwardX * falloff * 0.42 * command.strength
          this.state[index + VELOCITY_Z] +=
            forwardZ * falloff * 0.42 * command.strength
          this.state[index + FOAM] = Math.max(
            this.state[index + FOAM],
            Math.max(rails * 0.96, center * 0.42) * command.strength,
          )
        }
      }
    }
  }

  private sampleDynamic(
    x: number,
    z: number,
  ): {
    height: number
    slopeX: number
    slopeZ: number
    velocityX: number
    velocityZ: number
    foam: number
  } {
    const normalizedX = x / this.worldSize + 0.5
    const normalizedZ = z / this.worldSize + 0.5

    if (
      normalizedX <= 0 ||
      normalizedX >= 1 ||
      normalizedZ <= 0 ||
      normalizedZ >= 1
    ) {
      return {
        height: 0,
        slopeX: 0,
        slopeZ: 0,
        velocityX: 0,
        velocityZ: 0,
        foam: 0,
      }
    }

    const gridX = normalizedX * (this.resolution - 1)
    const gridZ = normalizedZ * (this.resolution - 1)
    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(this.resolution - 1, x0 + 1)
    const z1 = Math.min(this.resolution - 1, z0 + 1)
    const blendX = gridX - x0
    const blendZ = gridZ - z0

    const bilinear = (channel: number): number => {
      const value00 = this.state[this.offset(x0, z0, channel)]
      const value10 = this.state[this.offset(x1, z0, channel)]
      const value01 = this.state[this.offset(x0, z1, channel)]
      const value11 = this.state[this.offset(x1, z1, channel)]
      const lower = value00 + (value10 - value00) * blendX
      const upper = value01 + (value11 - value01) * blendX
      return lower + (upper - lower) * blendZ
    }

    const height = bilinear(HEIGHT)
    const epsilon = this.cellSize
    const heightLeft = this.sampleHeightNearest(x - epsilon, z)
    const heightRight = this.sampleHeightNearest(x + epsilon, z)
    const heightDown = this.sampleHeightNearest(x, z - epsilon)
    const heightUp = this.sampleHeightNearest(x, z + epsilon)

    return {
      height,
      slopeX: (heightRight - heightLeft) / (2 * epsilon),
      slopeZ: (heightUp - heightDown) / (2 * epsilon),
      velocityX: bilinear(VELOCITY_X),
      velocityZ: bilinear(VELOCITY_Z),
      foam: bilinear(FOAM),
    }
  }

  private sampleHeightNearest(x: number, z: number): number {
    const normalizedX = x / this.worldSize + 0.5
    const normalizedZ = z / this.worldSize + 0.5
    if (
      normalizedX < 0 ||
      normalizedX > 1 ||
      normalizedZ < 0 ||
      normalizedZ > 1
    ) {
      return 0
    }

    const gridX = this.clampIndex(Math.round(normalizedX * (this.resolution - 1)))
    const gridZ = this.clampIndex(Math.round(normalizedZ * (this.resolution - 1)))
    return this.state[this.offset(gridX, gridZ, HEIGHT)]
  }
}
