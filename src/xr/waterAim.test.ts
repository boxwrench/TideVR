import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { WaterSample, WaterSampler } from '../water/types'
import { resolveWaterAim } from './waterAim'

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
