import { useEffect, useRef } from 'react'
import type { HydroboardTelemetry } from '../player/hydroboardTelemetry'

export interface OceanAudioControllerProps {
  readonly telemetry: HydroboardTelemetry
}

interface OceanAudioGraph {
  readonly context: AudioContext
  readonly source: AudioBufferSourceNode
  readonly windFilter: BiquadFilterNode
  readonly windGain: GainNode
  readonly waterFilter: BiquadFilterNode
  readonly waterGain: GainNode
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const frameCount = Math.floor(context.sampleRate * 2)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const output = buffer.getChannelData(0)

  for (let index = 0; index < frameCount; index++) {
    output[index] = Math.random() * 2 - 1
  }
  return buffer
}

function createAudioGraph(): OceanAudioGraph {
  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext: typeof AudioContext
      }
    ).webkitAudioContext
  const context = new AudioContextClass()
  const source = context.createBufferSource()
  source.buffer = createNoiseBuffer(context)
  source.loop = true

  const windFilter = context.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.setValueAtTime(280, context.currentTime)
  windFilter.Q.setValueAtTime(0.55, context.currentTime)
  const windGain = context.createGain()
  windGain.gain.setValueAtTime(0.025, context.currentTime)

  const waterFilter = context.createBiquadFilter()
  waterFilter.type = 'bandpass'
  waterFilter.frequency.setValueAtTime(1250, context.currentTime)
  waterFilter.Q.setValueAtTime(0.75, context.currentTime)
  const waterGain = context.createGain()
  waterGain.gain.setValueAtTime(0, context.currentTime)

  source.connect(windFilter)
  windFilter.connect(windGain)
  windGain.connect(context.destination)
  source.connect(waterFilter)
  waterFilter.connect(waterGain)
  waterGain.connect(context.destination)
  source.start()

  return {
    context,
    source,
    windFilter,
    windGain,
    waterFilter,
    waterGain,
  }
}

function updateAudioGraph(
  graph: OceanAudioGraph,
  telemetry: HydroboardTelemetry,
): void {
  const normalizedSpeed = clamp01(telemetry.speed / 26)
  const carving = clamp01(telemetry.carvingIntensity)
  const contactAmount =
    telemetry.contactState === 'water'
      ? 1
      : telemetry.contactState === 'landing'
        ? 0.85
        : 0.04
  const now = graph.context.currentTime

  graph.windFilter.frequency.setTargetAtTime(
    260 + normalizedSpeed * 1350,
    now,
    0.12,
  )
  graph.windGain.gain.setTargetAtTime(
    0.02 + normalizedSpeed * 0.19,
    now,
    0.12,
  )

  graph.waterFilter.frequency.setTargetAtTime(
    850 + normalizedSpeed * 1700 + carving * 650,
    now,
    0.08,
  )
  const planingWash =
    telemetry.speed > 0.8
      ? contactAmount *
        (0.012 + normalizedSpeed * 0.1) *
        (0.45 + carving * 0.95)
      : 0
  graph.waterGain.gain.setTargetAtTime(planingWash, now, 0.07)
}

/**
 * Procedural wind and hydroboard wash synthesized with the Web Audio API.
 *
 * Mount this outside the R3F canvas and pass controller telemetry at a modest
 * cadence. The first pointer or keyboard gesture unlocks audio in browsers.
 */
export function OceanAudioController({
  telemetry,
}: OceanAudioControllerProps) {
  const graphRef = useRef<OceanAudioGraph | null>(null)
  const telemetryRef = useRef(telemetry)
  telemetryRef.current = telemetry

  useEffect(() => {
    const handleUserGesture = () => {
      try {
        graphRef.current ??= createAudioGraph()
        updateAudioGraph(graphRef.current, telemetryRef.current)
        if (graphRef.current.context.state === 'suspended') {
          void graphRef.current.context.resume()
        }
      } catch {
        // Web Audio may be unavailable or blocked by browser policy.
      }
    }

    window.addEventListener('pointerdown', handleUserGesture)
    window.addEventListener('keydown', handleUserGesture)

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture)
      window.removeEventListener('keydown', handleUserGesture)
      const graph = graphRef.current
      graphRef.current = null
      if (graph !== null) {
        try {
          graph.source.stop()
        } catch {
          // The source may already have stopped while the context was closing.
        }
        void graph.context.close()
      }
    }
  }, [])

  useEffect(() => {
    const graph = graphRef.current
    if (graph === null) return
    updateAudioGraph(graph, telemetry)
  }, [telemetry])

  return null
}
