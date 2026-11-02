import { BackSide, Color, NormalBlending, ShaderMaterial, Vector3 } from 'three'
import type { GrowthFrames } from './seedProcedure'

export interface GrowthCloudMass {
  id: string
  seed: number
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
}

const GROWTH_CLOUD_LAYOUT: readonly GrowthCloudMass[] = [
  { id: 'near-left', seed: 11, position: [-2.05, 0.35, 1.1], radii: [0.82, 0.62, 0.74] },
  { id: 'far-right', seed: 23, position: [2.38, 2.15, -3.0], radii: [0.95, 0.72, 0.9] },
  { id: 'near-right', seed: 37, position: [3.0, -0.2, 1.55], radii: [0.82, 0.6, 0.68] },
  { id: 'far-left', seed: 41, position: [-2.72, 1.55, -3.5], radii: [0.99, 0.68, 0.92] },
  { id: 'deep-right', seed: 53, position: [3.4, 0.45, -4.4], radii: [0.75, 0.58, 0.8] },
  { id: 'near-back-left', seed: 67, position: [-3.2, -0.85, 2.85], radii: [0.82, 0.6, 0.76] },
]

export const GROWTH_CLOUD_RAY_STEPS = 12

const cloudVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const cloudFragmentShader = `
  #ifndef CLOUD_STEPS
    #define CLOUD_STEPS 12
  #endif

  uniform vec3 uCenter;
  uniform vec3 uRadii;
  uniform vec3 uMoonPosition;
  uniform vec3 uMoonColor;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uDensity;
  uniform float uLightIntensity;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float latticeHash(vec3 cell) {
    return fract(sin(dot(cell, vec3(17.17, 59.4, 23.7)) + uSeed * 13.13) * 31871.234);
  }

  float softNoise(vec3 point) {
    vec3 cell = floor(point);
    vec3 f = fract(point);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(latticeHash(cell), latticeHash(cell + vec3(1.0, 0.0, 0.0)), f.x);
    float b = mix(latticeHash(cell + vec3(0.0, 1.0, 0.0)), latticeHash(cell + vec3(1.0, 1.0, 0.0)), f.x);
    float c = mix(latticeHash(cell + vec3(0.0, 0.0, 1.0)), latticeHash(cell + vec3(1.0, 0.0, 1.0)), f.x);
    float d = mix(latticeHash(cell + vec3(0.0, 1.0, 1.0)), latticeHash(cell + vec3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }

  float smoothUnion(float a, float b, float width) {
    float h = clamp(0.5 + 0.5 * (a - b) / width, 0.0, 1.0);
    return mix(b, a, h) + width * h * (1.0 - h);
  }

  void main() {
    vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
    vec3 inverseRadii = 1.0 / max(uRadii, vec3(0.001));
    vec3 rayOrigin = (cameraPosition - uCenter) * inverseRadii;
    vec3 rayVector = rayDirection * inverseRadii;
    float a = dot(rayVector, rayVector);
    float b = dot(rayOrigin, rayVector);
    float c = dot(rayOrigin, rayOrigin) - 1.0;
    float discriminant = b * b - a * c;
    if (discriminant <= 0.0 || a <= 0.0) discard;

    float root = sqrt(discriminant);
    float nearDistance = max((-b - root) / a, 0.0);
    float farDistance = (-b + root) / a;
    if (farDistance <= nearDistance) discard;

    float stepLength = (farDistance - nearDistance) / float(CLOUD_STEPS);
    float transmittance = 1.0;
    float accumulatedAlpha = 0.0;
    vec3 accumulatedColor = vec3(0.0);
    float drift = uTime * 0.035;

    for (int i = 0; i < CLOUD_STEPS; i++) {
      float distanceAlongRay = nearDistance + (float(i) + 0.5) * stepLength;
      vec3 worldPoint = cameraPosition + rayDirection * distanceAlongRay;
      vec3 localPoint = (worldPoint - uCenter) * inverseRadii;
      vec3 flowPoint = localPoint * 3.1 + vec3(drift, uSeed * 0.017, -drift * 0.7);
      float broadNoise = softNoise(flowPoint);
      float detailNoise = softNoise(flowPoint * 1.85 + vec3(4.3, 1.7, 8.1));

      vec3 shiftedPoint = localPoint + vec3(
        sin(uSeed * 0.12) * 0.035,
        cos(uSeed * 0.09) * 0.025,
        sin(uSeed * 0.07) * 0.03
      );
      float turnAngle = uSeed * 0.11;
      mat2 cloudTurn = mat2(cos(turnAngle), -sin(turnAngle), sin(turnAngle), cos(turnAngle));
      shiftedPoint.xz = cloudTurn * shiftedPoint.xz;
      float lobeA = 1.0 - smoothstep(0.36, 0.9, length((shiftedPoint - vec3(-0.38, -0.06, 0.02)) * vec3(1.28, 1.36, 1.18)));
      float lobeB = 1.0 - smoothstep(0.38, 0.91, length((shiftedPoint - vec3(0.31, 0.02, -0.08)) * vec3(1.32, 1.2, 1.26)));
      float lobeC = 1.0 - smoothstep(0.34, 0.86, length((shiftedPoint - vec3(-0.08, 0.34, 0.11)) * vec3(1.38, 1.42, 1.2)));
      float lobeD = 1.0 - smoothstep(0.34, 0.85, length((shiftedPoint - vec3(0.07, -0.32, 0.14)) * vec3(1.26, 1.38, 1.32)));
      float cloudBody = smoothUnion(smoothUnion(lobeA, lobeB, 0.17), smoothUnion(lobeC, lobeD, 0.16), 0.18);
      float edgeErosion = (broadNoise - 0.5) * 0.66 + (detailNoise - 0.5) * 0.29;
      cloudBody = smoothstep(0.12, 0.55, cloudBody + edgeErosion);
      float coverage = smoothstep(0.26, 0.68, broadNoise * 0.58 + detailNoise * 0.42);
      float erosion = 0.25 + coverage * 0.75;
      float cloudDensity = cloudBody * erosion;

      vec3 normalApprox = normalize(localPoint * inverseRadii);
      vec3 lightDirection = normalize(uMoonPosition - worldPoint);
      float moonFacing = max(dot(normalApprox, lightDirection), 0.0);
      float silverRim = smoothstep(0.18, 0.72, cloudBody) * (1.0 - smoothstep(0.72, 0.98, cloudBody));
      float lunarAmount = clamp(uLightIntensity * (0.18 + moonFacing * 0.5 + silverRim * 0.62), 0.0, 1.15);
      float innerShade = 0.64 + broadNoise * 0.26 + (1.0 - length(localPoint)) * 0.1;
      vec3 midnightBlue = vec3(0.035, 0.062, 0.12) * innerShade;
      vec3 silverBlue = mix(vec3(0.62, 0.72, 0.92), uMoonColor, 0.58);
      vec3 sampleColor = mix(midnightBlue, silverBlue, lunarAmount);
      sampleColor += silverBlue * silverRim * uLightIntensity * 0.35;

      float opticalDepth = cloudDensity * uDensity * uOpacity * stepLength * 0.72;
      float sampleAlpha = 1.0 - exp(-max(opticalDepth, 0.0));
      float contribution = transmittance * sampleAlpha;
      accumulatedColor += sampleColor * contribution;
      accumulatedAlpha += contribution;
      transmittance *= 1.0 - sampleAlpha;
      if (transmittance < 0.025) break;
    }

    float alpha = accumulatedAlpha;
    if (alpha < 0.003) discard;
    vec3 color = accumulatedColor / max(accumulatedAlpha, 0.0001);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export interface GrowthCloudMaterialOptions {
  seed: number
}

export function getGrowthCloudMasses(count: number, scale: number): GrowthCloudMass[] {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(GROWTH_CLOUD_LAYOUT.length, Math.floor(count))) : 3
  const safeScale = Number.isFinite(scale) ? Math.max(0.4, Math.min(2, scale)) : 1
  const positionScale = 1 + (safeScale - 1) * 0.35
  return GROWTH_CLOUD_LAYOUT.slice(0, safeCount).map((mass) => ({
    ...mass,
    position: [mass.position[0] * positionScale, mass.position[1] * safeScale, mass.position[2] * safeScale],
    radii: [mass.radii[0] * safeScale, mass.radii[1] * safeScale, mass.radii[2] * safeScale],
  }))
}

export function getGrowthCloudVisibility(
  time: number,
  frames: GrowthFrames,
  cloudOpacity: number,
  environmentOpacity: number,
): number {
  if (!Number.isFinite(time)) return 0
  const opacity = clampFinite(cloudOpacity, 0, 1, 0)
  const environment = clampFinite(environmentOpacity, 0, 1, 0)
  if (opacity === 0 || environment === 0 || time < frames.fall[0] || time >= frames.handoff[1]) return 0
  const fadeInEnd = Math.min(frames.handoff[0], frames.fall[0] + 0.7)
  const fadeOutStart = Math.max(frames.handoff[0], frames.handoff[1] - 0.7)
  const fadeIn = smoothstep(frames.fall[0], fadeInEnd, time)
  const fadeOut = 1 - smoothstep(fadeOutStart, frames.handoff[1], time)
  return opacity * environment * fadeIn * fadeOut
}

export function getGrowthCloudDrift(
  mass: GrowthCloudMass,
  time: number,
  speed: number,
): readonly [number, number, number] {
  const safeTime = Number.isFinite(time) ? time : 0
  const safeSpeed = clampFinite(speed, 0, 2, 0)
  if (safeTime === 0 || safeSpeed === 0) return [0, 0, 0]
  const phase = safeTime * safeSpeed * 0.6 + mass.seed
  return [Math.sin(phase) * 0.055, Math.sin(phase * 0.73 + 0.9) * 0.018, Math.cos(phase * 0.81) * 0.045]
}

export function getGrowthCloudMotionTime(time: number, reducedMotion: boolean): number {
  return reducedMotion || !Number.isFinite(time) ? 0 : time
}

export function setGrowthCloudMoonPosition(target: Vector3, rootPosition: Vector3, sourceHeight: number): void {
  const safeHeight = Number.isFinite(sourceHeight) ? Math.max(0.05, sourceHeight) : 5.5
  target.set(rootPosition.x, rootPosition.y + safeHeight, rootPosition.z)
}

export function createGrowthCloudVolumeMaterial(options: GrowthCloudMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector3() },
      uRadii: { value: new Vector3(1, 1, 1) },
      uMoonPosition: { value: new Vector3(0, 5.5, 0) },
      uMoonColor: { value: new Color('#AFC9F5') },
      uSeed: { value: Number.isFinite(options.seed) ? options.seed : 0 },
      uOpacity: { value: 0 },
      uDensity: { value: 0.8 },
      uLightIntensity: { value: 0.7 },
      uTime: { value: 0 },
    },
    defines: { CLOUD_STEPS: GROWTH_CLOUD_RAY_STEPS },
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: BackSide,
    toneMapped: false,
  })
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / Math.max(0.0001, to - from)))
  return t * t * (3 - 2 * t)
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}
