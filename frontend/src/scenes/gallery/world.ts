export type GalleryQuality = 'low' | 'standard'

export interface GalleryAtmosphereMass {
  id: string
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  opacity: number
  seed: number
  lowQuality: boolean
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
    // Broad lateral masses frame the corridor; their inner edges stay outside the photo line.
    { id: 'side-west-near', position: [-22, 11, -25] as const, radii: [12.5, 8, 17] as const, opacity: 0.48, seed: 13, lowQuality: true },
    { id: 'side-east-near', position: [23, 12, -42] as const, radii: [12.5, 8.5, 18] as const, opacity: 0.46, seed: 37, lowQuality: true },
    { id: 'side-west-mid', position: [-27, 14, -66] as const, radii: [15.5, 10, 24] as const, opacity: 0.44, seed: 61, lowQuality: true },
    { id: 'side-east-mid', position: [28, 15, -88] as const, radii: [16, 10.5, 23] as const, opacity: 0.42, seed: 83, lowQuality: true },
    { id: 'side-west-far', position: [-32, 18, -117] as const, radii: [18, 12, 27] as const, opacity: 0.38, seed: 107, lowQuality: false },
    { id: 'side-east-far', position: [34, 19, -146] as const, radii: [18, 12, 27] as const, opacity: 0.36, seed: 131, lowQuality: false },
    // Higher masses frame the moon and add a second silhouette plane behind the gallery.
    { id: 'upper-west', position: [-25, 28, -119] as const, radii: [20, 8.5, 27] as const, opacity: 0.34, seed: 149, lowQuality: true },
    { id: 'upper-east', position: [28, 31, -145] as const, radii: [21, 9.5, 30] as const, opacity: 0.32, seed: 173, lowQuality: true },
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

/** Slow, seeded world-space drift keeps the cloud field calm while making parallax legible. */
export function getGalleryCloudDrift(
  mass: GalleryAtmosphereMass,
  time: number,
  speed = 0.7,
): readonly [number, number, number] {
  if (!Number.isFinite(time)) return [0, 0, 0]
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, Math.min(2, speed)) : 0
  if (safeSpeed === 0) return [0, 0, 0]
  const phase = mass.seed * 0.137
  const t = time * safeSpeed
  return [
    Math.sin(t * 0.027 + phase) * 1.12,
    Math.sin(t * 0.019 + phase * 0.73) * 0.36,
    Math.cos(t * 0.023 + phase * 1.11) * 0.72,
  ]
}

export function getGalleryHazeMasses(quality: GalleryQuality): readonly GalleryAtmosphereMass[] {
  return quality === 'low' ? GALLERY_WORLD.haze.filter((mass) => mass.lowQuality) : GALLERY_WORLD.haze
}
