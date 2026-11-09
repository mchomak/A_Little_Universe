function smooth(start: number, end: number, time: number) {
  if (!Number.isFinite(time)) return 0
  const progress = Math.max(0, Math.min(1, (time - start) / (end - start)))
  return progress * progress * (3 - 2 * progress)
}

/** Fades the gallery over seconds 0–7 of the planetarium transition. */
export function getPlanetariumGalleryFade(time: number) {
  return smooth(0, 7, time)
}

export function getPlanetariumGalleryOpacity(time: number) {
  return 1 - getPlanetariumGalleryFade(time)
}

export function getPlanetariumGalleryWaterOpacity(entryOpacity: number, time: number) {
  return entryOpacity * getPlanetariumGalleryOpacity(time)
}

/** Reveals the existing galaxy over seconds 5–10, overlapping the gallery fade. */
export function getPlanetariumGalaxyFade(time: number) {
  return smooth(5, 10, time)
}
