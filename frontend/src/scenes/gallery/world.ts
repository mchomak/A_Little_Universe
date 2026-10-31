export type GalleryQuality = 'low' | 'standard'

export interface GalleryAtmosphereMass {
  id: string
  position: readonly [number, number, number]
  radii: readonly [number, number, number]
  opacity: number
  seed: number
  lowQuality: boolean
}

export interface GalleryCloudWisp extends GalleryAtmosphereMass {
  bankId: string
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
    { id: 'side-west-near', position: [-27, 4.7, -32] as const, radii: [12, 5.3, 7.5] as const, opacity: 0.48, seed: 13, lowQuality: true },
    { id: 'side-east-near', position: [28, 5.4, -48] as const, radii: [13, 6.2, 8] as const, opacity: 0.46, seed: 37, lowQuality: true },
    { id: 'side-west-mid', position: [-30, 6.1, -69] as const, radii: [15, 6.5, 9] as const, opacity: 0.44, seed: 61, lowQuality: true },
    { id: 'side-east-mid', position: [30, 7.1, -83] as const, radii: [16, 7, 10] as const, opacity: 0.42, seed: 83, lowQuality: true },
    { id: 'side-west-far', position: [-34, 8, -108] as const, radii: [18, 7.8, 10.5] as const, opacity: 0.38, seed: 107, lowQuality: false },
    { id: 'side-east-far', position: [35, 8.7, -119] as const, radii: [19, 8.2, 11] as const, opacity: 0.36, seed: 131, lowQuality: false },
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

function seededFraction(seed: number, salt: number): number {
  const value = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** Expands selected world-space cloud banks into deterministic, overlapping silhouette lobes. */
export function getGalleryCloudWisps(quality: GalleryQuality, bankCount = GALLERY_WORLD.clouds.length): readonly GalleryCloudWisp[] {
  const limit = Number.isFinite(bankCount) ? Math.max(0, Math.floor(bankCount)) : 0
  return getGalleryCloudMasses(quality).slice(0, limit).flatMap((bank) => {
    const count = quality === 'low' ? 2 : 3
    const phase = seededFraction(bank.seed, 2) * Math.PI * 2
    const cos = Math.cos(phase)
    const sin = Math.sin(phase)
    const layout = [
      { x: -0.04, y: 0.02, z: 0, scale: 0.62 },
      { x: 0.47, y: 0.1, z: -0.08, scale: 0.55 },
      { x: -0.09, y: -0.46, z: 0.12, scale: 0.5 },
    ]

    return layout.slice(0, count).map((lobe, index) => {
      const salt = (index + 1) * 7
      const jitterX = (seededFraction(bank.seed, salt) - 0.5) * 0.1
      const jitterY = (seededFraction(bank.seed, salt + 1) - 0.5) * 0.08
      const jitterZ = (seededFraction(bank.seed, salt + 2) - 0.5) * 0.1
      const localX = lobe.x + jitterX
      const localY = lobe.y + jitterY
      const scaleVariation = 0.94 + seededFraction(bank.seed, salt + 3) * 0.13
      const radiusScale = lobe.scale * scaleVariation
      const opacityVariation = 0.92 + seededFraction(bank.seed, salt + 4) * 0.16
      const opacity = bank.opacity * 0.68 * opacityVariation

      return {
        id: `${bank.id}-wisp-${index + 1}`,
        bankId: bank.id,
        position: [
          bank.position[0] + (localX * cos - localY * sin) * bank.radii[0],
          bank.position[1] + (localX * sin + localY * cos) * bank.radii[1],
          bank.position[2] + (lobe.z + jitterZ) * bank.radii[2],
        ] as const,
        radii: [
          bank.radii[0] * radiusScale,
          bank.radii[1] * radiusScale * (0.88 + seededFraction(bank.seed, salt + 5) * 0.12),
          bank.radii[2] * radiusScale * (0.9 + seededFraction(bank.seed, salt + 6) * 0.1),
        ] as const,
        opacity,
        seed: bank.seed + (index + 1) * 17.3,
        lowQuality: bank.lowQuality,
      }
    })
  })
}

export function getGalleryHazeMasses(quality: GalleryQuality): readonly GalleryAtmosphereMass[] {
  return quality === 'low' ? GALLERY_WORLD.haze.filter((mass) => mass.lowQuality) : GALLERY_WORLD.haze
}
