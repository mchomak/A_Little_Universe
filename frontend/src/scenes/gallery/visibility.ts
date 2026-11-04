/** Wake a demand-rendered scene when the browser makes it visible again. */
export function wakeOnVisible(visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>, invalidate: () => void) {
  const wake = () => { if (!visibility.hidden) invalidate() }
  visibility.addEventListener('visibilitychange', wake)
  return () => visibility.removeEventListener('visibilitychange', wake)
}

export const GALLERY_FADE_START = 32
export const GALLERY_FADE_END = 40
const MIN_CONTEXT_OPACITY = 0.2
export const GALLERY_DISTANCE_SILHOUETTE_OPACITY = 0.2
export const GALLERY_DISTANCE_SILHOUETTE_END = 40
export const GALLERY_DISTANCE_CULL_END = 120

/** Smoothly fades a photo by its real camera distance before it is culled. */
export function galleryDistanceOpacity(distance: number, start = GALLERY_FADE_START, end = GALLERY_FADE_END) {
  if (!Number.isFinite(distance) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || distance >= GALLERY_DISTANCE_CULL_END) return 0
  if (distance <= start) return 1
  const smooth = (value: number) => value * value * (3 - 2 * value)
  if (distance <= end) {
    const t = (distance - start) / (end - start)
    return 1 - (1 - GALLERY_DISTANCE_SILHOUETTE_OPACITY) * smooth(t)
  }
  const t = (distance - GALLERY_DISTANCE_SILHOUETTE_END) / (GALLERY_DISTANCE_CULL_END - GALLERY_DISTANCE_SILHOUETTE_END)
  return GALLERY_DISTANCE_SILHOUETTE_OPACITY * (1 - smooth(Math.max(0, Math.min(1, t))))
}

/** The distant arch stays visible as a moonlit outline, then eases brighter as the viewer approaches. */
export function galleryArchDistanceOpacity(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) return 0.55
  const t = Math.max(0, Math.min(1, (distance - 18) / (100 - 18)))
  const smooth = t * t * (3 - 2 * t)
  return 1 - smooth * 0.45
}

/** Keeps faint nearby gallery context around the selected photo without time-based disappearance. */
export function galleryFocusOpacity(focusMix: number, selected: boolean) {
  if (selected) return 1
  const mix = Number.isFinite(focusMix) ? Math.max(0, Math.min(1, focusMix)) : 0
  return 1 - mix * (1 - MIN_CONTEXT_OPACITY)
}

/** Gallery columns follow scene presence and distance, never the photo focus fade. */
export function galleryColumnOpacity(visible: number, exitMix: number, distanceOpacity: number) {
  const visibleAlpha = Number.isFinite(visible) ? Math.max(0, Math.min(1, visible)) : 0
  const safeExitMix = Number.isFinite(exitMix) ? Math.max(0, Math.min(1, exitMix)) : 0
  const distanceAlpha = Number.isFinite(distanceOpacity) ? Math.max(0, Math.min(1, distanceOpacity)) : 0
  return visibleAlpha * (1 - safeExitMix) * distanceAlpha
}
