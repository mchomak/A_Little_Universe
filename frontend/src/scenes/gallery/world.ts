export type GalleryQuality = 'low' | 'standard'
export type GalleryCloudAtlasSprite = 0 | 1 | 2 | 3

export interface GalleryCloudPlane {
  id: string
  position: readonly [number, number, number]
  size: readonly [number, number]
  atlasSprite: GalleryCloudAtlasSprite
  rotationY: number
  tint: string
  opacity: number
  seed: number
  lowQuality: boolean
}

/** Fixed world-space bounds shared by the gallery environment and its tests. */
export const GALLERY_WORLD = {
  floor: { y: -2.35, centerZ: -180, width: 140, depth: 470 },
  haze: { position: [0, -2.65, -108] as const, size: [100, 4.5] as const, seed: 181 },
  moon: { position: [0.2, 4.9, -126] as const, radius: 1.65, haloRadius: 10.5 },
  clouds: [
    // Broad sky forms sit behind every memory (the display corridor ends around z=-64).
    { id: 'far-west', position: [-16, 5.2, -104] as const, size: [34, 20] as const, atlasSprite: 0, rotationY: -0.055, tint: '#a6bad6', opacity: 0.72, seed: 13, lowQuality: true },
    { id: 'far-east', position: [17, 7.1, -111] as const, size: [38, 21] as const, atlasSprite: 1, rotationY: 0.07, tint: '#9aafcf', opacity: 0.7, seed: 37, lowQuality: false },
    { id: 'deep-west', position: [-7, 6.5, -137] as const, size: [40, 22] as const, atlasSprite: 2, rotationY: 0.04, tint: '#92a9ca', opacity: 0.62, seed: 61, lowQuality: true },
    { id: 'deep-east', position: [19, 8.2, -151] as const, size: [43, 23] as const, atlasSprite: 3, rotationY: -0.06, tint: '#a8bbd6', opacity: 0.58, seed: 83, lowQuality: false },
    // These thin world-fixed walls add depth at the margins without crossing the photo corridor.
    { id: 'side-west-near', position: [-21, 3.8, -34] as const, size: [27, 16] as const, atlasSprite: 1, rotationY: -Math.PI / 2, tint: '#9aafcd', opacity: 0.58, seed: 107, lowQuality: true },
    { id: 'side-east-near', position: [21, 4.6, -51] as const, size: [28, 16] as const, atlasSprite: 2, rotationY: Math.PI / 2, tint: '#9aafcd', opacity: 0.58, seed: 131, lowQuality: false },
    { id: 'side-west-deep', position: [-22, 5.7, -72] as const, size: [30, 18] as const, atlasSprite: 3, rotationY: -Math.PI / 2, tint: '#a7bad5', opacity: 0.55, seed: 149, lowQuality: true },
    { id: 'side-east-deep', position: [22, 6.1, -86] as const, size: [32, 19] as const, atlasSprite: 0, rotationY: Math.PI / 2, tint: '#a7bad5', opacity: 0.52, seed: 151, lowQuality: false },
    { id: 'moon-veil', position: [0.35, 5.15, -124.2] as const, size: [13, 6] as const, atlasSprite: 0, rotationY: 0, tint: '#d4e1f1', opacity: 0.2, seed: 173, lowQuality: true },
  ] satisfies readonly GalleryCloudPlane[],
} as const

export function getGalleryCloudPlanes(quality: GalleryQuality): readonly GalleryCloudPlane[] {
  return quality === 'low' ? GALLERY_WORLD.clouds.filter((plane) => plane.lowQuality) : GALLERY_WORLD.clouds
}

/** Resolution used only by the procedural cloud fallback when the bundled atlas cannot load. */
export function getGalleryCloudTextureDimensions(quality: GalleryQuality): readonly [number, number] {
  return quality === 'low' ? [144, 72] : [256, 128]
}

