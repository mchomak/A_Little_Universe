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
    // These lateral masses remain outside the photo corridor but show clear parallax while walking.
    { id: 'side-west-near', position: [-27, 4.7, -32] as const, radii: [12, 5.3, 7.5] as const, opacity: 0.52, seed: 13, lowQuality: true },
    { id: 'side-east-near', position: [28, 5.4, -48] as const, radii: [13, 6.2, 8] as const, opacity: 0.5, seed: 37, lowQuality: false },
    { id: 'side-west-mid', position: [-30, 6.1, -69] as const, radii: [15, 6.5, 9] as const, opacity: 0.48, seed: 61, lowQuality: true },
    { id: 'side-east-mid', position: [30, 7.1, -83] as const, radii: [16, 7, 10] as const, opacity: 0.46, seed: 83, lowQuality: false },
    // Broad distant banks frame the moon while leaving generous dark sky above it.
    { id: 'far-west', position: [-20, 8.3, -104] as const, radii: [24, 8.5, 11] as const, opacity: 0.53, seed: 107, lowQuality: true },
    { id: 'far-east', position: [24, 8.8, -112] as const, radii: [26, 9, 12] as const, opacity: 0.5, seed: 131, lowQuality: false },
    { id: 'deep-west', position: [-25, 10.4, -144] as const, radii: [30, 10.5, 14] as const, opacity: 0.44, seed: 149, lowQuality: true },
    { id: 'deep-east', position: [29, 11.2, -155] as const, radii: [32, 11, 15] as const, opacity: 0.42, seed: 151, lowQuality: false },
    // A low, broken wisp partly veils the fixed moon without covering its centre.
    { id: 'moon-veil', position: [0.6, 14.8, -124.4] as const, radii: [5.7, 1.55, 2.2] as const, opacity: 0.35, seed: 173, lowQuality: true },
  ] satisfies readonly GalleryAtmosphereMass[],
} as const

/** A few fixed, soft atmospheric pools trace the moon-to-gallery light path. */
export function getGalleryMoonScatteringLayers(): readonly GalleryMoonScatteringLayer[] {
  const start = GALLERY_WORLD.moon.position
  const end = [0, GALLERY_WORLD.floor.y + 2.6, -32] as const
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

export function getGalleryHazeMasses(quality: GalleryQuality): readonly GalleryAtmosphereMass[] {
  return quality === 'low' ? GALLERY_WORLD.haze.filter((mass) => mass.lowQuality) : GALLERY_WORLD.haze
}
