import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { WaterAbility } from '../game/abilities'
import type { HydroboardTelemetry } from '../player/hydroboardTelemetry'

export interface XRStatusPanelProps {
  readonly activeAbility: WaterAbility
  readonly telemetry: HydroboardTelemetry
  readonly riderPositionRef: RefObject<THREE.Vector3 | null>
}

function contactLabel(telemetry: HydroboardTelemetry): string {
  switch (telemetry.contactState) {
    case 'water':
      return 'WATER'
    case 'airborne':
      return 'AIRBORNE'
    case 'landing':
      return 'LANDING'
  }
}

function drawStatusPanel(
  canvas: HTMLCanvasElement,
  activeAbility: WaterAbility,
  telemetry: HydroboardTelemetry,
): void {
  const context = canvas.getContext('2d')
  if (context === null) return

  const charge =
    telemetry.charge === undefined
      ? undefined
      : THREE.MathUtils.clamp(telemetry.charge, 0, 1)

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(3, 23, 34, 0.91)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = activeAbility.color
  context.lineWidth = 10
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)

  context.fillStyle = '#9bddea'
  context.font = '600 27px system-ui, sans-serif'
  context.fillText('WATER ABILITY', 34, 47)
  context.fillStyle = '#ffffff'
  context.font = '700 48px system-ui, sans-serif'
  context.fillText(activeAbility.name.toUpperCase(), 34, 103)

  context.fillStyle = '#b7d4dc'
  context.font = '600 23px system-ui, sans-serif'
  context.fillText(`SPEED  ${telemetry.speed.toFixed(1)} m/s`, 34, 151)
  context.fillText(
    `AIM  ${telemetry.aimDistance.toFixed(0)} m   BEACON  ${telemetry.beaconDistance.toFixed(0)} m`,
    34,
    185,
  )
  context.fillText(`CONTACT  ${contactLabel(telemetry)}`, 340, 151)

  context.fillStyle = telemetry.isCasting
    ? activeAbility.color
    : 'rgba(100, 116, 139, 0.52)'
  context.fillRect(590, 40, 270, 112)
  context.fillStyle = telemetry.isCasting ? '#031722' : '#d7e4ec'
  context.font = '800 39px system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText(telemetry.isCasting ? 'CASTING' : 'READY', 725, 108)

  if (charge !== undefined) {
    context.fillStyle = 'rgba(148, 163, 184, 0.34)'
    context.fillRect(590, 174, 270, 24)
    context.fillStyle = activeAbility.color
    context.fillRect(590, 174, 270 * charge, 24)
  }
  context.textAlign = 'start'
}

export function XRStatusPanel({
  activeAbility,
  telemetry,
  riderPositionRef,
}: XRStatusPanelProps) {
  const session = useXR((state) => state.session)
  const spriteRef = useRef<THREE.Sprite>(null)
  const canvas = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = 896
    element.height = 224
    return element
  }, [])
  const texture = useMemo(() => {
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.generateMipmaps = false
    result.minFilter = THREE.LinearFilter
    return result
  }, [canvas])

  useEffect(() => {
    drawStatusPanel(canvas, activeAbility, telemetry)
    texture.needsUpdate = true
  }, [activeAbility, canvas, telemetry, texture])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(() => {
    if (spriteRef.current === null || riderPositionRef.current === null) return
    spriteRef.current.position.copy(riderPositionRef.current)
    spriteRef.current.position.x += 1.5
    spriteRef.current.position.y += 2.45
  })

  if (session === undefined) return null

  return (
    <sprite ref={spriteRef} scale={[2.8, 0.7, 1]} renderOrder={9000}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}
