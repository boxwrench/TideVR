import * as THREE from 'three'
import type { WaterCommand } from '../game/WaterCommandBus'
import { withPreservedRenderTarget } from '../rendering/renderTargetState'

const simulationVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const simulationFragmentShader = `
uniform sampler2D uCurrentState;
uniform vec2 uResolution;
uniform float uWorldSize;
uniform float uDeltaTime;
uniform int uCommandType;
uniform vec2 uCommandPosition;
uniform vec2 uCommandDirection;
uniform float uCommandRadius;
uniform float uCommandStrength;

varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 current = texture2D(uCurrentState, vUv);
  vec4 left = texture2D(uCurrentState, vUv - vec2(texel.x, 0.0));
  vec4 right = texture2D(uCurrentState, vUv + vec2(texel.x, 0.0));
  vec4 top = texture2D(uCurrentState, vUv + vec2(0.0, texel.y));
  vec4 bottom = texture2D(uCurrentState, vUv - vec2(0.0, texel.y));
  vec2 backtraceUv = clamp(
    vUv - vec2(current.g, -current.b) * (uDeltaTime / uWorldSize),
    texel * 0.5,
    vec2(1.0) - texel * 0.5
  );
  vec4 advected = texture2D(uCurrentState, backtraceUv);

  float cellSize = uWorldSize / max(uResolution.x - 1.0, 1.0);
  vec2 heightGradient = vec2(
    right.r - left.r,
    bottom.r - top.r
  ) / (2.0 * cellSize);
  float divergence = (
    right.g - left.g +
    bottom.b - top.b
  ) / (2.0 * cellSize);

  float neighborHeight = (left.r + right.r + top.r + bottom.r) * 0.25;
  float height = current.r - divergence * 0.8 * uDeltaTime;
  height = mix(height, neighborHeight, 0.035);
  vec2 velocity = advected.gb - heightGradient * 6.5 * uDeltaTime;
  float foam = max(
    advected.a * exp(-0.52 * uDeltaTime),
    clamp(length(heightGradient) * 2.2 + abs(divergence) * 0.4, 0.0, 1.0)
  );

  height *= exp(-0.16 * uDeltaTime);
  velocity *= exp(-0.72 * uDeltaTime);

  vec2 worldPosition = vec2(
    (vUv.x - 0.5) * uWorldSize,
    (0.5 - vUv.y) * uWorldSize
  );
  vec2 delta = worldPosition - uCommandPosition;
  float distanceToCommand = length(delta);
  float normalizedDistance = distanceToCommand / max(uCommandRadius, 0.001);
  float falloff = pow(max(0.0, 1.0 - normalizedDistance * normalizedDistance), 2.0);
  vec2 commandForward = normalize(uCommandDirection + vec2(0.00001));
  vec2 commandRight = vec2(commandForward.y, -commandForward.x);
  float across = dot(delta, commandRight);
  float normalizedAcross = across / max(uCommandRadius, 0.001);

  if (uCommandType == 1 && falloff > 0.0) {
    float crest = exp(-pow((normalizedDistance - 0.42) / 0.22, 2.0));
    height += falloff * (0.48 + crest * 0.42) * uCommandStrength;
    velocity += commandForward * falloff * 2.35 * uCommandStrength;
    foam = max(foam, max(falloff * 0.48, crest * 0.92) * uCommandStrength);
  } else if (uCommandType == 2 && falloff > 0.0) {
    float channel = exp(-pow(normalizedAcross / 0.24, 2.0)) * falloff;
    float banks = exp(-pow((abs(normalizedAcross) - 0.46) / 0.16, 2.0)) * falloff;
    height += (banks * 0.22 - channel * 0.1) * uCommandStrength;
    velocity += commandForward * falloff * 2.45 * uCommandStrength;
    foam = max(foam, max(channel * 0.58, banks * 0.9));
  } else if (uCommandType == 3 && falloff > 0.0) {
    vec2 radial = distanceToCommand > 0.001 ? delta / distanceToCommand : vec2(0.0);
    vec2 tangent = vec2(-radial.y, radial.x);
    float pull = falloff * 2.65 * uCommandStrength;
    float rim = exp(-pow((normalizedDistance - 0.68) / 0.14, 2.0));
    height += (rim * 0.22 - falloff * 0.72) * uCommandStrength;
    velocity += (tangent - radial * 0.28) * pull;
    foam = max(foam, max(falloff * 0.38, rim));
  } else if (uCommandType == 4 && falloff > 0.0) {
    float center = exp(-pow(normalizedAcross / 0.2, 2.0)) * falloff;
    float rails = exp(-pow((abs(normalizedAcross) - 0.48) / 0.13, 2.0)) * falloff;
    height += (rails * 0.16 - center * 0.13) * uCommandStrength;
    velocity += commandForward * falloff * 0.42 * uCommandStrength;
    foam = max(foam, max(rails * 0.96, center * 0.42) * uCommandStrength);
  }

  gl_FragColor = vec4(
    clamp(height, -1.25, 1.25),
    clamp(velocity.x, -5.5, 5.5),
    clamp(velocity.y, -5.5, 5.5),
    clamp(foam, 0.0, 1.0)
  );
}
`

export interface WaterSimulationOptions {
  readonly resolution?: number
  readonly worldSize?: number
  readonly updateRate?: number
}

export class WaterSimulation {
  readonly resolution: number
  readonly worldSize: number

  private readonly targetA: THREE.WebGLRenderTarget
  private readonly targetB: THREE.WebGLRenderTarget
  private readonly fixedStep: number
  private readonly scene: THREE.Scene
  private readonly camera: THREE.OrthographicCamera
  private readonly material: THREE.ShaderMaterial
  private readonly quad: THREE.Mesh
  private readonly queuedCommands: WaterCommand[] = []

  private accumulator = 0
  private useTargetA = true
  private initialized = false

  constructor({
    resolution = 512,
    worldSize = 180,
    updateRate = 30,
  }: WaterSimulationOptions = {}) {
    this.resolution = resolution
    this.worldSize = worldSize
    this.fixedStep = 1 / updateRate

    const targetOptions: THREE.RenderTargetOptions = {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }

    this.targetA = new THREE.WebGLRenderTarget(
      resolution,
      resolution,
      targetOptions,
    )
    this.targetB = new THREE.WebGLRenderTarget(
      resolution,
      resolution,
      targetOptions,
    )
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.material = new THREE.ShaderMaterial({
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uCurrentState: { value: null },
        uResolution: {
          value: new THREE.Vector2(resolution, resolution),
        },
        uWorldSize: { value: worldSize },
        uDeltaTime: { value: this.fixedStep },
        uCommandType: { value: 0 },
        uCommandPosition: { value: new THREE.Vector2() },
        uCommandDirection: { value: new THREE.Vector2(0, 1) },
        uCommandRadius: { value: 1 },
        uCommandStrength: { value: 0 },
      },
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.quad)
  }

  get texture(): THREE.Texture {
    return (this.useTargetA ? this.targetA : this.targetB).texture
  }

  update(
    renderer: THREE.WebGLRenderer,
    deltaTime: number,
    commands: ReadonlyArray<WaterCommand>,
  ): void {
    if (!this.initialized) this.initializeTargets(renderer)
    this.queuedCommands.push(...commands)
    this.accumulator = Math.min(
      this.accumulator + deltaTime,
      this.fixedStep * 3,
    )

    let steps = 0
    while (this.accumulator >= this.fixedStep && steps < 2) {
      this.step(renderer, this.queuedCommands.shift())
      this.accumulator -= this.fixedStep
      steps++
    }
  }

  dispose(): void {
    this.targetA.dispose()
    this.targetB.dispose()
    this.material.dispose()
    this.quad.geometry.dispose()
  }

  private initializeTargets(renderer: THREE.WebGLRenderer): void {
    const previousColor = renderer.getClearColor(new THREE.Color())
    const previousAlpha = renderer.getClearAlpha()

    withPreservedRenderTarget(renderer, () => {
      renderer.setClearColor(0x000000, 0)
      try {
        renderer.setRenderTarget(this.targetA)
        renderer.clear()
        renderer.setRenderTarget(this.targetB)
        renderer.clear()
      } finally {
        renderer.setClearColor(previousColor, previousAlpha)
      }
    })
    this.initialized = true
  }

  private step(
    renderer: THREE.WebGLRenderer,
    command: WaterCommand | undefined,
  ): void {
    const readTarget = this.useTargetA ? this.targetA : this.targetB
    const writeTarget = this.useTargetA ? this.targetB : this.targetA

    this.material.uniforms.uCurrentState.value = readTarget.texture
    this.configureCommand(command)

    withPreservedRenderTarget(renderer, () => {
      renderer.setRenderTarget(writeTarget)
      renderer.render(this.scene, this.camera)
    })
    this.useTargetA = !this.useTargetA
  }

  private configureCommand(command: WaterCommand | undefined): void {
    if (command === undefined) {
      this.material.uniforms.uCommandType.value = 0
      this.material.uniforms.uCommandStrength.value = 0
      return
    }

    const commandType =
      command.kind === 'swell'
        ? 1
        : command.kind === 'current'
          ? 2
          : command.kind === 'vortex'
            ? 3
            : 4
    this.material.uniforms.uCommandType.value = commandType
    this.material.uniforms.uCommandPosition.value.set(
      command.position.x,
      command.position.z,
    )
    this.material.uniforms.uCommandDirection.value.set(
      command.direction.x,
      command.direction.z,
    )
    this.material.uniforms.uCommandRadius.value = command.radius
    this.material.uniforms.uCommandStrength.value = command.strength
  }
}
