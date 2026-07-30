import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { BuoyCourse } from './environment/BuoyCourse'
import { OceanAudioController } from './environment/OceanAudioController'
import { OceanAtmosphere } from './environment/OceanAtmosphere'
import {
  WATER_ABILITIES,
  type WaterAbility,
} from './game/abilities'
import { WaterCommandBus } from './game/WaterCommandBus'
import { HydroboardController } from './player/HydroboardController'
import {
  INITIAL_HYDROBOARD_TELEMETRY,
  type HydroboardTelemetry,
} from './player/hydroboardTelemetry'
import { AbilityBar } from './ui/AbilityBar'
import { PerformanceHud } from './ui/PerformanceHud'
import { CoarseWaterField } from './water/CoarseWaterField'
import { OceanSurface } from './water/OceanSurface'
import { WaterSpellVisualizer } from './water/WaterSpellVisualizer'
import { updateCastingKeys } from './xr/inputState'
import { xrStore } from './xr/store'
import { XRPerformanceMonitor } from './xr/XRPerformanceMonitor'
import { XRStatusPanel } from './xr/XRStatusPanel'

export function App() {
  const [activeAbility, setActiveAbility] = useState<WaterAbility>(
    WATER_ABILITIES[0],
  )
  const [desktopCasting, setDesktopCasting] = useState(false)
  const [vrCasting, setVrCasting] = useState(false)
  const [orbiting, setOrbiting] = useState(false)
  const [telemetry, setTelemetry] = useState<HydroboardTelemetry>(
    INITIAL_HYDROBOARD_TELEMETRY,
  )
  const [entryError, setEntryError] = useState<string | null>(null)
  const castingKeysRef = useRef(new Set<string>())
  const pointerCastingRef = useRef(false)
  const riderPositionRef = useRef<THREE.Vector3 | null>(
    new THREE.Vector3(),
  )
  const isCasting = desktopCasting || vrCasting

  const commandBus = useMemo(() => new WaterCommandBus(), [])
  const gameplayField = useMemo(
    () =>
      new CoarseWaterField({
        resolution: 64,
        worldSize: 180,
        updateRate: 30,
      }),
    [],
  )

  useEffect(() => {
    const syncDesktopCasting = () => {
      setDesktopCasting(
        castingKeysRef.current.size > 0 ||
          pointerCastingRef.current,
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const ability = WATER_ABILITIES.find(
        (candidate) => candidate.key === event.key,
      )
      if (ability !== undefined) setActiveAbility(ability)
      updateCastingKeys(castingKeysRef.current, event.key, true)
      syncDesktopCasting()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      updateCastingKeys(castingKeysRef.current, event.key, false)
      syncDesktopCasting()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0 && event.target instanceof HTMLCanvasElement) {
        pointerCastingRef.current = true
        syncDesktopCasting()
      }
      if (event.button === 2 && event.target instanceof HTMLCanvasElement) {
        setOrbiting(true)
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerCastingRef.current = false
        syncDesktopCasting()
      }
      if (event.button === 2) setOrbiting(false)
    }

    const preventCanvasMenu = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) event.preventDefault()
    }

    const resetDesktopInput = () => {
      castingKeysRef.current.clear()
      pointerCastingRef.current = false
      setDesktopCasting(false)
      setOrbiting(false)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') resetDesktopInput()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    window.addEventListener('contextmenu', preventCanvasMenu)
    window.addEventListener('blur', resetDesktopInput)
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('contextmenu', preventCanvasMenu)
      window.removeEventListener('blur', resetDesktopInput)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [])

  async function enterVr(): Promise<void> {
    setEntryError(null)
    try {
      const session = await xrStore.enterVR()
      if (session === undefined) {
        setEntryError('Immersive VR is not available in this browser.')
      }
    } catch (error) {
      setEntryError(
        error instanceof Error ? error.message : 'The VR session was rejected.',
      )
    }
  }

  return (
    <main className="app-shell">
      <header className="intro-panel overlay-panel">
        <p className="eyebrow">Quest hydrofoil prototype</p>
        <h1>TideVR</h1>
        <p className="tagline">Conduct the ocean. Ride the consequences.</p>
        <div className="control-summary">
          <span><b>Move</b> Left stick / WASD</span>
          <span><b>Aim</b> Right controller / mouse</span>
          <span><b>Shape water</b> Trigger / click / E</span>
        </div>
        <button type="button" className="enter-vr-button" onClick={enterVr}>
          Enter VR
        </button>
        {entryError !== null && <p className="entry-error">{entryError}</p>}
      </header>

      <aside
        className="active-ability-card overlay-panel"
        data-casting={isCasting}
      >
        <span className="ability-orb" style={{ background: activeAbility.color }} />
        <div>
          <small>{activeAbility.waterEffect}</small>
          <strong>{activeAbility.movementUse}</strong>
        </div>
      </aside>

      <PerformanceHud />
      <OceanAudioController telemetry={telemetry} />
      <AbilityBar
        activeAbility={activeAbility}
        onSelectAbility={setActiveAbility}
      />

      <Canvas
        camera={{ position: [0, 5, -53], fov: 54, near: 0.05, far: 500 }}
        dpr={[1, 1.25]}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        shadows={false}
      >
        <XR store={xrStore}>
          <color attach="background" args={['#355d70']} />
          <OceanAtmosphere />
          <OceanSurface
            commandBus={commandBus}
            gameplayField={gameplayField}
          />
          <WaterSpellVisualizer
            commandBus={commandBus}
            water={gameplayField}
          />
          <BuoyCourse water={gameplayField} />
          <HydroboardController
            activeAbility={activeAbility}
            commandBus={commandBus}
            desktopCasting={desktopCasting}
            followCamera={!orbiting}
            onSelectAbility={setActiveAbility}
            onTelemetry={setTelemetry}
            onVrCastingChange={setVrCasting}
            riderPositionRef={riderPositionRef}
            water={gameplayField}
            waterDomainHalfSize={gameplayField.worldSize * 0.5}
          />
          <XRStatusPanel
            activeAbility={activeAbility}
            telemetry={telemetry}
            riderPositionRef={riderPositionRef}
          />
          <XRPerformanceMonitor />
          <OrbitControls
            enableDamping
            enablePan={false}
            mouseButtons={{
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
            minDistance={4}
            maxDistance={28}
            maxPolarAngle={Math.PI * 0.48}
          />
        </XR>
      </Canvas>
    </main>
  )
}
