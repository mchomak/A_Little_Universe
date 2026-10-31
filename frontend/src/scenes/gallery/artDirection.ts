/** Scene 05 visual tuning. Values stay local to the gallery. */
export const GALLERY_ART = {
  // Photo planes sit close to the two corridor walls and turn inward toward
  // the passage. Keep this shared by the walk pose and the focus camera.
  wallYaw: 1.15,
  photoBlurStart: 14,
  photoBlurEnd: 30,
  photoLightStart: 9,
  photoLightEnd: 27,
  frameParticleSpacing: 0.28,
  frameParticleSize: [0.045, 0.075] as const,
  dustCount: 320,
  lowDustCount: 96,
  floorParticleCount: 80,
  lowFloorParticleCount: 36,
} as const

function smoothstep(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

/** Distant photos lose detail gradually while selected photos stay crisp. */
export function galleryPhotoBlur(distance: number, selected = false) {
  if (selected || !Number.isFinite(distance)) return 0
  return smoothstep(GALLERY_ART.photoBlurStart, GALLERY_ART.photoBlurEnd, distance)
}

export function galleryPhotoBlurAtFocus(distance: number, focusMix: number) {
  const focus = Number.isFinite(focusMix) ? Math.max(0, Math.min(1, focusMix)) : 0
  return galleryPhotoBlur(distance) * (1 - focus)
}

/** A restrained cool lift in the top half of nearby photos. */
export function galleryPhotoLight(distance: number, selected = false) {
  if (!Number.isFinite(distance)) return 0
  const proximity = 1 - smoothstep(GALLERY_ART.photoLightStart, GALLERY_ART.photoLightEnd, distance)
  return 0.018 + proximity * 0.075 + (selected ? 0.025 : 0)
}

export function galleryPhotoLightAtFocus(distance: number, focusMix: number) {
  const focus = Number.isFinite(focusMix) ? Math.max(0, Math.min(1, focusMix)) : 0
  return galleryPhotoLight(distance) + 0.025 * focus
}
