import * as THREE from 'three'
import { BASE_WAVES } from './baseWaves'

function glslNumber(value: number): string {
  return value.toFixed(8)
}

const baseWaveStatements = BASE_WAVES.map(
  (wave) => `
  {
    float waveNumber = 6.28318530718 / ${glslNumber(wave.wavelength)};
    vec2 direction = vec2(
      ${glslNumber(wave.directionX)},
      ${glslNumber(wave.directionZ)}
    );
    float phase =
      waveNumber * dot(worldXZ, direction) -
      ${glslNumber(wave.angularFrequency)} * uTime +
      ${glslNumber(wave.phase)};
    height += ${glslNumber(wave.amplitude)} * sin(phase);
    gradient +=
      ${glslNumber(wave.amplitude)} *
      waveNumber *
      cos(phase) *
      direction;
  }`,
).join('\n')

const sampleBaseWavesFunction = `
vec3 sampleBaseWaves(vec2 worldXZ) {
  float height = 0.0;
  vec2 gradient = vec2(0.0);
  ${baseWaveStatements}
  return vec3(height, gradient);
}
`

const oceanVertexShader = `
uniform sampler2D uDynamicWater;
uniform vec2 uDynamicTexel;
uniform float uWorldSize;
uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec4 vDynamic;
varying float vWaveHeight;

${sampleBaseWavesFunction}

void main() {
  vec4 flatWorldPosition = modelMatrix * vec4(position, 1.0);
  vec2 worldXZ = flatWorldPosition.xz;
  vec2 simulationUv = vec2(
    worldXZ.x / uWorldSize + 0.5,
    0.5 - worldXZ.y / uWorldSize
  );
  vec4 dynamicState = texture2D(uDynamicWater, simulationUv);
  float dynamicLeft = texture2D(
    uDynamicWater,
    simulationUv - vec2(uDynamicTexel.x, 0.0)
  ).r;
  float dynamicRight = texture2D(
    uDynamicWater,
    simulationUv + vec2(uDynamicTexel.x, 0.0)
  ).r;
  float dynamicTop = texture2D(
    uDynamicWater,
    simulationUv + vec2(0.0, uDynamicTexel.y)
  ).r;
  float dynamicBottom = texture2D(
    uDynamicWater,
    simulationUv - vec2(0.0, uDynamicTexel.y)
  ).r;
  float smoothDynamicHeight = clamp(
    dynamicState.r * 0.5 +
    (dynamicLeft + dynamicRight + dynamicTop + dynamicBottom) * 0.125,
    -0.95,
    0.95
  );
  float edgeDistance = max(abs(worldXZ.x), abs(worldXZ.y));
  float dynamicBlend = 1.0 - smoothstep(
    uWorldSize * 0.42,
    uWorldSize * 0.495,
    edgeDistance
  );
  smoothDynamicHeight *= dynamicBlend;

  vec3 baseWave = sampleBaseWaves(worldXZ);
  vec2 dynamicGradient = vec2(
    dynamicRight - dynamicLeft,
    dynamicBottom - dynamicTop
  ) / (2.0 * uWorldSize * uDynamicTexel.x);
  dynamicGradient =
    clamp(dynamicGradient, vec2(-0.28), vec2(0.28)) *
    dynamicBlend;
  vec2 totalGradient = baseWave.yz + dynamicGradient;

  vec4 worldPosition = flatWorldPosition;
  worldPosition.y += baseWave.x + smoothDynamicHeight;
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(vec3(
    -totalGradient.x,
    1.0,
    -totalGradient.y
  ));
  vDynamic = vec4(
    smoothDynamicHeight,
    dynamicState.gba * dynamicBlend
  );
  vWaveHeight = baseWave.x + smoothDynamicHeight;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const farOceanVertexShader = `
uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vWaveHeight;

${sampleBaseWavesFunction}

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec3 baseWave = sampleBaseWaves(worldPosition.xz);
  worldPosition.y += baseWave.x;

  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(vec3(
    -baseWave.y,
    1.0,
    -baseWave.z
  ));
  vWaveHeight = baseWave.x;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const oceanFragmentShader = `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uSurfaceColor;
uniform vec3 uFoamColor;
uniform vec3 uSkyColor;
uniform vec3 uSunDirection;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec4 vDynamic;
varying float vWaveHeight;

vec2 detailWaveGradient(
  vec2 worldXZ,
  vec2 direction,
  float wavelength,
  float amplitude,
  float speed,
  float phaseOffset
) {
  float waveNumber = 6.28318530718 / wavelength;
  float phase =
    waveNumber * dot(worldXZ, normalize(direction)) -
    speed * uTime +
    phaseOffset;
  return normalize(direction) * amplitude * waveNumber * cos(phase);
}

void main() {
  float distanceToCamera = length(cameraPosition - vWorldPosition);
  float detailFade = 1.0 - smoothstep(30.0, 115.0, distanceToCamera);
  vec2 detailGradient =
    detailWaveGradient(vWorldPosition.xz, vec2(1.0, 0.24), 2.8, 0.025, 1.8, 0.0) +
    detailWaveGradient(vWorldPosition.xz, vec2(-0.38, 1.0), 1.65, 0.012, 2.35, 1.7) +
    detailWaveGradient(vWorldPosition.xz, vec2(0.72, -1.0), 0.9, 0.005, 3.1, 3.4);
  vec3 normal = normalize(
    vWorldNormal +
    vec3(-detailGradient.x, 0.0, -detailGradient.y) * detailFade
  );
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(uSunDirection);
  vec3 halfDirection = normalize(viewDirection + lightDirection);

  float normalDotView = max(0.0, dot(normal, viewDirection));
  float normalDotLight = max(0.0, dot(normal, lightDirection));
  float fresnel = 0.04 + 0.96 * pow(1.0 - normalDotView, 5.0);
  float sunGlint = pow(max(0.0, dot(normal, halfDirection)), 160.0) * 1.5;
  float broadGlint = pow(max(0.0, dot(normal, halfDirection)), 34.0) * 0.1;

  vec2 flow = vDynamic.gb;
  float flowStrength = length(flow);
  vec2 flowDirection = flowStrength > 0.02 ? normalize(flow) : vec2(0.0, 1.0);
  float flowCoordinate =
    dot(vWorldPosition.xz, flowDirection) * 1.15 -
    uTime * (1.1 + flowStrength * 0.2);
  float flowBand = 1.0 - smoothstep(
    0.1,
    0.32,
    abs(fract(flowCoordinate) - 0.5)
  );
  float currentGlow = smoothstep(0.35, 1.8, flowStrength) * flowBand;
  float spellCrest =
    smoothstep(0.2, 0.72, vDynamic.r) *
    smoothstep(0.025, 0.18, 1.0 - normal.y);
  float foam = clamp(
    max(smoothstep(0.1, 0.68, vDynamic.a), spellCrest) +
    currentGlow * 0.42,
    0.0,
    1.0
  );

  float depression = 1.0 - smoothstep(-1.1, 0.0, vWaveHeight);
  vec3 waterColor = mix(
    uDeepColor,
    uSurfaceColor,
    clamp(normalDotLight * 0.32 + vWaveHeight * 0.06 + 0.24, 0.0, 1.0)
  );
  waterColor *= mix(1.0, 0.62, depression);
  float raisedWater = smoothstep(0.08, 0.75, vDynamic.r);
  float carvedWater = 1.0 - smoothstep(-0.8, -0.06, vDynamic.r);
  waterColor = mix(waterColor, uSurfaceColor * 1.32, raisedWater * 0.34);
  waterColor *= mix(1.0, 0.62, carvedWater);
  waterColor = mix(waterColor, uSkyColor, fresnel * 0.48);
  waterColor += vec3(0.05, 0.48, 0.5) * currentGlow * 0.22;
  waterColor += vec3(1.0, 0.88, 0.65) * (sunGlint + broadGlint);
  waterColor = mix(waterColor, uFoamColor, foam * 0.9);

  float fog = smoothstep(78.0, 155.0, distanceToCamera);
  waterColor = mix(waterColor, uSkyColor, fog * 0.68);

  gl_FragColor = vec4(min(waterColor, vec3(1.35)), 1.0);
}
`

const farOceanFragmentShader = `
uniform vec3 uDeepColor;
uniform vec3 uSurfaceColor;
uniform vec3 uSkyColor;
uniform vec3 uSunDirection;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vWaveHeight;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(uSunDirection);
  vec3 halfDirection = normalize(viewDirection + lightDirection);

  float normalDotView = max(0.0, dot(normal, viewDirection));
  float normalDotLight = max(0.0, dot(normal, lightDirection));
  float fresnel =
    0.04 + 0.96 * pow(1.0 - normalDotView, 5.0);
  float broadGlint =
    pow(max(0.0, dot(normal, halfDirection)), 34.0) * 0.1;
  float depression = 1.0 - smoothstep(-1.1, 0.0, vWaveHeight);

  vec3 waterColor = mix(
    uDeepColor,
    uSurfaceColor,
    clamp(
      normalDotLight * 0.32 + vWaveHeight * 0.06 + 0.24,
      0.0,
      1.0
    )
  );
  waterColor *= mix(1.0, 0.62, depression);
  waterColor = mix(waterColor, uSkyColor, fresnel * 0.48);
  waterColor += vec3(1.0, 0.88, 0.65) * broadGlint;

  float distanceToCamera = length(cameraPosition - vWorldPosition);
  float fog = smoothstep(78.0, 155.0, distanceToCamera);
  waterColor = mix(waterColor, uSkyColor, fog * 0.68);

  gl_FragColor = vec4(min(waterColor, vec3(1.35)), 1.0);
}
`

export function createOceanMaterial(
  dynamicTexture: THREE.Texture,
  resolution: number,
  worldSize: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: oceanVertexShader,
    fragmentShader: oceanFragmentShader,
    side: THREE.FrontSide,
    uniforms: {
      uDynamicWater: { value: dynamicTexture },
      uDynamicTexel: {
        value: new THREE.Vector2(1 / resolution, 1 / resolution),
      },
      uWorldSize: { value: worldSize },
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color('#031c2a') },
      uSurfaceColor: { value: new THREE.Color('#08758d') },
      uFoamColor: { value: new THREE.Color('#d7f8f5') },
      uSkyColor: { value: new THREE.Color('#567b88') },
      uSunDirection: {
        value: new THREE.Vector3(0.45, 0.8, 0.3).normalize(),
      },
    },
  })
}

/**
 * Analytic-only ocean material for the far skirt. It shares broad-wave and
 * lighting code with the near ocean but performs no simulation texture reads.
 */
export function createFarOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: farOceanVertexShader,
    fragmentShader: farOceanFragmentShader,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color('#031c2a') },
      uSurfaceColor: { value: new THREE.Color('#08758d') },
      uSkyColor: { value: new THREE.Color('#567b88') },
      uSunDirection: {
        value: new THREE.Vector3(0.45, 0.8, 0.3).normalize(),
      },
    },
  })
}
