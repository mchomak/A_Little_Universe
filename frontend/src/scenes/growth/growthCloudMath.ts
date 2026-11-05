import { BackSide, Color, NormalBlending, ShaderMaterial, Vector3 } from 'three'
import { getGrowthProgress, type GrowthFrames } from './seedProcedure'

export interface GrowthCloudMass {
  id: string
  seed: number
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  lightScale: number
  /** Thin wisps can cross the seed path briefly while keeping its silhouette readable. */
  pathCrossing?: boolean
  densityScale?: number
  /** Only sparse far masses persist into lily growth. */
  persistent?: boolean
}

interface GrowthCloudTemplate extends GrowthCloudMass {
  /** Fraction of the seed's fall completed when this mass intersects its world-space path. */
  fallProgress?: number
}

export interface GrowthCloudLayoutOptions {
  fallDistance?: number
  viewportHeight?: number
  sizeVariation?: number
  lightVariation?: number
  pathDensity?: number
  depthVariation?: number
}

const DEFAULT_CLOUD_LAYOUT_OPTIONS: Required<GrowthCloudLayoutOptions> = {
  fallDistance: 7.65,
  viewportHeight: 3.856,
  sizeVariation: 0.72,
  lightVariation: 0.55,
  pathDensity: 0.65,
  depthVariation: 0.65,
}

/** Central wisps are sparse; larger groups sit at varied depths along the latter half of the fall. */
const GROWTH_CLOUD_LAYOUT: readonly GrowthCloudTemplate[] = [
  { id: 'path-crossing-01', seed: 11, position: [0.14, 0, 0.08], radii: [0.62, 0.34, 0.7], fallProgress: 0.51, pathCrossing: true, densityScale: 0.14, lightScale: 1 },
  { id: 'path-crossing-02', seed: 23, position: [-0.19, 0, -0.12], radii: [0.7, 0.38, 0.62], fallProgress: 0.58, pathCrossing: true, densityScale: 0.16, lightScale: 1 },
  { id: 'path-crossing-03', seed: 37, position: [0.22, 0, 0.16], radii: [0.58, 0.3, 0.68], fallProgress: 0.64, pathCrossing: true, densityScale: 0.14, lightScale: 1 },
  { id: 'path-crossing-04', seed: 41, position: [-0.12, 0, 0.2], radii: [0.76, 0.4, 0.66], fallProgress: 0.7, pathCrossing: true, densityScale: 0.17, lightScale: 1 },
  { id: 'path-crossing-05', seed: 53, position: [0.18, 0, -0.18], radii: [0.6, 0.31, 0.72], fallProgress: 0.76, pathCrossing: true, densityScale: 0.15, lightScale: 1 },
  { id: 'path-crossing-06', seed: 67, position: [-0.22, 0, 0.1], radii: [0.68, 0.36, 0.6], fallProgress: 0.82, pathCrossing: true, densityScale: 0.16, lightScale: 1 },
  { id: 'path-crossing-07', seed: 71, position: [0.12, 0, -0.16], radii: [0.72, 0.33, 0.76], fallProgress: 0.89, pathCrossing: true, densityScale: 0.15, lightScale: 1 },
  { id: 'path-crossing-08', seed: 83, position: [-0.16, 0, -0.08], radii: [0.64, 0.35, 0.68], fallProgress: 0.95, pathCrossing: true, densityScale: 0.15, lightScale: 1 },
  { id: 'near-group-left-high', seed: 97, position: [-2.55, 0, 2.45], radii: [1.15, 0.86, 1.22], fallProgress: 0.52, lightScale: 1 },
  { id: 'far-group-right-upper', seed: 101, position: [3.45, 0, -5.25], radii: [1.38, 0.74, 1.34], fallProgress: 0.56, persistent: true, lightScale: 1 },
  { id: 'near-group-right-upper', seed: 113, position: [2.65, 0, 2.8], radii: [0.96, 0.68, 1.02], fallProgress: 0.62, lightScale: 1 },
  { id: 'far-group-left-mid', seed: 127, position: [-3.85, 0, -4.7], radii: [1.08, 0.9, 1.42], fallProgress: 0.66, persistent: true, lightScale: 1 },
  { id: 'near-group-left-mid', seed: 131, position: [-3.55, 0, 3.15], radii: [1.3, 1.02, 0.88], fallProgress: 0.72, lightScale: 1 },
  { id: 'far-group-right-mid', seed: 149, position: [3.7, 0, -6.05], radii: [1.22, 0.77, 1.54], fallProgress: 0.75, lightScale: 1 },
  { id: 'near-group-right-low', seed: 157, position: [3.2, 0, 2.55], radii: [1.02, 0.7, 1.3], fallProgress: 0.84, lightScale: 1 },
  { id: 'far-group-left-low', seed: 163, position: [-4.05, 0, -5.55], radii: [1.4, 0.82, 1.18], fallProgress: 0.91, lightScale: 1 },
  // Broad, distant banks sit below the island and overlap into a quiet cloud sea.
  { id: 'island-back-left', seed: 179, position: [-3.15, -1.05, -5.75], radii: [3.2, 0.72, 1.45], persistent: true, lightScale: 1 },
  { id: 'island-back-right', seed: 191, position: [3.1, -1.32, -6.25], radii: [3.45, 0.78, 1.6], persistent: true, lightScale: 1 },
  { id: 'island-far-left', seed: 199, position: [-3.5, -2.05, -6.8], radii: [3.65, 0.8, 1.8], persistent: true, lightScale: 1 },
  { id: 'island-far-right', seed: 211, position: [3.3, -2.4, -7.15], radii: [3.85, 0.76, 1.55], persistent: true, lightScale: 1 },
  { id: 'near-group-left-lower', seed: 223, position: [-3.35, 0, 2.6], radii: [1.24, 0.7, 1.1], fallProgress: 0.79, lightScale: 1 },
  { id: 'far-group-right-lower', seed: 227, position: [3.9, 0, -5.45], radii: [1.36, 0.92, 1.2], fallProgress: 0.8, lightScale: 1 },
  { id: 'near-group-right-deep', seed: 239, position: [3.45, 0, 3.45], radii: [1.06, 0.76, 1.16], fallProgress: 0.94, lightScale: 1 },
  { id: 'far-group-left-deep', seed: 241, position: [-4.1, 0, -6.45], radii: [1.48, 0.84, 1.28], fallProgress: 0.97, lightScale: 1 },
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
  uniform float uShapeVariation;
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

      float shapeX = sin(uSeed * 0.19) * 0.15 * uShapeVariation;
      float shapeY = cos(uSeed * 0.13) * 0.12 * uShapeVariation;
      float shapeZ = sin(uSeed * 0.17) * 0.14 * uShapeVariation;
      vec3 shiftedPoint = localPoint + vec3(
        sin(uSeed * 0.12) * 0.08 * uShapeVariation,
        cos(uSeed * 0.09) * 0.065 * uShapeVariation,
        sin(uSeed * 0.07) * 0.075 * uShapeVariation
      );
      float turnAngle = uSeed * 0.17 * uShapeVariation;
      mat2 cloudTurn = mat2(cos(turnAngle), -sin(turnAngle), sin(turnAngle), cos(turnAngle));
      shiftedPoint.xz = cloudTurn * shiftedPoint.xz;
      float lobeA = 1.0 - smoothstep(0.36, 0.9, length((shiftedPoint - vec3(-0.38 + shapeX, -0.06 + shapeY, 0.02 + shapeZ)) * vec3(1.28, 1.36, 1.18)));
      float lobeB = 1.0 - smoothstep(0.38, 0.91, length((shiftedPoint - vec3(0.31 - shapeY, 0.02 + shapeZ, -0.08 - shapeX)) * vec3(1.32, 1.2, 1.26)));
      float lobeC = 1.0 - smoothstep(0.34, 0.86, length((shiftedPoint - vec3(-0.08 + shapeZ, 0.34 - shapeX, 0.11 + shapeY)) * vec3(1.38, 1.42, 1.2)));
      float lobeD = 1.0 - smoothstep(0.34, 0.85, length((shiftedPoint - vec3(0.07 - shapeX, -0.32 + shapeY, 0.14 - shapeZ)) * vec3(1.26, 1.38, 1.32)));
      float cloudBody = smoothUnion(smoothUnion(lobeA, lobeB, 0.17), smoothUnion(lobeC, lobeD, 0.16), 0.18);
      float edgeErosion = ((broadNoise - 0.5) * 0.66 + (detailNoise - 0.5) * 0.29)
        * mix(0.5, 1.15, uShapeVariation);
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
      vec3 midnightBlue = vec3(0.16, 0.20, 0.29) * innerShade;
      vec3 silverBlue = mix(vec3(0.62, 0.72, 0.92), uMoonColor, 0.58);
      vec3 sampleColor = mix(midnightBlue, silverBlue, lunarAmount);
      sampleColor += silverBlue * silverRim * uLightIntensity * 0.35;

      float opticalDepth = cloudDensity * uDensity * uOpacity * stepLength * 1.15;
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

/** Directional cloud illumination follows the same impact-bound cue as the key light. */
export function getGrowthCloudLunarLight(time: number, frames: GrowthFrames, cloudLight: number, moonLight: number, variation: number): number {
  return clampFinite(cloudLight, 0, 2, 0) * clampFinite(moonLight, 0, 2, 0)
    * clampFinite(variation, 0, 2, 1) * getGrowthProgress(time, frames.moonlight)
}

export function getGrowthCloudMasses(
  count: number,
  scale: number,
  options: GrowthCloudLayoutOptions = {},
): GrowthCloudMass[] {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(GROWTH_CLOUD_LAYOUT.length, Math.floor(count))) : 18
  const safeScale = Number.isFinite(scale) ? Math.max(0.4, Math.min(2, scale)) : 1
  const fallDistance = clampFinite(options.fallDistance ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.fallDistance, 1, 40, DEFAULT_CLOUD_LAYOUT_OPTIONS.fallDistance)
  const viewportHeight = clampFinite(options.viewportHeight ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.viewportHeight, 1, 20, DEFAULT_CLOUD_LAYOUT_OPTIONS.viewportHeight)
  const sizeVariation = clampFinite(options.sizeVariation ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.sizeVariation, 0, 1, DEFAULT_CLOUD_LAYOUT_OPTIONS.sizeVariation)
  const lightVariation = clampFinite(options.lightVariation ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.lightVariation, 0, 1, DEFAULT_CLOUD_LAYOUT_OPTIONS.lightVariation)
  const pathDensity = clampFinite(options.pathDensity ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.pathDensity, 0, 1, DEFAULT_CLOUD_LAYOUT_OPTIONS.pathDensity)
  const depthVariation = clampFinite(options.depthVariation ?? DEFAULT_CLOUD_LAYOUT_OPTIONS.depthVariation, 0, 1, DEFAULT_CLOUD_LAYOUT_OPTIONS.depthVariation)
  const depthSpread = 0.32 + depthVariation * 1.08
  const positionScale = 1 + (safeScale - 1) * 0.35
  const initialViewportBottom = fallDistance - viewportHeight / 2
  // Side banks enter the upper fall view while the sparse central wisps remain below it.
  const sideBankRise = fallDistance > viewportHeight * 1.5 ? viewportHeight * 0.75 : 0
  const maxPathRadius = Math.max(...GROWTH_CLOUD_LAYOUT.filter(({ pathCrossing }) => pathCrossing).map(({ radii }) => radii[1]))
    * safeScale * (1 + 0.4 * sizeVariation)
  const highestPathY = Math.min(fallDistance * 0.48, initialViewportBottom - maxPathRadius - 0.28)
  const dynamicLayout = GROWTH_CLOUD_LAYOUT.map((mass) => {
    const crossing = mass.pathCrossing ?? false
    const xJitter = seededVariation(mass.seed, 1) * (crossing ? 0 : 0.52)
    const yJitter = mass.persistent ? 0 : seededVariation(mass.seed, 2) * (crossing ? 0.035 : 0.055)
    const zJitter = seededVariation(mass.seed, 3) * (crossing ? 0 : 0.95)
    const sizeFactors = [4, 5, 6].map((salt) => 1 + seededVariation(mass.seed, salt) * sizeVariation * 0.42) as [number, number, number]
    const lightScale = clampFinite(1 + seededVariation(mass.seed, 7) * lightVariation * 0.72, 0.35, 1.65, 1)
    const radii = [mass.radii[0] * sizeFactors[0], mass.radii[1] * sizeFactors[1], mass.radii[2] * sizeFactors[2]] as const
    const fallProgress = mass.fallProgress
    const anchoredBank = mass.persistent && fallProgress === undefined
    const highestMassY = anchoredBank
      ? mass.position[1]
      : Math.min(fallDistance * 1.1, initialViewportBottom + sideBankRise - radii[1] * safeScale - 0.28)
    const lowestMassY = Math.min(0.12, highestMassY - Math.max(0.55, fallDistance * 0.34))
    const pathHigh = crossing ? highestPathY : highestMassY
    const pathLow = crossing ? 0.12 : lowestMassY
    const pathY = fallProgress === undefined
      ? mass.position[1]
      : pathHigh + (pathLow - pathHigh) * clampFinite((fallProgress - 0.5) / 0.48, 0, 1, 0)
    const desiredY = pathY + yJitter * Math.max(0.5, pathHigh - pathLow)
    const y = anchoredBank ? desiredY : crossing
      ? Math.max(pathLow, Math.min(pathHigh, desiredY))
      : Math.min(desiredY, initialViewportBottom + sideBankRise - radii[1] * safeScale - 0.28)
    return {
      ...mass,
      position: [mass.position[0] + xJitter, y, (mass.position[2] + zJitter) * depthSpread] as const,
      radii,
      lightScale: mass.lightScale * lightScale,
    }
  })
  const verticalLayout = dynamicLayout.sort((a, b) => a.position[1] - b.position[1])
  const selectedMasses = (() => {
    if (safeCount === 0) return []
    const pathCandidates = verticalLayout.filter(({ pathCrossing }) => pathCrossing)
    const persistentCandidates = verticalLayout.filter(({ persistent }) => persistent)
    const otherCandidates = verticalLayout.filter(({ pathCrossing, persistent }) => !pathCrossing && !persistent)
    // A single volume is a discrete choice, so let the slider's midpoint switch it
    // from a background group to a path wisp instead of bypassing path density.
    const requestedPathCount = safeCount === 1
      ? Math.round(pathDensity)
      : Math.round(safeCount * pathDensity * 0.5)
    const pathCount = Math.min(pathCandidates.length, requestedPathCount)
    const persistentCount = safeCount >= 8 ? Math.min(persistentCandidates.length, Math.round(safeCount * 0.3)) : 0
    const reservedCount = Math.min(safeCount, pathCount + persistentCount)
    const selectedPath = spreadSelect(pathCandidates, Math.min(pathCount, reservedCount))
    const selectedPersistent = spreadSelect(persistentCandidates, Math.min(persistentCount, reservedCount - selectedPath.length))
    const otherCount = safeCount - selectedPath.length - selectedPersistent.length
    const selectedOther = spreadSelect(otherCandidates, otherCount)
    return [...selectedPath, ...selectedPersistent, ...selectedOther].sort((a, b) => a.position[1] - b.position[1])
  })()
  return selectedMasses.map((mass) => ({
    ...mass,
    position: [mass.position[0] * positionScale, mass.position[1], mass.position[2] * safeScale],
    radii: [mass.radii[0] * safeScale, mass.radii[1] * safeScale, mass.radii[2] * safeScale],
  }))
}

export function getGrowthCloudVisibility(
  time: number,
  frames: GrowthFrames,
  cloudOpacity: number,
  environmentOpacity: number,
  persistent = false,
  reducedMotion = false,
): number {
  if (!Number.isFinite(time)) return 0
  const opacity = clampFinite(cloudOpacity, 0, 1, 0)
  const environment = clampFinite(environmentOpacity, 0, 1, 0)
  const visibilityEnd = persistent ? frames.duration : frames.handoff[1]
  if (opacity === 0 || environment === 0 || time >= visibilityEnd) return 0
  const fadeOutStart = persistent
    ? Math.max(frames.handoff[1], frames.duration - 0.9)
    : Math.max(frames.handoff[0], frames.handoff[1] - 0.7)
  const fadeOut = 1 - smoothstep(fadeOutStart, visibilityEnd, time)
  if (reducedMotion) {
    if (!persistent) return 0
    const fadeInStart = frames.fall[0] + (frames.fall[1] - frames.fall[0]) * 0.5
    const fadeInEnd = Math.min(frames.handoff[0], frames.fall[1] + 0.45)
    return opacity * environment * smoothstep(fadeInStart, fadeInEnd, time) * fadeOut
  }
  return opacity * environment * fadeOut
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
      uShapeVariation: { value: 0.65 },
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

function spreadSelect<T>(items: readonly T[], count: number): T[] {
  const safeCount = Math.max(0, Math.min(items.length, Math.floor(count)))
  if (safeCount === 0) return []
  if (safeCount === 1) return [items[Math.floor(items.length / 2)]!]
  return Array.from({ length: safeCount }, (_, index) =>
    items[Math.round(index * (items.length - 1) / (safeCount - 1))]!,
  )
}
