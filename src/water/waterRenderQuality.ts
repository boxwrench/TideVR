export type WaterRenderQuality = 'low' | 'medium' | 'high'

export interface WaterRenderQualitySettings {
  readonly nearSegments: number
  readonly farVertexSpacing: number
}

/**
 * Render-only water quality tiers. They deliberately do not alter the GPU or
 * CPU simulation resolution, so changing tiers cannot desynchronize gameplay.
 *
 * Approximate combined vertex counts for a 180 m near / 900 m far ocean:
 * low 15k, medium 34k, high 60k.
 */
export const WATER_RENDER_QUALITY_SETTINGS: Readonly<
  Record<WaterRenderQuality, WaterRenderQualitySettings>
> = {
  low: {
    nearSegments: 96,
    farVertexSpacing: 12,
  },
  medium: {
    nearSegments: 144,
    farVertexSpacing: 8,
  },
  high: {
    nearSegments: 192,
    farVertexSpacing: 6,
  },
}

export const DEFAULT_WATER_RENDER_QUALITY: WaterRenderQuality =
  'medium'

export function resolveWaterRenderQuality(
  value: string | null | undefined,
): WaterRenderQuality {
  return value === 'low' || value === 'medium' || value === 'high'
    ? value
    : DEFAULT_WATER_RENDER_QUALITY
}
