import type * as THREE from 'three'

export type RenderTargetStateRenderer = Pick<
  THREE.WebGLRenderer,
  | 'getActiveCubeFace'
  | 'getActiveMipmapLevel'
  | 'getRenderTarget'
  | 'setRenderTarget'
  | 'xr'
>

/**
 * Offscreen GPU passes must temporarily opt out of WebXR camera substitution
 * and restore Three.js' active target. Otherwise an immersive session replaces
 * the simulation camera with the stereo XR camera and leaves compute textures
 * unchanged.
 */
export function withPreservedRenderTarget(
  renderer: RenderTargetStateRenderer,
  renderPasses: () => void,
): void {
  const target = renderer.getRenderTarget()
  const activeCubeFace = renderer.getActiveCubeFace()
  const activeMipmapLevel = renderer.getActiveMipmapLevel()
  const xrEnabled = renderer.xr.enabled

  renderer.xr.enabled = false
  try {
    renderPasses()
  } finally {
    try {
      renderer.setRenderTarget(target, activeCubeFace, activeMipmapLevel)
    } finally {
      renderer.xr.enabled = xrEnabled
    }
  }
}
