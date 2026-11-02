import { BackSide, Color, NormalBlending, ShaderMaterial, Vector3 } from 'three'
import type { GrowthFrames } from './seedProcedure'

export interface GrowthCloudMass {
  id: string
  seed: number
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  /** Thin wisps can cross the seed path briefly while keeping its silhouette readable. */
  pathCrossing?: boolean
  densityScale?: number
  /** Only sparse far masses persist into lily growth. */
  persistent?: boolean
}

/** Distributed along the seed's full fall, with near, island-level and deep-background layers. */
const GROWTH_CLOUD_LAYOUT: readonly GrowthCloudMass[] = [
  { id: 'high-near-left', seed: 11, position: [-3.05, 5.2, 2.5], radii: [0.95, 0.64, 0.82] },
  { id: 'upper-far-right', seed: 23, position: [3.35, 4.85, -4.8], radii: [1.02, 0.72, 0.96] },
  { id: 'upper-path-wisp', seed: 37, position: [0.28, 3.35, 0.12], radii: [0.65, 0.38, 0.68], pathCrossing: true, densityScale: 0.22 },
  { id: 'high-far-left', seed: 41, position: [-3.55, 4.15, -4.1], radii: [1.08, 0.73, 0.98] },
  { id: 'mid-high-near-left', seed: 53, position: [-3.3, 3.8, 3.1], radii: [0.9, 0.62, 0.84] },
  { id: 'mid-high-far-right', seed: 67, position: [3.7, 3.45, -5.4], radii: [1.1, 0.75, 0.98] },
  { id: 'upper-mid-path-wisp', seed: 71, position: [-0.32, 2.25, -0.1], radii: [0.62, 0.34, 0.66], pathCrossing: true, densityScale: 0.24 },
  { id: 'mid-far-left', seed: 83, position: [-3.55, 2.75, -4.7], radii: [1.06, 0.7, 0.94] },
  { id: 'mid-path-wisp', seed: 97, position: [0.35, 1.05, 0.08], radii: [0.68, 0.36, 0.7], pathCrossing: true, densityScale: 0.22 },
  { id: 'mid-far-right', seed: 101, position: [3.35, 2.05, -5.2], radii: [1.04, 0.71, 0.96] },
  { id: 'low-near-right', seed: 113, position: [2.75, 1.7, 2.25], radii: [0.86, 0.62, 0.78] },
  { id: 'low-far-left', seed: 127, position: [-3.7, 1.35, -4.4], radii: [1.1, 0.74, 1.02] },
  { id: 'island-near-left', seed: 131, position: [-3.05, 1, 2.6], radii: [0.92, 0.66, 0.84] },
  { id: 'island-far-right', seed: 149, position: [3.45, 0.65, -5.2], radii: [1.08, 0.73, 0.98], persistent: true },
  { id: 'low-path-wisp', seed: 157, position: [-0.28, -0.1, -0.15], radii: [0.62, 0.4, 0.68], pathCrossing: true, densityScale: 0.24 },
  { id: 'island-far-left', seed: 163, position: [-3.65, -0.05, -4.7], radii: [1.08, 0.72, 1], persistent: true },
  { id: 'low-background-left', seed: 179, position: [-4.1, -0.4, -6.2], radii: [1.14, 0.76, 1.08], persistent: true },
  { id: 'low-background-right', seed: 191, position: [3.8, -0.75, -6], radii: [1.12, 0.74, 1.04], persistent: true },
  { id: 'deep-low-near-left', seed: 199, position: [-3.1, -1.05, 2.4], radii: [0.9, 0.63, 0.82] },
  { id: 'deep-low-far-right', seed: 211, position: [3.55, -1.35, -5.4], radii: [1.08, 0.73, 1] },
  { id: 'high-background-left', seed: 223, position: [-4.2, 5.55, -6.8], radii: [1.18, 0.77, 1.1] },
  { id: 'deep-near-right', seed: 227, position: [3.05, -1.7, 2.8], radii: [0.94, 0.65, 0.86] },
  { id: 'high-background-right', seed: 239, position: [4.05, 5.9, -6.4], radii: [1.16, 0.76, 1.08] },
  { id: 'deep-near-left', seed: 241, position: [-3.2, -2.05, 2.45], radii: [0.92, 0.64, 0.84] },
]

export const MAX_GROWTH_CLOUD_MASSES = GROWTH_CLOUD_LAYOUT.length

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

      float shapeX = sin(uSeed * 0.19) * 0.15;
      float shapeY = cos(uSeed * 0.13) * 0.12;
      float shapeZ = sin(uSeed * 0.17) * 0.14;
      vec3 shiftedPoint = localPoint + vec3(
        sin(uSeed * 0.12) * 0.08,
        cos(uSeed * 0.09) * 0.065,
        sin(uSeed * 0.07) * 0.075
      );
      float turnAngle = uSeed * 0.17;
      mat2 cloudTurn = mat2(cos(turnAngle), -sin(turnAngle), sin(turnAngle), cos(turnAngle));
      shiftedPoint.xz = cloudTurn * shiftedPoint.xz;
      float lobeA = 1.0 - smoothstep(0.36, 0.9, length((shiftedPoint - vec3(-0.38 + shapeX, -0.06 + shapeY, 0.02 + shapeZ)) * vec3(1.28, 1.36, 1.18)));
      float lobeB = 1.0 - smoothstep(0.38, 0.91, length((shiftedPoint - vec3(0.31 - shapeY, 0.02 + shapeZ, -0.08 - shapeX)) * vec3(1.32, 1.2, 1.26)));
      float lobeC = 1.0 - smoothstep(0.34, 0.86, length((shiftedPoint - vec3(-0.08 + shapeZ, 0.34 - shapeX, 0.11 + shapeY)) * vec3(1.38, 1.42, 1.2)));
      float lobeD = 1.0 - smoothstep(0.34, 0.85, length((shiftedPoint - vec3(0.07 - shapeX, -0.32 + shapeY, 0.14 - shapeZ)) * vec3(1.26, 1.38, 1.32)));
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
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(GROWTH_CLOUD_LAYOUT.length, Math.floor(count))) : 18
  const safeScale = Number.isFinite(scale) ? Math.max(0.4, Math.min(2, scale)) : 1
  const positionScale = 1 + (safeScale - 1) * 0.35
  const verticalLayout = GROWTH_CLOUD_LAYOUT.map((mass) => {
    const crossing = mass.pathCrossing ?? false
    const xJitter = seededVariation(mass.seed, 1) * (crossing ? 0 : 0.72)
    const yJitter = seededVariation(mass.seed, 2) * (crossing ? 0.1 : 0.4)
    const zJitter = seededVariation(mass.seed, 3) * (crossing ? 0 : 1.25)
    const radiusVariation = [4, 5, 6].map((salt) => 1 + seededVariation(mass.seed, salt) * 0.24) as [number, number, number]
    return {
      ...mass,
      position: [mass.position[0] + xJitter, mass.position[1] + yJitter, mass.position[2] + zJitter] as const,
      radii: [mass.radii[0] * radiusVariation[0], mass.radii[1] * radiusVariation[1], mass.radii[2] * radiusVariation[2]] as const,
    }
  }).sort((a, b) => a.position[1] - b.position[1])
  // Lower cloud-count values keep coverage from the island through the full descent.
  const selectedMasses = safeCount === 0 ? [] : safeCount === 1
    ? [verticalLayout[Math.floor(verticalLayout.length / 2)]!]
    : safeCount >= 4
      ? (() => {
        const wisps = verticalLayout.filter(({ pathCrossing }) => pathCrossing)
        const background = verticalLayout.filter(({ pathCrossing }) => !pathCrossing)
        const persistent = background.filter(({ persistent: keep }) => keep)
        const reserved = safeCount >= 8 ? [...wisps, ...persistent]
          : [...wisps, ...persistent.slice(0, Math.max(0, safeCount - wisps.length))]
        const candidates = verticalLayout.filter((mass) => !reserved.includes(mass))
        const candidateCount = Math.max(0, safeCount - reserved.length)
        const selectedCandidates = candidateCount === 0 ? [] : candidateCount === 1
          ? [candidates[Math.floor(candidates.length / 2)]!]
          : Array.from({ length: candidateCount }, (_, index) =>
            candidates[Math.round(index * (candidates.length - 1) / (candidateCount - 1))]!)
        return [...reserved, ...selectedCandidates].sort((a, b) => a.position[1] - b.position[1])
      })()
      : Array.from({ length: safeCount }, (_, index) => verticalLayout[Math.round(index * (verticalLayout.length - 1) / (safeCount - 1))]!)
  return selectedMasses.map((mass) => ({
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
  persistent = false,
): number {
  if (!Number.isFinite(time)) return 0
  const opacity = clampFinite(cloudOpacity, 0, 1, 0)
  const environment = clampFinite(environmentOpacity, 0, 1, 0)
  const visibilityEnd = persistent ? frames.duration : frames.handoff[1]
  if (opacity === 0 || environment === 0 || time < frames.fall[0] || time >= visibilityEnd) return 0
  const fadeInEnd = Math.min(frames.handoff[0], frames.fall[0] + 0.7)
  const fadeOutStart = persistent
    ? Math.max(frames.handoff[1], frames.duration - 0.9)
    : Math.max(frames.handoff[0], frames.handoff[1] - 0.7)
  const fadeIn = smoothstep(frames.fall[0], fadeInEnd, time)
  const fadeOut = 1 - smoothstep(fadeOutStart, visibilityEnd, time)
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

function seededVariation(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}
