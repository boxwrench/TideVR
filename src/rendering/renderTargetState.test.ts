import type * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  withPreservedRenderTarget,
  type RenderTargetStateRenderer,
} from './renderTargetState'

describe('offscreen render target preservation', () => {
  it('restores the active XR target and subresource after offscreen passes', () => {
    const xrTarget = {} as THREE.WebGLRenderTarget
    const setRenderTarget = vi.fn()
    const xr = { enabled: true } as THREE.WebXRManager
    const renderer: RenderTargetStateRenderer = {
      getRenderTarget: () => xrTarget,
      getActiveCubeFace: () => 2,
      getActiveMipmapLevel: () => 3,
      setRenderTarget,
      xr,
    }

    withPreservedRenderTarget(renderer, () => {
      expect(xr.enabled).toBe(false)
      setRenderTarget({} as THREE.WebGLRenderTarget)
    })

    expect(setRenderTarget).toHaveBeenLastCalledWith(xrTarget, 2, 3)
    expect(xr.enabled).toBe(true)
  })

  it('restores the active target and XR state when an offscreen pass fails', () => {
    const xrTarget = {} as THREE.WebGLRenderTarget
    const setRenderTarget = vi.fn()
    const xr = { enabled: true } as THREE.WebXRManager
    const renderer: RenderTargetStateRenderer = {
      getRenderTarget: () => xrTarget,
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      setRenderTarget,
      xr,
    }

    expect(() =>
      withPreservedRenderTarget(renderer, () => {
        expect(xr.enabled).toBe(false)
        throw new Error('shader failed')
      }),
    ).toThrow('shader failed')
    expect(setRenderTarget).toHaveBeenLastCalledWith(xrTarget, 0, 0)
    expect(xr.enabled).toBe(true)
  })

  it('restores XR state when restoring the active target fails', () => {
    const xr = { enabled: true } as THREE.WebXRManager
    const renderer: RenderTargetStateRenderer = {
      getRenderTarget: () => null,
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      setRenderTarget: vi.fn(() => {
        throw new Error('target restore failed')
      }),
      xr,
    }

    expect(() => withPreservedRenderTarget(renderer, () => undefined)).toThrow(
      'target restore failed',
    )
    expect(xr.enabled).toBe(true)
  })

  it('preserves an already disabled XR state', () => {
    const xr = { enabled: false } as THREE.WebXRManager
    const renderer: RenderTargetStateRenderer = {
      getRenderTarget: () => null,
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      setRenderTarget: vi.fn(),
      xr,
    }

    withPreservedRenderTarget(renderer, () => {
      expect(xr.enabled).toBe(false)
    })

    expect(xr.enabled).toBe(false)
  })
})
