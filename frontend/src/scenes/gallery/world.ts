import { GALLERY } from './content'
import type { GalleryCloudLayerSettings, GalleryCloudLayers } from '../../systems/scene-config/config'

export type GalleryQuality = 'low' | 'standard'
export type GalleryCloudLayerId = keyof GalleryCloudLayers

/** Per-frame raymarch draw-call ceilings; the registry can stay denser than the rendered subset. */
export const GALLERY_CLOUD_RENDER_LIMIT: Readonly<Record<GalleryQuality, number>> = { low: 16, standard: 24 }

export type GalleryAtmosphereLayer = GalleryCloudLayerId | 'haze'

const cloudLayerMinimums: Readonly<Record<GalleryQuality, Readonly<Record<GalleryCloudLayerId, number>>>> = {
  standard: { far: 3, mid: 1, nearLow: 8, waterline: 10 },
  low: { far: 3, mid: 1, nearLow: 6, waterline: 6 },
}

const cloudStepProfiles: Readonly<Record<GalleryQuality, Readonly<Record<GalleryAtmosphereLayer, { near: number; far: number; reflection: number }>>>> = {
  standard: {
    far: { near: 4, far: 2, reflection: 2 },
    mid: { near: 5, far: 2, reflection: 2 },
    nearLow: { near: 12, far: 5, reflection: 4 },
    waterline: { near: 12, far: 5, reflection: 4 },
    haze: { near: 6, far: 3, reflection: 2 },
  },
  low: {
    far: { near: 3, far: 3, reflection: 2 },
    mid: { near: 3, far: 3, reflection: 2 },
    nearLow: { near: 4, far: 3, reflection: 3 },
    waterline: { near: 4, far: 3, reflection: 3 },
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
  if (reflection) return profile.reflection
  const distance = Number.isFinite(cameraDistance) ? Math.max(0, cameraDistance) : CLOUD_DETAIL_FAR_DISTANCE
  const detail = 1 - smoothstep(CLOUD_DETAIL_NEAR_DISTANCE, CLOUD_DETAIL_FAR_DISTANCE, distance)
  return profile.far + (profile.near - profile.far) * detail
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

const routeClouds = [
  ...createRouteCloudLayer({ id: 'mid-bank', layer: 'mid', count: 20, x: 17.6, y: 10, radii: [10.5, 6.8, 20], opacity: 0.64, seed: 61, yJitter: 2.2, xJitter: 1.4 }),
  ...createRouteCloudLayer({ id: 'near-low-bank', layer: 'nearLow', count: 24, x: 10.1, y: 1.85, radii: [4.35, 4, 14], opacity: 0.8, seed: 211, yJitter: 0.75, xJitter: 0.3 }),
  ...createRouteCloudLayer({ id: 'waterline-bank', layer: 'waterline', count: 32, x: 12.2, y: 0.2, radii: [6.2, 4.1, 10.4], opacity: 0.82, seed: 421, yJitter: 0.45, xJitter: 0.3 }),
]

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
  moon: { position: [0.2, 16, -126] as const, radius: 2.15, haloRadius: 6.5 },
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
    // Place two thin, layered wisps across opposite lunar edges; their translucency keeps the disc and halo legible.
    { id: 'moon-wisp-east', layer: 'far', position: [0.9, 17.35, -123.2], radii: [6.5, 2, 8.2], opacity: 0.42, seed: 601, lowQuality: true, moonInteraction: true },
    { id: 'moon-wisp-west', layer: 'far', position: [-3.7, 15.25, -123.5], radii: [6.2, 1.6, 8.5], opacity: 0.3, seed: 619, lowQuality: true, moonInteraction: true },
    ...routeClouds,
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

export function getGalleryCloudMasses(quality: GalleryQuality): readonly GalleryCloudMass[] {
  return quality === 'low' ? GALLERY_WORLD.clouds.filter((mass) => mass.lowQuality) : GALLERY_WORLD.clouds
}

export function getGalleryCloudMassesForLayerCounts(
  quality: GalleryQuality,
  settings: GalleryCloudLayers,
): readonly GalleryCloudMass[] {
  const layers: readonly GalleryCloudLayerId[] = ['far', 'mid', 'nearLow', 'waterline']
  const candidates = new Map(layers.map((layer) => [layer, getGalleryCloudMasses(quality).filter((mass) => mass.layer === layer)]))
  const requested = new Map(layers.map((layer) => [layer, Math.max(0, Math.min(candidates.get(layer)!.length, Math.floor(settings[layer].count)))]))
  const requestedTotal = [...requested.values()].reduce((sum, count) => sum + count, 0)
  const limit = GALLERY_CLOUD_RENDER_LIMIT[quality]
  const quotas = requestedTotal <= limit
    ? requested
    : scaleLayerQuotas(layers, requested, limit, cloudLayerMinimums[quality])

  return layers.flatMap((layer) => sampleLayer(candidates.get(layer)!, quotas.get(layer)!, layer))
}

export function getGalleryCloudPosition(mass: GalleryAtmosphereMass, settings: GalleryCloudLayerSettings): readonly [number, number, number] {
  return [
    mass.position[0] + Math.sign(mass.position[0]) * settings.distance,
    mass.position[1] + settings.height,
    mass.position[2],
  ]
}

export function getGalleryCloudRadii(mass: GalleryCloudMass, settings: GalleryCloudLayerSettings, quality: GalleryQuality = 'standard'): readonly [number, number, number] {
  const qualityDepthScale = quality === 'low'
    ? mass.layer === 'nearLow' ? 1.65 : mass.layer === 'waterline' ? 2.15 : 1
    : 1
  return [mass.radii[0] * settings.scale, mass.radii[1] * settings.scale, mass.radii[2] * settings.scale * qualityDepthScale]
}

function scaleLayerQuotas(
  layers: readonly GalleryCloudLayerId[],
  requested: ReadonlyMap<GalleryCloudLayerId, number>,
  limit: number,
  minimums: Readonly<Record<GalleryCloudLayerId, number>>,
): Map<GalleryCloudLayerId, number> {
  const quotas = new Map(layers.map((layer) => [layer, Math.min(requested.get(layer)!, minimums[layer])]))
  const remainingCapacity = limit - [...quotas.values()].reduce((sum, count) => sum + count, 0)
  const remainingRequests = new Map(layers.map((layer) => [layer, requested.get(layer)! - quotas.get(layer)!]))
  const totalRemainingRequests = [...remainingRequests.values()].reduce((sum, count) => sum + count, 0)
  if (remainingCapacity <= 0 || totalRemainingRequests <= 0) return quotas

  const exact = new Map(layers.map((layer) => [layer, (remainingRequests.get(layer)! * remainingCapacity) / totalRemainingRequests]))
  let remaining = remainingCapacity
  for (const layer of layers) {
    const whole = Math.floor(exact.get(layer)!)
    quotas.set(layer, quotas.get(layer)! + whole)
    remaining -= whole
  }
  const order = [...layers].sort((a, b) => (exact.get(b)! - Math.floor(exact.get(b)!)) - (exact.get(a)! - Math.floor(exact.get(a)!)))
  for (const layer of order) {
    if (remaining === 0) break
    if (quotas.get(layer)! < requested.get(layer)!) {
      quotas.set(layer, quotas.get(layer)! + 1)
      remaining -= 1
    }
  }
  return quotas
}

function sampleLayer(
  masses: readonly GalleryCloudMass[],
  count: number,
  layer: GalleryCloudLayerId,
): GalleryCloudMass[] {
  const ordered = [...masses].sort((a, b) => b.position[2] - a.position[2])
  const sample = (group: readonly GalleryCloudMass[], target: number): GalleryCloudMass[] => {
    if (target <= 0) return []
    if (target >= group.length) return [...group]
    if (target === 1) return [group[Math.floor((group.length - 1) / 2)]!]
    return Array.from({ length: target }, (_, index) => group[Math.round(index * (group.length - 1) / (target - 1))]!)
  }
  if (count === 0 || ordered.length === 0) return []
  if (layer === 'far') {
    const selected = sample(ordered, count)
    const moonWisps = ordered.filter((mass) => mass.moonInteraction).slice(0, 2)
    let replacementIndex = selected.length - 1
    for (const wisp of moonWisps) {
      if (selected.includes(wisp) || selected.length < 3) continue
      while (replacementIndex >= 0 && selected[replacementIndex]!.moonInteraction) replacementIndex -= 1
      if (replacementIndex < 0) break
      selected[replacementIndex] = wisp
      replacementIndex -= 1
    }
    return [...new Set(selected)].sort((a, b) => b.position[2] - a.position[2])
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
