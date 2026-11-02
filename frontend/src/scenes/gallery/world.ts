import { GALLERY } from './content'
import type { GalleryCloudLayerSettings, GalleryCloudLayers } from '../../systems/scene-config/config'

export type GalleryQuality = 'low' | 'standard'
export type GalleryCloudLayerId = keyof GalleryCloudLayers

/** Per-frame raymarch draw-call ceilings; the registry can stay denser than the rendered subset. */
export const GALLERY_CLOUD_RENDER_LIMIT: Readonly<Record<GalleryQuality, number>> = { low: 20, standard: 36 }

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
  ...createRouteCloudLayer({ id: 'near-low-bank', layer: 'nearLow', count: 24, x: 10.1, y: 1.85, radii: [4.35, 4, 10.5], opacity: 0.8, seed: 211, yJitter: 0.75, xJitter: 0.3 }),
  ...createRouteCloudLayer({ id: 'waterline-bank', layer: 'waterline', count: 32, x: 12.2, y: 0.55, radii: [6.2, 3.5, 8.5], opacity: 0.82, seed: 421, yJitter: 0.45, xJitter: 0.3 }),
]

/** Fixed world-space bounds shared by the gallery environment and its tests. */
export const GALLERY_WORLD = {
  floor: { y: -2.35, centerZ: -180, width: 140, depth: 470 },
  // Separate soft volumes soften the horizon without placing a screen-facing image in the scene.
  haze: [
    { id: 'haze-near', position: [-1.5, -1.25, -67] as const, radii: [38, 3.8, 17] as const, opacity: 0.1, seed: 181, lowQuality: true },
    { id: 'haze-middle', position: [2, -0.6, -98] as const, radii: [48, 4.5, 20] as const, opacity: 0.13, seed: 211, lowQuality: false },
    { id: 'haze-far', position: [0, 0.3, -128] as const, radii: [54, 5.5, 23] as const, opacity: 0.16, seed: 227, lowQuality: true },
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
    : scaleLayerQuotas(layers, requested, limit)
  if (quality === 'low' && requestedTotal > limit) {
    const moveTo = (target: GalleryCloudLayerId, count: number, donors: readonly { layer: GalleryCloudLayerId; minimum: number }[]) => {
      while (quotas.get(target)! < count) {
        const donor = donors.find(({ layer, minimum }) => quotas.get(layer)! > minimum)
        if (!donor) break
        quotas.set(donor.layer, quotas.get(donor.layer)! - 1)
        quotas.set(target, quotas.get(target)! + 1)
      }
    }
    moveTo('far', Math.min(3, requested.get('far')!), [
      { layer: 'mid', minimum: Math.min(2, requested.get('mid')!) },
      { layer: 'waterline', minimum: Math.min(1, requested.get('waterline')!) },
    ])
    moveTo('nearLow', Math.min(8, requested.get('nearLow')!), [
      { layer: 'mid', minimum: Math.min(2, requested.get('mid')!) },
      { layer: 'waterline', minimum: Math.min(1, requested.get('waterline')!) },
      { layer: 'far', minimum: Math.min(3, requested.get('far')!) },
    ])
    moveTo('waterline', Math.min(7, requested.get('waterline')!), [
      { layer: 'mid', minimum: Math.min(2, requested.get('mid')!) },
      { layer: 'far', minimum: Math.min(3, requested.get('far')!) },
    ])
    moveTo('mid', Math.min(2, requested.get('mid')!), [
      { layer: 'waterline', minimum: Math.min(2, requested.get('waterline')!) },
      { layer: 'far', minimum: Math.min(3, requested.get('far')!) },
    ])
  }

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
): Map<GalleryCloudLayerId, number> {
  const total = [...requested.values()].reduce((sum, count) => sum + count, 0)
  const exact = new Map(layers.map((layer) => [layer, (requested.get(layer)! * limit) / total]))
  const quotas = new Map(layers.map((layer) => [layer, Math.floor(exact.get(layer)!)]))
  let remaining = limit - [...quotas.values()].reduce((sum, count) => sum + count, 0)
  const order = [...layers].sort((a, b) => (exact.get(b)! - quotas.get(b)!) - (exact.get(a)! - quotas.get(a)!))
  for (const layer of order) {
    if (remaining === 0) break
    if (requested.get(layer)! > 0) {
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
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, Math.min(2, speed)) : 0
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
