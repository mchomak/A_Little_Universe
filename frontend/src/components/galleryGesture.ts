export interface GesturePoint { pointerId: number; clientX: number; clientY: number }

/** Pointer ownership for the gallery's vertical swipe surface. */
export function createGalleryGesture(step: (direction: -1 | 1) => void) {
  let start: GesturePoint | null = null
  return {
    begin(point: GesturePoint) { if (!start) start = point },
    end(point: GesturePoint) {
      if (!start || start.pointerId !== point.pointerId) return
      const x = point.clientX - start.clientX
      const y = point.clientY - start.clientY
      start = null
      if (Math.abs(y) >= 50 && Math.abs(y) > Math.abs(x) * 1.2) step(y < 0 ? 1 : -1)
    },
    cancel() { start = null },
  }
}
