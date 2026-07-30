import * as THREE from 'three'
import type { WaterSampler } from '../water/types'

const DEFAULT_MAX_DISTANCE = 24
const DEFAULT_FALLBACK_DISTANCE = 12
const DEFAULT_SAMPLE_STEP = 0.5
const DEFAULT_WATER_MARGIN = 1
const SURFACE_OFFSET = 0.08

export interface WaterAimOptions {
  readonly maxDistance?: number
  readonly fallbackDistance?: number
  readonly sampleStep?: number
  readonly waterDomainHalfSize?: number
  readonly waterMargin?: number
}

export type WaterHeightSampler = (
  x: number,
  z: number,
  time: number,
) => number

export type WaterAimSource = WaterSampler | WaterHeightSampler

const samplePoint = new THREE.Vector3()
const rayDirection = new THREE.Vector3()
const horizontalDirection = new THREE.Vector3()

function getWaterHeight(
  source: WaterAimSource,
  x: number,
  z: number,
  time: number,
): number {
  return typeof source === 'function'
    ? source(x, z, time)
    : source.sample(x, z, time).height
}

function clampToWaterDomain(
  point: THREE.Vector3,
  waterDomainHalfSize: number | undefined,
  waterMargin: number,
): void {
  if (waterDomainHalfSize === undefined) return

  const limit = Math.max(0, waterDomainHalfSize - waterMargin)
  point.x = THREE.MathUtils.clamp(point.x, -limit, limit)
  point.z = THREE.MathUtils.clamp(point.z, -limit, limit)
}

function setSurfacePoint(
  target: THREE.Vector3,
  x: number,
  z: number,
  source: WaterAimSource,
  time: number,
  waterDomainHalfSize: number | undefined,
  waterMargin: number,
): THREE.Vector3 {
  target.set(x, 0, z)
  clampToWaterDomain(target, waterDomainHalfSize, waterMargin)
  target.y =
    getWaterHeight(source, target.x, target.z, time) + SURFACE_OFFSET
  return target
}

/**
 * Finds the first moving-water crossing along a controller ray. A level or
 * upward ray falls back to a stable surface target in the controller's
 * horizontal direction (or the board's forward direction for a vertical ray).
 */
export function resolveWaterAim(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  fallbackForward: THREE.Vector3,
  source: WaterAimSource,
  time: number,
  target: THREE.Vector3,
  options: WaterAimOptions = {},
): THREE.Vector3 {
  const maxDistance = Math.max(
    0,
    options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  )
  const fallbackDistance = Math.max(
    0,
    options.fallbackDistance ?? DEFAULT_FALLBACK_DISTANCE,
  )
  const sampleStep = Math.max(
    0.001,
    options.sampleStep ?? DEFAULT_SAMPLE_STEP,
  )
  const waterMargin = Math.max(
    0,
    options.waterMargin ?? DEFAULT_WATER_MARGIN,
  )
  rayDirection.copy(direction).normalize()

  let previousDistance = 0
  let previousClearance =
    origin.y - getWaterHeight(source, origin.x, origin.z, time)

  for (
    let distance = sampleStep;
    distance <= maxDistance;
    distance += sampleStep
  ) {
    samplePoint.copy(origin).addScaledVector(rayDirection, distance)
    const clearance =
      samplePoint.y -
      getWaterHeight(source, samplePoint.x, samplePoint.z, time)

    if (clearance <= 0 && previousClearance > 0) {
      let low = previousDistance
      let high = distance

      for (let iteration = 0; iteration < 8; iteration += 1) {
        const midpoint = (low + high) * 0.5
        samplePoint
          .copy(origin)
          .addScaledVector(rayDirection, midpoint)
        const midpointClearance =
          samplePoint.y -
          getWaterHeight(
            source,
            samplePoint.x,
            samplePoint.z,
            time,
          )

        if (midpointClearance > 0) low = midpoint
        else high = midpoint
      }

      samplePoint.copy(origin).addScaledVector(rayDirection, high)
      return setSurfacePoint(
        target,
        samplePoint.x,
        samplePoint.z,
        source,
        time,
        options.waterDomainHalfSize,
        waterMargin,
      )
    }

    previousDistance = distance
    previousClearance = clearance
  }

  horizontalDirection.set(rayDirection.x, 0, rayDirection.z)
  if (horizontalDirection.lengthSq() < 0.01) {
    horizontalDirection.set(
      fallbackForward.x,
      0,
      fallbackForward.z,
    )
  }
  if (horizontalDirection.lengthSq() < 0.01) {
    horizontalDirection.set(0, 0, 1)
  }
  horizontalDirection.normalize()

  return setSurfacePoint(
    target,
    origin.x + horizontalDirection.x * fallbackDistance,
    origin.z + horizontalDirection.z * fallbackDistance,
    source,
    time,
    options.waterDomainHalfSize,
    waterMargin,
  )
}
