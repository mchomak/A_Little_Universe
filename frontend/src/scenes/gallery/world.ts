import { GALLERY } from './content'

export type GalleryQuality = 'low' | 'standard'
export type GalleryCloudRegion = 'foreground' | 'midground' | 'background' | 'near-floor'

/** Per-frame raymarch draw-call ceilings; the registry can stay denser than the rendered subset. */
export const GALLERY_CLOUD_RENDER_LIMIT: Readonly<Record<GalleryQuality, number>> = { low: 14, standard: 18 }

export interface GalleryAtmosphereMass {
  id: string
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  opacity: number
  seed: number
  lowQuality: boolean
  region?: GalleryCloudRegion
}

export interface GalleryMoonScatteringLayer {
  position: readonly [number, number, number]
  size: number
  intensity: number
  seed: number
}

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
    // Foreground shapes enter from both edges, while their inner edges stay clear of the photo line.
    { id: 'side-west-near', region: 'foreground', position: [-14.5, 7.5, -9] as const, radii: [9.1, 6.3, 12] as const, opacity: 0.39, seed: 13, lowQuality: true },
    { id: 'side-east-near', region: 'foreground', position: [14.8, 8.6, -22] as const, radii: [9.2, 6.6, 13] as const, opacity: 0.37, seed: 37, lowQuality: true },
    { id: 'upper-west-near', region: 'foreground', position: [-14.8, 17.8, -19] as const, radii: [9.2, 5.4, 12] as const, opacity: 0.34, seed: 47, lowQuality: true },
    { id: 'upper-east-near', region: 'foreground', position: [15.1, 18.5, -34] as const, radii: [9.6, 5.8, 13] as const, opacity: 0.32, seed: 53, lowQuality: true },
    { id: 'edge-west-late', region: 'foreground', position: [-15.1, 8.2, -47] as const, radii: [9.4, 6.4, 14] as const, opacity: 0.34, seed: 59, lowQuality: true },
    { id: 'edge-east-end', region: 'foreground', position: [15.2, 9.1, -62] as const, radii: [9.6, 6.5, 14] as const, opacity: 0.33, seed: 67, lowQuality: true },
    { id: 'side-west-mid', region: 'midground', position: [-18, 11.8, -51] as const, radii: [10.8, 7.8, 19] as const, opacity: 0.35, seed: 61, lowQuality: true },
    { id: 'side-east-mid', region: 'midground', position: [18.5, 13, -73] as const, radii: [11, 8, 19] as const, opacity: 0.34, seed: 83, lowQuality: true },
    { id: 'mid-west-entry', region: 'midground', position: [-13.6, 9.5, 2] as const, radii: [7.4, 6.3, 18] as const, opacity: 0.37, seed: 71, lowQuality: true },
    { id: 'mid-east-early', region: 'midground', position: [13.6, 10, -15] as const, radii: [7.4, 6.4, 17] as const, opacity: 0.36, seed: 79, lowQuality: true },
    { id: 'mid-west-middle', region: 'midground', position: [-13.6, 11, -35] as const, radii: [7.5, 6.5, 18] as const, opacity: 0.35, seed: 87, lowQuality: true },
    { id: 'mid-east-late', region: 'midground', position: [13.8, 12.2, -46] as const, radii: [7.6, 6.8, 18] as const, opacity: 0.34, seed: 93, lowQuality: true },
    // Low banks reach the reflective floor and overlap down the entire walk.
    { id: 'floor-west-near', region: 'near-floor', position: [-16.5, 1.95, -5] as const, radii: [9.5, 4.35, 14] as const, opacity: 0.76, seed: 89, lowQuality: true },
    { id: 'floor-east-mid', region: 'near-floor', position: [16, 1.99, -19] as const, radii: [9.5, 4.35, 14] as const, opacity: 0.74, seed: 97, lowQuality: true },
    { id: 'floor-west-middle', region: 'near-floor', position: [-16.8, 1.9, -34] as const, radii: [9.8, 4.3, 15] as const, opacity: 0.73, seed: 101, lowQuality: true },
    { id: 'floor-east-late', region: 'near-floor', position: [16.5, 2, -49] as const, radii: [9.5, 4.4, 15] as const, opacity: 0.72, seed: 103, lowQuality: true },
    { id: 'floor-west-end', region: 'near-floor', position: [-16.2, 1.9, -65] as const, radii: [9.8, 4.35, 15] as const, opacity: 0.71, seed: 105, lowQuality: true },
    // Far clouds are softer and sparser around the moon and distant horizon.
    { id: 'sky-west-entry', region: 'background', position: [-26, 25, -6] as const, radii: [16, 7.5, 22] as const, opacity: 0.26, seed: 109, lowQuality: true },
    { id: 'sky-east-middle', region: 'background', position: [27, 27, -35] as const, radii: [17, 8, 24] as const, opacity: 0.25, seed: 113, lowQuality: true },
    { id: 'sky-west-late', region: 'background', position: [-28, 28, -64] as const, radii: [18, 8.5, 26] as const, opacity: 0.23, seed: 127, lowQuality: true },
    { id: 'side-west-far', region: 'background', position: [-30, 16, -106] as const, radii: [17, 10.5, 25] as const, opacity: 0.28, seed: 107, lowQuality: false },
    { id: 'side-east-far', region: 'background', position: [32, 18, -136] as const, radii: [18, 11, 27] as const, opacity: 0.27, seed: 131, lowQuality: false },
    { id: 'upper-west-far', region: 'background', position: [-27, 28, -119] as const, radii: [19, 8.5, 27] as const, opacity: 0.24, seed: 149, lowQuality: false },
    { id: 'upper-east-far', region: 'background', position: [30, 30, -149] as const, radii: [20, 9.5, 29] as const, opacity: 0.23, seed: 173, lowQuality: false },
  ] satisfies readonly GalleryAtmosphereMass[],
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

export function getGalleryCloudMasses(quality: GalleryQuality): readonly GalleryAtmosphereMass[] {
  return quality === 'low' ? GALLERY_WORLD.clouds.filter((mass) => mass.lowQuality) : GALLERY_WORLD.clouds
}

/** Selects a balanced set so a lower Inspector count still keeps near, middle, and far planes. */
export function getGalleryCloudMassesForCount(
  quality: GalleryQuality,
  count: number,
): readonly GalleryAtmosphereMass[] {
  const masses = getGalleryCloudMasses(quality)
  const safeCount = Number.isFinite(count)
    ? Math.max(0, Math.min(masses.length, GALLERY_CLOUD_RENDER_LIMIT[quality], Math.floor(count)))
    : Math.min(masses.length, GALLERY_CLOUD_RENDER_LIMIT[quality])
  if (safeCount === 0) return []
  const regions: readonly GalleryCloudRegion[] = ['foreground', 'background', 'midground', 'near-floor']
  const grouped = new Map(regions.map((region) => [region, masses.filter((mass) => mass.region === region)]))
  const sampleEvenly = (group: readonly GalleryAtmosphereMass[], target: number) => {
    const ordered = [...group].sort((a, b) => b.position[2] - a.position[2])
    if (target >= ordered.length) return ordered
    if (target === 1) return [ordered[Math.floor((ordered.length - 1) / 2)]!]
    return Array.from({ length: target }, (_, index) => {
      const sampleIndex = target === 3 && index === 1
        ? Math.floor((ordered.length - 1) / 2)
        : Math.round(index * (ordered.length - 1) / (target - 1))
      return ordered[sampleIndex]!
    })
  }
  // Keep every depth plane represented at small counts. Once there is room,
  // preserve all five floor banks first so the route retains floor-level cover.
  if (safeCount < 5) {
    const selected: GalleryAtmosphereMass[] = []
    let round = 0
    while (selected.length < safeCount) {
      for (const region of regions) {
        const group = grouped.get(region) ?? []
        const mass = sampleEvenly(group, Math.min(group.length, round + 1))[round]
        if (mass && !selected.includes(mass)) selected.push(mass)
        if (selected.length === safeCount) break
      }
      round += 1
    }
    return selected
  }

  const floorGroup = grouped.get('near-floor') ?? []
  const floorCount = Math.min(floorGroup.length, safeCount - 3)
  const quotas = new Map<GalleryCloudRegion, number>(regions.map((region) => [region, region === 'near-floor' ? floorCount : 0]))
  let remaining = safeCount - floorCount
  // Start each side/background plane before filling the remaining slots evenly.
  for (const region of ['foreground', 'background', 'midground'] as const) {
    if (remaining === 0) break
    if ((grouped.get(region)?.length ?? 0) > 0) {
      quotas.set(region, 1)
      remaining -= 1
    }
  }
  while (remaining > 0) {
    let filled = false
    for (const region of ['foreground', 'background', 'midground'] as const) {
      const quota = quotas.get(region) ?? 0
      if (quota >= (grouped.get(region)?.length ?? 0)) continue
      quotas.set(region, quota + 1)
      remaining -= 1
      filled = true
      if (remaining === 0) break
    }
    if (!filled) break
  }

  // Background route shelves precede the four far moon-horizon volumes, so a
  // capped subset keeps clouds along the gallery instead of spending draws past it.
  return regions.flatMap((region) => {
    const group = grouped.get(region) ?? []
    const routeEnd = GALLERY.startZ - GALLERY.travel
    const ordered = region === 'background'
      ? [...group.filter((mass) => mass.position[2] >= routeEnd - 12), ...group.filter((mass) => mass.position[2] < routeEnd - 12)]
      : group
    return sampleEvenly(ordered, Math.min(ordered.length, quotas.get(region) ?? 0))
  })
}

export function getGalleryCloudRegionAmount(
  region: GalleryCloudRegion | undefined,
  amounts: { foreground: number; background: number; nearFloor: number },
): number {
  if (region === 'foreground') return Math.max(0, Math.min(1.6, amounts.foreground))
  if (region === 'background') return Math.max(0, Math.min(1.6, amounts.background))
  if (region === 'near-floor') return Math.max(0, Math.min(1.6, amounts.nearFloor))
  return 1
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
