import { GALLERY } from './content'
import type { Vector3 } from 'three'
import type { GalleryCloudLayerSettings, GalleryCloudLayers } from '../../systems/scene-config/config'

export type GalleryQuality = 'low' | 'standard'
export type GalleryCloudLayerId = keyof GalleryCloudLayers

export type GalleryAtmosphereLayer = GalleryCloudLayerId | 'haze'

const cloudStepProfiles: Readonly<Record<GalleryQuality, Readonly<Record<GalleryAtmosphereLayer, { near: number; far: number; reflection: number }>>>> = {
  standard: {
    far: { near: 4, far: 2, reflection: 2 },
    mid: { near: 5, far: 2, reflection: 2 },
    nearLow: { near: 12, far: 5, reflection: 4 },
    waterline: { near: 12, far: 5, reflection: 4 },
    moon: { near: 6, far: 3, reflection: 2 },
    haze: { near: 6, far: 3, reflection: 2 },
  },
  low: {
    far: { near: 3, far: 3, reflection: 2 },
    mid: { near: 3, far: 3, reflection: 2 },
    nearLow: { near: 4, far: 3, reflection: 3 },
    waterline: { near: 4, far: 3, reflection: 3 },
    moon: { near: 3, far: 2, reflection: 2 },
    haze: { near: 3, far: 3, reflection: 2 },
  },
}

const CLOUD_DETAIL_NEAR_DISTANCE = 22
const CLOUD_DETAIL_FAR_DISTANCE = 82
const CLOUD_VISIBILITY_RANGES: Readonly<Record<GalleryAtmosphereLayer, readonly [number, number]>> = {
  far: [92, 136],
  mid: [100, 148],
  nearLow: [132, 176],
  waterline: [132, 176],
  moon: [0, 180],
  haze: [140, 184],
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Near corridor masses use more ray samples, with a smooth distance LOD toward the horizon. */
export function getGalleryAtmosphereStepCount(
  quality: GalleryQuality,
  layer: GalleryAtmosphereLayer,
  cameraDistance: number,
  reflection = false,
) {
  const profile = cloudStepProfiles[quality][layer]
  // The reduced profile uses the same selected clouds but spends fewer samples
  // per volume, keeping its total ray budget at or below the previous default.
  const qualityScale = quality === 'low' ? 0.75 : 1
  if (reflection) return profile.reflection * qualityScale
  const distance = Number.isFinite(cameraDistance) ? Math.max(0, cameraDistance) : CLOUD_DETAIL_FAR_DISTANCE
  const detail = 1 - smoothstep(CLOUD_DETAIL_NEAR_DISTANCE, CLOUD_DETAIL_FAR_DISTANCE, distance)
  return (profile.far + (profile.near - profile.far) * detail) * qualityScale
}

/** Fully faded masses leave the scene only after their shader opacity reaches zero. */
export function getGalleryAtmosphereVisibilityFade(
  cameraDistance: number,
  layer: GalleryAtmosphereLayer,
  moonInteraction = false,
) {
  if (moonInteraction) return 1
  if (!Number.isFinite(cameraDistance)) return 0
  const [start, end] = CLOUD_VISIBILITY_RANGES[layer]
  return 1 - smoothstep(start, end, Math.max(0, cameraDistance))
}

/** Fades a haze mass when the camera nears or enters its ellipsoid, avoiding an enveloping screen layer. */
export function getGalleryHazeCameraFade(
  camera: Pick<Vector3, 'x' | 'y' | 'z'> | readonly [number, number, number],
  center: Pick<Vector3, 'x' | 'y' | 'z'> | readonly [number, number, number],
  radii: readonly [number, number, number],
  fadeDistance = 8,
) {
  const cx = 'x' in center ? center.x : center[0]
  const cy = 'y' in center ? center.y : center[1]
  const cz = 'z' in center ? center.z : center[2]
  const rx = Math.max(0.001, Math.abs(radii[0]))
  const ry = Math.max(0.001, Math.abs(radii[1]))
  const rz = Math.max(0.001, Math.abs(radii[2]))
  const cameraX = 'x' in camera ? camera.x : camera[0]
  const cameraY = 'y' in camera ? camera.y : camera[1]
  const cameraZ = 'z' in camera ? camera.z : camera[2]
  const dx = cameraX - cx
  const dy = cameraY - cy
  const dz = cameraZ - cz
  const normalizedDistance = Math.hypot(dx / rx, dy / ry, dz / rz)
  if (!Number.isFinite(normalizedDistance)) return 0
  if (normalizedDistance <= 1) return 0

  // First-order signed distance to an ellipsoid surface in world units.
  const gradient = Math.hypot(dx / (rx * rx), dy / (ry * ry), dz / (rz * rz)) / normalizedDistance
  if (!Number.isFinite(gradient) || gradient <= 0) return 1
  const distanceToSurface = (normalizedDistance - 1) / gradient
  const width = Number.isFinite(fadeDistance) ? Math.max(0.001, fadeDistance) : 8
  const t = Math.max(0, Math.min(1, distanceToSurface / width))
  return t * t * (3 - 2 * t)
}

export interface GalleryAtmosphereMass {
  id: string
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  opacity: number
  seed: number
  lowQuality: boolean
}

export interface GalleryCloudMass extends GalleryAtmosphereMass {
  layer: GalleryCloudLayerId
  moonInteraction?: boolean
}

/**
 * Keep near clouds in front of the transparent floor's color pass so their
 * waterline volumes remain visible; depth testing still lets photos occlude them.
 */
export function getGalleryCloudRenderOrder(mass: Pick<GalleryCloudMass, 'layer' | 'moonInteraction'>): number {
  if (mass.moonInteraction) return 1
  return mass.layer === 'nearLow' || mass.layer === 'waterline' ? -0.5 : -3
}

export interface GalleryMoonScatteringLayer {
  position: readonly [number, number, number]
  size: number
  intensity: number
  seed: number
}

function createRouteCloudLayer({
  id,
  layer,
  count,
  x,
  y,
  radii,
  opacity,
  seed,
  yJitter = 0,
  xJitter = 0,
}: {
  id: string
  layer: GalleryCloudLayerId
  count: number
  x: number
  y: number
  radii: readonly [number, number, number]
  opacity: number
  seed: number
  yJitter?: number
  xJitter?: number
}): readonly GalleryCloudMass[] {
  const routeStart = GALLERY.startZ + 9
  const routeEnd = GALLERY.startZ - GALLERY.travel - 13
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(1, count - 1)
    const side = index % 2 === 0 ? -1 : 1
    const variation = Math.sin(index * 2.17 + seed)
    return {
      id: `${id}-${String(index + 1).padStart(2, '0')}`,
      layer,
      position: [
        side * (x + variation * xJitter),
        y + Math.cos(index * 1.63 + seed) * yJitter,
        routeStart + (routeEnd - routeStart) * progress,
      ] as const,
      radii,
      opacity,
      seed: seed + index * 13,
      // The reduced profile keeps both corridor edges represented.
      lowQuality: index % 4 < 2,
    }
  })
}

const routeEndZ = GALLERY.startZ - GALLERY.travel
const routeCloudDepth = GALLERY.travel + 22
const nearLowRouteRadius = Math.max(14, routeCloudDepth * 2 / 11 - 3)
const waterlineRouteRadius = Math.max(15.6, routeCloudDepth / 6 - 3)

const routeClouds = [
  ...createRouteCloudLayer({ id: 'mid-bank', layer: 'mid', count: 20, x: 17.6, y: 10, radii: [10.5, 6.8, 20], opacity: 0.64, seed: 61, yJitter: 2.2, xJitter: 1.4 }),
  ...createRouteCloudLayer({ id: 'near-low-bank', layer: 'nearLow', count: 24, x: 10.1, y: 1.85, radii: [4.35, 4, nearLowRouteRadius], opacity: 0.8, seed: 211, yJitter: 0.75, xJitter: 0.3 }),
  ...createRouteCloudLayer({ id: 'waterline-bank', layer: 'waterline', count: 32, x: 12.2, y: 0.2, radii: [6.2, 4.1, waterlineRouteRadius], opacity: 0.82, seed: 421, yJitter: 0.45, xJitter: 0.3 }),
]

const DEFAULT_MOON_POSITION = [0.2, 24, Math.min(-126, routeEndZ - 41)] as const

/** Fixed world-space bounds shared by the gallery environment and its tests. */
export const GALLERY_WORLD = {
  floor: { y: -2.35, centerZ: -180, width: 140, depth: 470 },
  // Separate soft volumes soften the horizon without placing a screen-facing image in the scene.
  haze: [
    { id: 'haze-near', position: [-1.5, -1.5, -67] as const, radii: [38, 4.5, 19] as const, opacity: 0.14, seed: 181, lowQuality: true },
    { id: 'haze-middle', position: [2, -0.75, -98] as const, radii: [48, 5, 22] as const, opacity: 0.17, seed: 211, lowQuality: false },
    { id: 'haze-far', position: [0, 0, -128] as const, radii: [54, 5.9, 25] as const, opacity: 0.19, seed: 227, lowQuality: true },
  ] satisfies readonly GalleryAtmosphereMass[],
  // Keep the moon on the gallery axis, but lift it clearly above the cloud horizon.
  moon: { position: DEFAULT_MOON_POSITION, radius: 2.15, haloRadius: 6.5 },
  clouds: [
    ...Array.from({ length: 12 }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1
      const progress = index / 11
      return {
        id: `far-cloud-${String(index + 1).padStart(2, '0')}`,
        layer: 'far' as const,
        position: [side * (28 + Math.sin(index * 1.7) * 3), 20 + Math.cos(index * 0.9) * 7, 13 + (-162 - 13) * progress] as const,
        radii: [17 + (index % 3), 8 + (index % 2), 22 + (index % 4)] as const,
        opacity: 0.31 - (index % 3) * 0.015,
        seed: 109 + index * 17,
        lowQuality: index % 4 < 2,
      }
    }),
    ...routeClouds,
    ...Array.from({ length: 8 }, (_, index) => {
      const offsets = [
        [1.65, 0.45, 2.25, 2.7, 0.8, 3.4],
        [-3.6, -1.2, 2.5, 3.1, 1.15, 3.4],
        [3.9, 2.25, 1.8, 3.4, 1.1, 3.8],
        [-1.3, 3.6, 2.1, 3.5, 1.0, 3.2],
        [4.1, -2.8, 1.7, 3.1, 1.25, 3.4],
        [-4.6, 2.1, 2.0, 3.4, 1.0, 3.6],
        [0.1, -4.0, 1.9, 3.8, 1.1, 3.4],
        [2.5, 4.2, 2.4, 3.3, 1.0, 3.5],
      ] as const
      const [x, y, z, rx, ry, rz] = offsets[index]!
      return {
        id: `moon-cloud-${String(index + 1).padStart(2, '0')}`,
        layer: 'moon' as const,
        position: [DEFAULT_MOON_POSITION[0] + x, DEFAULT_MOON_POSITION[1] + y, DEFAULT_MOON_POSITION[2] + z] as const,
        radii: [rx, ry, rz] as const,
        opacity: index === 0 ? 0.42 : 0.3,
        seed: 601 + index * 19,
        lowQuality: true,
        moonInteraction: true,
      }
    }),
  ] satisfies readonly GalleryCloudMass[],
} as const

/** A few fixed, soft atmospheric pools trace the moon-to-gallery light path. */
export function getGalleryMoonScatteringLayers(
  moonPosition: readonly [number, number, number] = GALLERY_WORLD.moon.position,
  lightTarget: readonly [number, number, number] = [0, GALLERY_WORLD.floor.y, -34],
): readonly GalleryMoonScatteringLayer[] {
  const start = moonPosition
  const end = lightTarget
  return Array.from({ length: 4 }, (_, index) => {
    const t = 0.44 + index * 0.14
    return {
      position: [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
      ] as const,
      size: 12 + t * 18,
      intensity: 0.08 + Math.sin(t * Math.PI) * 0.11,
      seed: 19 + index * 13,
    }
  })
}

export function getGalleryCloudMasses(): readonly GalleryCloudMass[] {
  // Quality changes ray step count and proxy tessellation, not editor quotas.
  return GALLERY_WORLD.clouds
}

export function getGalleryCloudMassesForLayerCounts(
  _quality: GalleryQuality,
  settings: GalleryCloudLayers,
): readonly GalleryCloudMass[] {
  const layers: readonly GalleryCloudLayerId[] = ['far', 'mid', 'nearLow', 'waterline', 'moon']
  const candidates = new Map(layers.map((layer) => [layer, getGalleryCloudMasses().filter((mass) => mass.layer === layer)]))
  const requested = new Map(layers.map((layer) => [layer, Math.max(0, Math.min(candidates.get(layer)!.length, Math.floor(settings[layer].count)))]))
  return layers.flatMap((layer) => sampleLayer(candidates.get(layer)!, requested.get(layer)!))
}

export function getGalleryCloudPosition(
  mass: GalleryAtmosphereMass,
  settings: GalleryCloudLayerSettings,
  moonPosition: readonly [number, number, number] = DEFAULT_MOON_POSITION,
): readonly [number, number, number] {
  const moonOffset = 'layer' in mass && mass.layer === 'moon'
    ? moonPosition.map((value, axis) => value - DEFAULT_MOON_POSITION[axis]!)
    : [0, 0, 0]
  return [
    mass.position[0] + moonOffset[0]! + Math.sign(mass.position[0]) * settings.distance,
    mass.position[1] + moonOffset[1]! + settings.height,
    mass.position[2] + moonOffset[2]!,
  ]
}

export function getGalleryCloudRadii(mass: GalleryCloudMass, settings: GalleryCloudLayerSettings, quality: GalleryQuality = 'standard'): readonly [number, number, number] {
  const qualityDepthScale = quality === 'low'
    ? mass.layer === 'nearLow' ? 1.65 : mass.layer === 'waterline' ? 2.15 : 1
    : 1
  return [mass.radii[0] * settings.scale, mass.radii[1] * settings.scale, mass.radii[2] * settings.scale * qualityDepthScale]
}

function sampleLayer(
  masses: readonly GalleryCloudMass[],
  count: number,
): GalleryCloudMass[] {
  const ordered = [...masses].sort((a, b) => b.position[2] - a.position[2])
  const sample = (group: readonly GalleryCloudMass[], target: number): GalleryCloudMass[] => {
    if (target <= 0) return []
    if (target >= group.length) return [...group]
    if (target === 1) return [group[Math.floor((group.length - 1) / 2)]!]
    return Array.from({ length: target }, (_, index) => group[Math.round(index * (group.length - 1) / (target - 1))]!)
  }
  if (count === 0 || ordered.length === 0) return []
  if (ordered[0]!.layer === 'moon') {
    const overlapCloud = ordered.find((mass) => mass.id === 'moon-cloud-01')
    if (count === 1) return overlapCloud ? [overlapCloud] : sample(ordered, 1)
    const remaining = sample(ordered.filter((mass) => mass !== overlapCloud), count - 1)
    return [...(overlapCloud ? [overlapCloud] : []), ...remaining].sort((a, b) => b.position[2] - a.position[2])
  }
  const west = ordered.filter((mass) => mass.position[0] < 0)
  const east = ordered.filter((mass) => mass.position[0] > 0)
  const westCount = Math.ceil(count / 2)
  const eastCount = Math.floor(count / 2)
  return [...sample(west, westCount), ...sample(east, eastCount)].sort((a, b) => b.position[2] - a.position[2])
}

/** Slow, seeded world-space drift keeps the cloud field calm while making parallax legible. */
export function getGalleryCloudDrift(
  mass: GalleryAtmosphereMass,
  time: number,
  speed = 0.7,
  variation = 0.5,
): readonly [number, number, number] {
  if (!Number.isFinite(time)) return [0, 0, 0]
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, Math.min(3, speed)) : 0
  const safeVariation = Number.isFinite(variation) ? Math.max(0, Math.min(1, variation)) : 0
  if (safeSpeed === 0) return [0, 0, 0]
  const phase = mass.seed * 0.137
  const seedVariation = ((Math.sin(mass.seed * 12.9898) * 43758.5453) % 1 + 1) % 1
  const tempo = 1 + (seedVariation - 0.5) * safeVariation * 0.7
  const amplitude = 0.82 + seedVariation * safeVariation * 0.58
  const t = time * safeSpeed * tempo
  return [
    Math.sin(t * 0.085 + phase) * 0.9 * amplitude,
    Math.sin(t * 0.061 + phase * 0.73) * 0.24 * amplitude,
    Math.cos(t * 0.073 + phase * 1.11) * 0.65 * amplitude,
  ]
}

export function getGalleryHazeMasses(quality: GalleryQuality): readonly GalleryAtmosphereMass[] {
  return quality === 'low' ? GALLERY_WORLD.haze.filter((mass) => mass.lowQuality) : GALLERY_WORLD.haze
}
