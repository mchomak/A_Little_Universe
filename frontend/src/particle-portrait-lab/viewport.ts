export type PortraitViewport = { zoom: number; x: number; y: number }

export const MIN_PORTRAIT_ZOOM = 1
export const MAX_PORTRAIT_ZOOM = 10

/** Zoom around a point measured from the center of a preview frame. */
export function zoomPortraitViewportAt(viewport: PortraitViewport, x: number, y: number, deltaY: number): PortraitViewport {
  const zoom = Math.min(MAX_PORTRAIT_ZOOM, Math.max(MIN_PORTRAIT_ZOOM, viewport.zoom * Math.exp(-deltaY * 0.0015)))
  const ratio = zoom / viewport.zoom
  return { zoom, x: x - (x - viewport.x) * ratio, y: y - (y - viewport.y) * ratio }
}
