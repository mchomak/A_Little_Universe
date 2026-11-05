/** Smoothly tracks the camera from the upper crop to the lower crop while the seed falls. */
export function getPhoneBackgroundProgress(time: number, fall: readonly [number, number]): number {
  const [start, end] = fall
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const linear = Math.max(0, Math.min(1, (time - start) / (end - start)))
  return linear * linear * (3 - 2 * linear)
}

/**
 * Maps camera travel into the vertical overscan supplied by the image zoom.
 * offsetY selects the starting crop; progress always settles at its lower edge.
 */
export function getPhoneBackgroundPanPercent(progress: number, zoom: number, offsetY: number): number {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const safeZoom = Number.isFinite(zoom) ? Math.max(1, zoom) : 1
  const safeOffset = Number.isFinite(offsetY) ? Math.max(-1, Math.min(1, offsetY)) : 0
  const halfOverscan = (safeZoom - 1) * 50
  return halfOverscan * (safeOffset * (1 - safeProgress) - safeProgress)
}

/** Dims the shared opening image only as the camera starts following the falling seed. */
export function getPhoneBackgroundFilter(progress: number): string {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  if (safeProgress === 0) return 'none'
  const brightness = 1 - safeProgress * 0.52
  const saturation = 1 - safeProgress * 0.28
  return `brightness(${brightness}) saturate(${saturation})`
}
