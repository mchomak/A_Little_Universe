/** Wake a demand-rendered scene when the browser makes it visible again. */
export function wakeOnVisible(visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>, invalidate: () => void) {
  const wake = () => { if (!visibility.hidden) invalidate() }
  visibility.addEventListener('visibilitychange', wake)
  return () => visibility.removeEventListener('visibilitychange', wake)
}

export const GALLERY_FADE_START = 32
export const GALLERY_FADE_END = 40
const MIN_CONTEXT_OPACITY = 0.2

/** Smoothly fades a photo by its real camera distance before it is culled. */
export function galleryDistanceOpacity(distance: number, start = GALLERY_FADE_START, end = GALLERY_FADE_END) {
  if (!Number.isFinite(distance) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || distance >= end) return 0
  if (distance <= start) return 1
  const t = (distance - start) / (end - start)
  return 1 - t * t * (3 - 2 * t)
}

/** Keeps faint nearby gallery context around the selected photo without time-based disappearance. */
export function galleryFocusOpacity(focusMix: number, selected: boolean) {
  if (selected) return 1
  const mix = Number.isFinite(focusMix) ? Math.max(0, Math.min(1, focusMix)) : 0
  return 1 - mix * (1 - MIN_CONTEXT_OPACITY)
}
