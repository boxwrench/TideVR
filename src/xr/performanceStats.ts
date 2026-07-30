export interface PerformanceStats {
  readonly fps: number
  readonly averageFrameMs: number
  readonly p95FrameMs: number
  readonly foveation: number | undefined
  readonly refreshRate: number | undefined
  readonly projectionWidth: number
  readonly projectionHeight: number
  readonly isPresenting: boolean
}

export const INITIAL_PERFORMANCE_STATS: PerformanceStats = {
  fps: 0,
  averageFrameMs: 0,
  p95FrameMs: 0,
  foveation: undefined,
  refreshRate: undefined,
  projectionWidth: 0,
  projectionHeight: 0,
  isPresenting: false,
}

let latestPerformanceStats = INITIAL_PERFORMANCE_STATS
const performanceStatsListeners = new Set<() => void>()

export function getPerformanceStatsSnapshot(): PerformanceStats {
  return latestPerformanceStats
}

export function publishPerformanceStats(stats: PerformanceStats): void {
  latestPerformanceStats = stats
  performanceStatsListeners.forEach((listener) => listener())
}

export function subscribePerformanceStats(listener: () => void): () => void {
  performanceStatsListeners.add(listener)
  return () => performanceStatsListeners.delete(listener)
}

export function summarizeFrameTimes(frameTimesMs: readonly number[]): {
  fps: number
  averageFrameMs: number
  p95FrameMs: number
} {
  if (frameTimesMs.length === 0) {
    return { fps: 0, averageFrameMs: 0, p95FrameMs: 0 }
  }

  const averageFrameMs =
    frameTimesMs.reduce((sum, value) => sum + value, 0) /
    frameTimesMs.length
  const sorted = [...frameTimesMs].sort((a, b) => a - b)
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)

  return {
    fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
    averageFrameMs,
    p95FrameMs: sorted[p95Index],
  }
}
