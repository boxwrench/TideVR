import { useSyncExternalStore } from 'react'
import {
  getPerformanceStatsSnapshot,
  subscribePerformanceStats,
} from '../xr/performanceStats'

export function PerformanceHud() {
  const stats = useSyncExternalStore(
    subscribePerformanceStats,
    getPerformanceStatsSnapshot,
    getPerformanceStatsSnapshot,
  )
  const visible =
    new URLSearchParams(window.location.search).get('dev') === '1'
  if (!visible) return null

  const fps = Math.round(stats.fps)
  const healthClass =
    fps >= 70 ? 'healthy' : fps >= 60 ? 'warning' : 'slow'
  const refresh =
    stats.refreshRate === undefined
      ? '--'
      : `${stats.refreshRate.toFixed(0)} Hz`
  const foveation =
    stats.foveation === undefined
      ? '--'
      : stats.foveation.toFixed(2)

  return (
    <aside className="performance-hud overlay-panel" aria-label="Performance">
      <div>
        <span>Session</span>
        <strong>{stats.isPresenting ? `XR ${refresh}` : 'Desktop'}</strong>
      </div>
      <div>
        <span>Frame rate</span>
        <strong className={healthClass}>{fps > 0 ? `${fps} fps` : '--'}</strong>
      </div>
      <div>
        <span>Average / p95</span>
        <strong>
          {stats.averageFrameMs.toFixed(1)} / {stats.p95FrameMs.toFixed(1)} ms
        </strong>
      </div>
      <div>
        <span>FFR / projection</span>
        <strong>
          {foveation} · {stats.projectionWidth || '--'}×
          {stats.projectionHeight || '--'}
        </strong>
      </div>
      <div>
        <span>Water fields</span>
        <strong>512² / 64² · 30 Hz</strong>
      </div>
    </aside>
  )
}
