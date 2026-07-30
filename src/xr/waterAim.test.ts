import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { WaterSample, WaterSampler } from '../water/types'
import {
  WATER_AIM_UPDATE_RATE,
  createWaterAimThrottleState,
  resolveWaterAim,
  stepWaterAimThrottle,
} from './waterAim'

const levelWater = () => 0

describe('water-aware ability aiming', () => {
  it('finds a downward controller-ray intersection with the water', () => {
    const target = resolveWaterAim(
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, -1, 1).normalize(),
      new THREE.Vector3(0, 0, 1),
      levelWater,
      0,
      new THREE.Vector3(),
    )

    expect(target.x).toBeCloseTo(0)
    expect(target.z).toBeCloseTo(2, 1)
    expect(target.y).toBeCloseTo(0.08)
  })

  it('ray-marches against the water height at the supplied time', () => {
    const sampleHeight = vi.fn(
      (_x: number, _z: number, time: number) => time,
    )
    const target = resolveWaterAim(
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -1, 1).normalize(),
      new THREE.Vector3(0, 0, 1),
      sampleHeight,
      1,
      new THREE.Vector3(),
    )

    expect(target.z).toBeCloseTo(2, 1)
    expect(target.y).toBeCloseTo(1.08)
    expect(sampleHeight).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      1,
    )
  })

  it('accepts a WaterSampler as its height source', () => {
    const sample: WaterSample = {
      height: 0.75,
      normal: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, z: 0 },
      turbulence: 0,
    }
    const source: WaterSampler = {
      sample: vi.fn(() => sample),
    }
    const target = resolveWaterAim(
      new THREE.Vector3(2, 2, 3),
      new THREE.Vector3(1, 0.2, 0),
      new THREE.Vector3(0, 0, 1),
      source,
      4,
      new THREE.Vector3(),
      { fallbackDistance: 8 },
    )

    expect(target.x).toBeCloseTo(10)
    expect(target.z).toBeCloseTo(3)
    expect(target.y).toBeCloseTo(0.83)
    expect(source.sample).toHaveBeenCalledWith(10, 3, 4)
  })

  it('uses board heading for a vertical fallback and stays in the water domain', () => {
    const target = resolveWaterAim(
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-1, 0, 0),
      levelWater,
      0,
      new THREE.Vector3(),
      {
        fallbackDistance: 10,
        waterDomainHalfSize: 6,
        waterMargin: 1,
      },
    )

    expect(target.x).toBe(-5)
    expect(target.z).toBeCloseTo(0)
    expect(target.y).toBeCloseTo(0.08)
  })

  it('clamps a ray intersection before sampling the final surface point', () => {
    const sampleHeight = vi.fn(() => 0)
    const target = resolveWaterAim(
      new THREE.Vector3(4, 2, 0),
      new THREE.Vector3(1, -1, 0).normalize(),
      new THREE.Vector3(0, 0, 1),
      sampleHeight,
      0,
      new THREE.Vector3(),
      { waterDomainHalfSize: 5, waterMargin: 1 },
    )

    expect(target.x).toBe(4)
    expect(target.z).toBe(0)
    expect(sampleHeight).toHaveBeenLastCalledWith(4, 0, 0)
  })
})

describe('water-aim update throttle', () => {
  it('updates immediately, then waits for the 30 Hz interval', () => {
    const first = stepWaterAimThrottle(
      createWaterAimThrottleState(),
      1 / 72,
    )
    expect(first.shouldUpdate).toBe(true)

    const second = stepWaterAimThrottle(first.state, 1 / 72)
    expect(second.shouldUpdate).toBe(false)

    const third = stepWaterAimThrottle(second.state, 1 / 72)
    expect(third.shouldUpdate).toBe(false)

    const fourth = stepWaterAimThrottle(third.state, 1 / 72)
    expect(fourth.shouldUpdate).toBe(true)
  })

  it.each([72, 80, 90, 120])(
    'averages 30 updates over one second at %i Hz',
    (renderRate) => {
      let state = createWaterAimThrottleState()
      let updates = 0

      for (let frame = 0; frame < renderRate; frame += 1) {
        const step = stepWaterAimThrottle(
          state,
          1 / renderRate,
        )
        state = step.state
        if (step.shouldUpdate) updates += 1
      }

      expect(updates).toBe(WATER_AIM_UPDATE_RATE)
    },
  )

  it('collapses a hitch to one update and preserves the remainder', () => {
    const initialized = stepWaterAimThrottle(
      createWaterAimThrottleState(),
      0,
    )
    const hitched = stepWaterAimThrottle(
      initialized.state,
      0.105,
    )

    expect(hitched.shouldUpdate).toBe(true)
    expect(hitched.state.accumulator).toBeCloseTo(0.005)
  })

  it('ignores negative deltas and falls back from an invalid rate', () => {
    const initialized = stepWaterAimThrottle(
      createWaterAimThrottleState(),
      0,
    )
    const negative = stepWaterAimThrottle(
      initialized.state,
      -1,
    )
    expect(negative).toEqual({
      state: { initialized: true, accumulator: 0 },
      shouldUpdate: false,
    })

    const fallback = stepWaterAimThrottle(
      negative.state,
      1 / WATER_AIM_UPDATE_RATE,
      0,
    )
    expect(fallback.shouldUpdate).toBe(true)
  })
})
