import { describe, expect, it, vi } from 'vitest'
import {
  getPerformanceStatsSnapshot,
  publishPerformanceStats,
  subscribePerformanceStats,
  summarizeFrameTimes,
  type PerformanceStats,
} from './performanceStats'

describe('render-loop performance statistics', () => {
  it('returns zeroes before any frame has been sampled', () => {
    expect(summarizeFrameTimes([])).toEqual({
      fps: 0,
      averageFrameMs: 0,
      p95FrameMs: 0,
    })
  })

  it('reports average FPS and a nearest-rank p95 frame time', () => {
    const stats = summarizeFrameTimes([10, 11, 12, 13, 40])

    expect(stats.averageFrameMs).toBeCloseTo(17.2)
    expect(stats.fps).toBeCloseTo(1000 / 17.2)
    expect(stats.p95FrameMs).toBe(40)
  })

  it('publishes stats without requiring the canvas owner to re-render', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePerformanceStats(listener)
    const stats: PerformanceStats = {
      fps: 72,
      averageFrameMs: 13.9,
      p95FrameMs: 14.2,
      foveation: 0.5,
      refreshRate: 72,
      projectionWidth: 3360,
      projectionHeight: 1760,
      isPresenting: true,
    }

    publishPerformanceStats(stats)

    expect(listener).toHaveBeenCalledOnce()
    expect(getPerformanceStatsSnapshot()).toBe(stats)
    unsubscribe()
  })
})
