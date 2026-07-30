import { useFrame, useThree } from '@react-three/fiber'
import {
  useXR,
  useXRInputSourceState,
  XROrigin,
} from '@react-three/xr'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WaterAbility } from '../game/abilities'
import { WATER_ABILITIES } from '../game/abilities'
import type { WaterCommandBus } from '../game/WaterCommandBus'
import type { WaterSampler } from '../water/types'
import type {
  HydroboardContactState,
  HydroboardTelemetry,
} from './hydroboardTelemetry'
import { getXrChaseYaw } from '../xr/chaseCamera'
import {
  createMovementKeyState,
  resetMovementKeys,
  sampleQuestInput,
  shouldEmitTelemetry,
  updateMovementKey,
} from '../xr/inputState'
import {
  createLoopTransitionState,
  LOOP_REBASE_DISTANCE,
  rebaseLoopCoordinate,
  stepLoopTransition,
} from '../xr/loopTransition'
import { resolveWaterAim } from '../xr/waterAim'

interface HydroboardControllerProps {
  readonly activeAbility: WaterAbility
  readonly commandBus: WaterCommandBus
  readonly desktopCasting: boolean
  readonly followCamera: boolean
  readonly onSelectAbility: (ability: WaterAbility) => void
  readonly onTelemetry?: (telemetry: HydroboardTelemetry) => void
  readonly onVrCastingChange?: (casting: boolean) => void
  readonly riderPositionRef: React.RefObject<THREE.Vector3 | null>
  readonly water: WaterSampler
  readonly waterDomainHalfSize: number
}

const BOARD_HALF_LENGTH = 1.25
const BOARD_HALF_WIDTH = 0.34
const WATER_CLEARANCE = 0.16
const START_Z = -45
const BEACON_Z = 62

function drawDistanceMarker(
  canvas: HTMLCanvasElement,
  distance: number,
  ability: WaterAbility,
): void {
  const context = canvas.getContext('2d')
  if (context === null) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(2, 20, 29, 0.88)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = ability.color
  context.lineWidth = 7
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  context.font = '800 56px system-ui, sans-serif'
  context.fillText(`${Math.round(distance)} m`, canvas.width * 0.5, 65)
  context.fillStyle = ability.color
  context.font = '700 25px system-ui, sans-serif'
  context.fillText(ability.name.toUpperCase(), canvas.width * 0.5, 103)
}

export function HydroboardController({
  activeAbility,
  commandBus,
  desktopCasting,
  followCamera,
  onSelectAbility,
  onTelemetry,
  onVrCastingChange,
  riderPositionRef,
  water,
  waterDomainHalfSize,
}: HydroboardControllerProps) {
  const { camera, gl, pointer, raycaster } = useThree()
  const session = useXR((state) => state.session)
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  const initialWaterHeight = water.sample(0, START_Z, 0).height
  const position = useRef(
    new THREE.Vector3(0, initialWaterHeight + WATER_CLEARANCE, START_Z),
  )
  const velocity = useRef(new THREE.Vector3(0, 0, 5.5))
  const heading = useRef(0)
  const verticalVelocity = useRef(0)
  const contactState = useRef<HydroboardContactState>('water')
  const landingTimer = useRef(0)
  const launchCooldown = useRef(0)
  const loopTransition = useRef(createLoopTransitionState())

  const chargeTime = useRef(0)
  const wasCasting = useRef(false)
  const lastPaintTime = useRef(-1)
  const lastWakeTime = useRef(-1)
  const lastAbilityId = useRef(activeAbility.id)
  const lastAbilityChangeTime = useRef(0)
  const lastVrCasting = useRef(false)
  const lastTelemetry = useRef<HydroboardTelemetry | undefined>(undefined)
  const lastTelemetryTime = useRef(0)
  const aimTarget = useRef(new THREE.Vector3(0, 0, -34))
  const aimDirection = useRef(new THREE.Vector2(0, 1))

  const keys = useRef(createMovementKeyState())

  const characterRef = useRef<THREE.Group>(null)
  const riderVisualRef = useRef<THREE.Group>(null)
  const aimReticleRef = useRef<THREE.Group>(null)
  const aimGuideRef = useRef<THREE.Mesh>(null)
  const aimDistanceSpriteRef = useRef<THREE.Sprite>(null)
  const lastAimDistanceLabel = useRef('')
  const xrOriginRef = useRef<THREE.Group>(null)
  const xrOriginPosition = useRef(new THREE.Vector3(0, 3.5, -52))
  const xrOriginYaw = useRef(getXrChaseYaw(0))
  const transitionVeilRef = useRef<THREE.Mesh>(null)
  const transitionVeilMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const aimDistanceCanvas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 120
    return canvas
  }, [])
  const aimDistanceTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(aimDistanceCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    return texture
  }, [aimDistanceCanvas])

  const scratch = useRef({
    moveDirection: new THREE.Vector3(),
    rightDirection: new THREE.Vector3(),
    currentVelocity: new THREE.Vector3(),
    cameraOffset: new THREE.Vector3(),
    cameraTarget: new THREE.Vector3(),
    rayOrigin: new THREE.Vector3(),
    rayDirection: new THREE.Vector3(),
    surfaceNormal: new THREE.Vector3(),
    activeCameraPosition: new THREE.Vector3(),
    aimGuideVector: new THREE.Vector3(),
    aimGuideUp: new THREE.Vector3(0, 1, 0),
  })

  useEffect(
    () => () => aimDistanceTexture.dispose(),
    [aimDistanceTexture],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      updateMovementKey(keys.current, event.key, true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      updateMovementKey(keys.current, event.key, false)
    }

    const resetInput = () => resetMovementKeys(keys.current)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') resetInput()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', resetInput)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', resetInput)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (session !== undefined) return
    lastVrCasting.current = false
    onVrCastingChange?.(false)
  }, [onVrCastingChange, session])

  useEffect(
    () => () => onVrCastingChange?.(false),
    [onVrCastingChange],
  )

  useFrame(({ clock }, rawDeltaTime) => {
    const deltaTime = Math.min(rawDeltaTime, 0.05)
    const time = clock.elapsedTime
    const leftGamepad = leftController?.inputSource?.gamepad
    const rightGamepad = rightController?.inputSource?.gamepad

    const questInput = sampleQuestInput(leftGamepad, rightGamepad)
    let turnInput = questInput.turn
    let throttleInput = questInput.forward
    let boostInput = questInput.boost || keys.current.boost
    const now = performance.now()

    if (
      questInput.cycleAbility &&
      now - lastAbilityChangeTime.current > 350
    ) {
      lastAbilityChangeTime.current = now
      const currentIndex = WATER_ABILITIES.findIndex(
        (ability) => ability.id === activeAbility.id,
      )
      onSelectAbility(
        WATER_ABILITIES[
          (currentIndex + 1) % WATER_ABILITIES.length
        ],
      )
    }

    if (keys.current.left) turnInput = -1
    if (keys.current.right) turnInput = 1
    if (keys.current.forward) throttleInput = 1
    if (keys.current.backward) throttleInput = -0.65
    if (keys.current.boost) boostInput = true

    if (questInput.casting !== lastVrCasting.current) {
      lastVrCasting.current = questInput.casting
      onVrCastingChange?.(questInput.casting)
    }

    const moveDirection = scratch.current.moveDirection.set(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    const rightDirection = scratch.current.rightDirection.set(
      Math.cos(heading.current),
      0,
      -Math.sin(heading.current),
    )

    const forceSample = water.sample(position.current.x, position.current.z, time)
    const speedBeforeForces = Math.hypot(velocity.current.x, velocity.current.z)
    const steeringAuthority = THREE.MathUtils.lerp(
      0.7,
      1.65,
      Math.min(1, speedBeforeForces / 14),
    )
    heading.current += turnInput * steeringAuthority * deltaTime

    velocity.current.addScaledVector(
      moveDirection,
      throttleInput * (boostInput ? 15.5 : 11.5) * deltaTime,
    )
    velocity.current.x +=
      (forceSample.normal.x / Math.max(0.3, forceSample.normal.y)) *
      4.2 *
      deltaTime
    velocity.current.z +=
      (forceSample.normal.z / Math.max(0.3, forceSample.normal.y)) *
      4.2 *
      deltaTime

    scratch.current.currentVelocity.set(
      forceSample.velocity.x,
      0,
      forceSample.velocity.z,
    )
    velocity.current.addScaledVector(
      scratch.current.currentVelocity,
      1.55 * deltaTime,
    )

    const lateralSpeed = velocity.current.dot(rightDirection)
    velocity.current.addScaledVector(
      rightDirection,
      -lateralSpeed * Math.min(1, 3.4 * deltaTime),
    )
    velocity.current.multiplyScalar(Math.exp(-0.34 * deltaTime))

    const horizontalSpeed = Math.hypot(
      velocity.current.x,
      velocity.current.z,
    )
    const maxSpeed = boostInput ? 28 : 24
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed
      velocity.current.x *= scale
      velocity.current.z *= scale
    }

    position.current.x += velocity.current.x * deltaTime
    position.current.z += velocity.current.z * deltaTime
    if (Math.abs(position.current.x) > 76) {
      position.current.x = THREE.MathUtils.clamp(position.current.x, -76, 76)
      velocity.current.x *= -0.25
    }

    const transition = stepLoopTransition(
      loopTransition.current,
      deltaTime,
      position.current.z,
    )
    loopTransition.current = transition.state
    if (transition.shouldRebase) {
      position.current.z = rebaseLoopCoordinate(position.current.z)
      aimTarget.current.z = rebaseLoopCoordinate(aimTarget.current.z)
      if (session !== undefined) {
        xrOriginPosition.current.z = rebaseLoopCoordinate(
          xrOriginPosition.current.z,
        )
        if (xrOriginRef.current !== null) {
          xrOriginRef.current.position.z = rebaseLoopCoordinate(
            xrOriginRef.current.position.z,
          )
        }
      } else {
        camera.position.z = rebaseLoopCoordinate(camera.position.z)
      }
    } else if (position.current.z < -76) {
      position.current.z += LOOP_REBASE_DISTANCE
      aimTarget.current.z += LOOP_REBASE_DISTANCE
      if (session !== undefined) {
        xrOriginPosition.current.z += LOOP_REBASE_DISTANCE
        if (xrOriginRef.current !== null) {
          xrOriginRef.current.position.z += LOOP_REBASE_DISTANCE
        }
      } else {
        camera.position.z += LOOP_REBASE_DISTANCE
      }
    }
    if (transitionVeilMaterialRef.current !== null) {
      transitionVeilMaterialRef.current.opacity = transition.opacity
    }
    if (transitionVeilRef.current !== null) {
      transitionVeilRef.current.visible = transition.opacity > 0
    }

    moveDirection.set(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    rightDirection.set(
      Math.cos(heading.current),
      0,
      -Math.sin(heading.current),
    )

    const center = water.sample(position.current.x, position.current.z, time)
    const front = water.sample(
      position.current.x + moveDirection.x * BOARD_HALF_LENGTH,
      position.current.z + moveDirection.z * BOARD_HALF_LENGTH,
      time,
    )
    const back = water.sample(
      position.current.x - moveDirection.x * BOARD_HALF_LENGTH,
      position.current.z - moveDirection.z * BOARD_HALF_LENGTH,
      time,
    )
    const left = water.sample(
      position.current.x - rightDirection.x * BOARD_HALF_WIDTH,
      position.current.z - rightDirection.z * BOARD_HALF_WIDTH,
      time,
    )
    const right = water.sample(
      position.current.x + rightDirection.x * BOARD_HALF_WIDTH,
      position.current.z + rightDirection.z * BOARD_HALF_WIDTH,
      time,
    )
    const contactHeight = center.height + WATER_CLEARANCE
    const speed = Math.hypot(velocity.current.x, velocity.current.z)

    if (
      contactState.current === 'water' &&
      speed > 1.8 &&
      (lastWakeTime.current < 0 || time - lastWakeTime.current >= 0.085)
    ) {
      lastWakeTime.current = time
      const inverseSpeed = 1 / Math.max(speed, 0.001)
      const wakeDirectionX = velocity.current.x * inverseSpeed
      const wakeDirectionZ = velocity.current.z * inverseSpeed
      const wakeStrength = THREE.MathUtils.clamp(
        0.34 + speed / 22 + Math.abs(turnInput) * 0.24,
        0.38,
        1,
      )

      commandBus.emit({
        kind: 'wake',
        position: {
          x: position.current.x - wakeDirectionX * 0.9,
          z: position.current.z - wakeDirectionZ * 0.9,
        },
        direction: {
          x: wakeDirectionX,
          z: wakeDirectionZ,
        },
        radius: 2.5,
        strength: wakeStrength,
        issuedAt: time,
      })
    }

    launchCooldown.current = Math.max(0, launchCooldown.current - deltaTime)

    if (contactState.current === 'water') {
      const verticalError = contactHeight - position.current.y
      position.current.y +=
        verticalError * (1 - Math.exp(-15 * deltaTime))
      verticalVelocity.current = verticalError / Math.max(deltaTime, 0.001)

      const crestHeight = center.height - (front.height + back.height) * 0.5
      const surfaceFallsAway = center.height - front.height
      if (
        launchCooldown.current === 0 &&
        speed > 9 &&
        crestHeight > 0.035 &&
        surfaceFallsAway > 0.02
      ) {
        contactState.current = 'airborne'
        verticalVelocity.current = Math.min(
          6.5,
          1.25 + crestHeight * speed * 1.45,
        )
        position.current.y += 0.04
        launchCooldown.current = 0.9
      }
    } else if (contactState.current === 'airborne') {
      verticalVelocity.current -= 9.81 * deltaTime
      position.current.y += verticalVelocity.current * deltaTime
      if (
        verticalVelocity.current <= 0 &&
        position.current.y <= contactHeight
      ) {
        position.current.y = contactHeight
        contactState.current = 'landing'
        landingTimer.current = 0.18
        const impact = Math.min(1, Math.abs(verticalVelocity.current) / 7)
        velocity.current.multiplyScalar(1 - impact * 0.2)
        verticalVelocity.current = 0
      }
    } else {
      position.current.y +=
        (contactHeight - position.current.y) *
        (1 - Math.exp(-18 * deltaTime))
      landingTimer.current -= deltaTime
      if (landingTimer.current <= 0) contactState.current = 'water'
    }
    riderPositionRef.current?.copy(position.current)

    const waterPitch = Math.atan2(
      front.height - back.height,
      BOARD_HALF_LENGTH * 2,
    )
    const waterRoll = Math.atan2(
      right.height - left.height,
      BOARD_HALF_WIDTH * 2,
    )
    const airbornePitch =
      Math.atan2(verticalVelocity.current, Math.max(speed, 0.1)) * 0.42
    const targetPitch =
      contactState.current === 'airborne' ? airbornePitch : waterPitch
    const targetRoll =
      contactState.current === 'airborne'
        ? turnInput * -0.12
        : waterRoll - turnInput * Math.min(0.3, speed * 0.018)

    if (characterRef.current !== null) {
      characterRef.current.position.copy(position.current)
      characterRef.current.rotation.order = 'YXZ'
      characterRef.current.rotation.set(
        -targetPitch,
        heading.current,
        targetRoll,
      )
    }
    if (riderVisualRef.current !== null) {
      riderVisualRef.current.rotation.z +=
        (turnInput * -0.24 - riderVisualRef.current.rotation.z) *
        (1 - Math.exp(-10 * deltaTime))
    }

    updateAimTarget(
      session !== undefined,
      rightController?.object,
      moveDirection,
      water,
      time,
    )

    const aimDistance = scratch.current.rayOrigin.distanceTo(
      aimTarget.current,
    )
    if (aimReticleRef.current !== null) {
      aimReticleRef.current.position.copy(aimTarget.current)
    }
    if (aimDistanceSpriteRef.current !== null) {
      aimDistanceSpriteRef.current.position.copy(aimTarget.current)
      aimDistanceSpriteRef.current.position.y += 0.82
    }
    if (aimGuideRef.current !== null && aimDistance > 0.01) {
      scratch.current.aimGuideVector
        .subVectors(aimTarget.current, scratch.current.rayOrigin)
        .normalize()
      aimGuideRef.current.position
        .copy(scratch.current.rayOrigin)
        .lerp(aimTarget.current, 0.5)
      aimGuideRef.current.quaternion.setFromUnitVectors(
        scratch.current.aimGuideUp,
        scratch.current.aimGuideVector,
      )
      aimGuideRef.current.scale.set(1, aimDistance, 1)
    }
    const aimLabel = `${activeAbility.id}:${Math.round(aimDistance)}`
    if (aimLabel !== lastAimDistanceLabel.current) {
      lastAimDistanceLabel.current = aimLabel
      drawDistanceMarker(aimDistanceCanvas, aimDistance, activeAbility)
      aimDistanceTexture.needsUpdate = true
    }

    updateCasting(
      desktopCasting || questInput.casting,
      time,
      deltaTime,
      rightGamepad,
    )

    const activeCasting = desktopCasting || questInput.casting
    const carvingIntensity =
      contactState.current === 'water'
        ? THREE.MathUtils.clamp(
            (speed / 24) *
              (0.2 +
                Math.abs(turnInput) * 0.55 +
                Math.min(0.35, Math.abs(lateralSpeed) / 8) +
                center.turbulence * 0.3),
            0,
            1,
          )
        : 0
    const telemetry: HydroboardTelemetry = {
      speed,
      carvingIntensity,
      isCasting: activeCasting,
      contactState: contactState.current,
      aimDistance,
      beaconDistance: Math.hypot(
        position.current.x,
        BEACON_Z - position.current.z,
      ),
      charge:
        activeAbility.id === 'swell' && activeCasting
          ? THREE.MathUtils.clamp(chargeTime.current / 1.35, 0, 1)
          : undefined,
    }
    if (
      shouldEmitTelemetry(
        lastTelemetry.current,
        telemetry,
        now,
        lastTelemetryTime.current,
      )
    ) {
      lastTelemetry.current = telemetry
      lastTelemetryTime.current = now
      onTelemetry?.(telemetry)
    }

    const cameraDistance = 7 + speed * 0.055
    scratch.current.cameraOffset
      .copy(moveDirection)
      .multiplyScalar(-cameraDistance)
    scratch.current.cameraOffset.y = 3.4 + speed * 0.025
    scratch.current.cameraTarget
      .copy(position.current)
      .add(scratch.current.cameraOffset)
    const cameraDamping = 1 - Math.exp(-7 * deltaTime)

    if (session !== undefined) {
      xrOriginPosition.current.lerp(
        scratch.current.cameraTarget,
        cameraDamping,
      )
      if (xrOriginRef.current !== null) {
        xrOriginRef.current.position.copy(xrOriginPosition.current)
        const targetYaw = getXrChaseYaw(heading.current)
        xrOriginYaw.current +=
          (targetYaw - xrOriginYaw.current) * cameraDamping
        xrOriginRef.current.rotation.y = xrOriginYaw.current
      }
    } else if (followCamera) {
      camera.position.lerp(scratch.current.cameraTarget, cameraDamping)
      camera.lookAt(
        position.current.x,
        position.current.y + 0.85,
        position.current.z,
      )
    }
    if (transitionVeilRef.current !== null && transition.opacity > 0) {
      const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera
      activeCamera.getWorldPosition(
        scratch.current.activeCameraPosition,
      )
      transitionVeilRef.current.position.copy(
        scratch.current.activeCameraPosition,
      )
    }
  })

  function updateAimTarget(
    inXR: boolean,
    controllerObject: THREE.Object3D | undefined,
    moveDirection: THREE.Vector3,
    waterSampler: WaterSampler,
    time: number,
  ): void {
    const work = scratch.current

    if (inXR) {
      if (controllerObject !== undefined) {
        controllerObject.getWorldPosition(work.rayOrigin)
        controllerObject.getWorldDirection(work.rayDirection)
        work.rayDirection.negate()
      } else {
        const surface = waterSampler.sample(
          position.current.x,
          position.current.z,
          time,
        )
        work.surfaceNormal.set(
          surface.normal.x,
          surface.normal.y,
          surface.normal.z,
        )
        work.rayOrigin
          .copy(position.current)
          .addScaledVector(work.surfaceNormal, 1.25)
        work.rayDirection.copy(moveDirection)
      }
    } else {
      raycaster.setFromCamera(pointer, camera)
      work.rayOrigin.copy(raycaster.ray.origin)
      work.rayDirection.copy(raycaster.ray.direction)
    }

    resolveWaterAim(
      work.rayOrigin,
      work.rayDirection,
      moveDirection,
      waterSampler,
      time,
      aimTarget.current,
      {
        maxDistance: 55,
        fallbackDistance: 12,
        waterDomainHalfSize,
      },
    )

    const directionX = aimTarget.current.x - position.current.x
    const directionZ = aimTarget.current.z - position.current.z
    const inverseLength = 1 / Math.max(0.001, Math.hypot(directionX, directionZ))
    aimDirection.current.set(
      directionX * inverseLength,
      directionZ * inverseLength,
    )
  }

  function updateCasting(
    casting: boolean,
    time: number,
    deltaTime: number,
    gamepad: Gamepad | undefined,
  ): void {
    if (lastAbilityId.current !== activeAbility.id) {
      lastAbilityId.current = activeAbility.id
      wasCasting.current = false
      chargeTime.current = 0
    }

    const justPressed = casting && !wasCasting.current
    const justReleased = !casting && wasCasting.current

    if (activeAbility.id === 'swell') {
      if (casting) {
        chargeTime.current = Math.min(1.6, chargeTime.current + deltaTime)
      }
      if (justReleased) {
        const strength = THREE.MathUtils.clamp(chargeTime.current / 1.35, 0.22, 1)
        emitCommand('swell', strength, activeAbility.radius * (0.8 + strength * 0.4))
        pulse(gamepad, 0.55, 45)
        chargeTime.current = 0
      }
    } else if (activeAbility.id === 'current') {
      if (casting && (justPressed || time - lastPaintTime.current >= 0.11)) {
        lastPaintTime.current = time
        emitCommand('current', 0.48, activeAbility.radius)
        pulse(gamepad, 0.18, 18)
      }
    } else if (justPressed) {
      emitCommand('vortex', 1, activeAbility.radius)
      pulse(gamepad, 0.7, 65)
    }

    wasCasting.current = casting
  }

  function emitCommand(
    kind: 'swell' | 'current' | 'vortex',
    strength: number,
    radius: number,
  ): void {
    commandBus.emit({
      kind,
      position: {
        x: aimTarget.current.x,
        z: aimTarget.current.z,
      },
      direction: {
        x: aimDirection.current.x,
        z: aimDirection.current.y,
      },
      radius,
      strength,
      issuedAt: performance.now() / 1000,
    })
  }

  function pulse(
    gamepad: Gamepad | undefined,
    intensity: number,
    duration: number,
  ): void {
    const actuator = gamepad?.hapticActuators?.[0]
    if (actuator !== undefined) void actuator.pulse(intensity, duration)
  }

  return (
    <>
      {session !== undefined && (
        <XROrigin
          ref={xrOriginRef}
          position={[0, 3.5, -52]}
          rotation={[0, getXrChaseYaw(0), 0]}
        />
      )}

      <mesh
        ref={transitionVeilRef}
        frustumCulled={false}
        renderOrder={10000}
        visible={false}
      >
        <sphereGeometry args={[0.6, 16, 12]} />
        <meshBasicMaterial
          ref={transitionVeilMaterialRef}
          color="#163746"
          side={THREE.BackSide}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={aimReticleRef} position={[0, 0.08, -34]}>
        <pointLight
          color={activeAbility.color}
          intensity={3.2}
          distance={7}
          decay={2}
          position={[0, 0.5, 0]}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              activeAbility.radius * 0.68,
              activeAbility.radius,
              48,
            ]}
          />
          <meshBasicMaterial
            color={activeAbility.color}
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <octahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial
            color={activeAbility.color}
            emissive={activeAbility.color}
            emissiveIntensity={3}
          />
        </mesh>
      </group>

      <sprite
        ref={aimDistanceSpriteRef}
        scale={[1.55, 0.58, 1]}
        renderOrder={40}
      >
        <spriteMaterial
          map={aimDistanceTexture}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      <mesh ref={aimGuideRef} frustumCulled={false} renderOrder={25}>
        <cylinderGeometry args={[0.018, 0.032, 1, 6]} />
        <meshBasicMaterial
          color={activeAbility.color}
          transparent
          opacity={0.48}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={characterRef} position={[0, 0.16, START_Z]}>
        <group ref={riderVisualRef}>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.62, 0.1, 2.65]} />
            <meshStandardMaterial
              color="#081827"
              roughness={0.2}
              metalness={0.78}
            />
          </mesh>
          <mesh position={[0, 0.105, 0]}>
            <boxGeometry args={[0.38, 0.025, 2.1]} />
            <meshStandardMaterial
              color={activeAbility.color}
              emissive={activeAbility.color}
              emissiveIntensity={2.2}
              roughness={0.25}
            />
          </mesh>

          <mesh position={[0, -0.2, 0.55]}>
            <cylinderGeometry args={[0.035, 0.035, 0.48, 8]} />
            <meshStandardMaterial color="#183b4d" metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.43, 0.55]}>
            <boxGeometry args={[1.25, 0.045, 0.24]} />
            <meshStandardMaterial color="#102b3b" metalness={0.8} />
          </mesh>

          <mesh position={[0, 1.05, -0.08]}>
            <capsuleGeometry args={[0.28, 0.85, 6, 12]} />
            <meshStandardMaterial color="#087f9f" roughness={0.38} />
          </mesh>
          <mesh position={[0, 1.65, 0.04]}>
            <sphereGeometry args={[0.23, 14, 10]} />
            <meshStandardMaterial
              color="#d7f8ff"
              emissive={activeAbility.color}
              emissiveIntensity={1.2}
            />
          </mesh>

          {[-0.2, 0.2].map((x) => (
            <mesh
              key={x}
              position={[x, -0.025, -2.25]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.09, 3.8]} />
              <meshBasicMaterial
                color="#e8fdff"
                transparent
                opacity={0.38}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  )
}
