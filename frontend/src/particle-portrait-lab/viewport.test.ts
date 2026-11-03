import { describe, expect, it } from 'vitest'
import { MAX_PORTRAIT_ZOOM, zoomPortraitViewportAt, type PortraitViewport } from './viewport'

describe('portrait editor viewport', () => {
  it('keeps the image point under the cursor fixed while zooming', () => {
    const before: PortraitViewport = { zoom: 2, x: 30, y: -12 }
    const cursor = { x: 90, y: 40 }
    const imagePoint = { x: (cursor.x - before.x) / before.zoom, y: (cursor.y - before.y) / before.zoom }
    const after = zoomPortraitViewportAt(before, cursor.x, cursor.y, -500)
    expect(after.zoom).toBeGreaterThan(before.zoom)
    expect((cursor.x - after.x) / after.zoom).toBeCloseTo(imagePoint.x)
    expect((cursor.y - after.y) / after.zoom).toBeCloseTo(imagePoint.y)
  })

  it('clamps the zoom to ten times without shifting the view at the limit', () => {
    const before: PortraitViewport = { zoom: MAX_PORTRAIT_ZOOM, x: 8, y: -3 }
    expect(zoomPortraitViewportAt(before, 100, 100, -100)).toEqual(before)
  })
})
