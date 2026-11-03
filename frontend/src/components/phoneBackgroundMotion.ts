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
