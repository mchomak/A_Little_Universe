import { GALLERY } from './content'
import { galleryMotion, travel } from './controller'

/** Listeners are scoped to the canvas; disposal also clears interrupted gestures. */
export function bindGalleryGestures(canvas: HTMLElement, isPaused: () => boolean) {
  let distance = 0; let multi = false; let clear: ReturnType<typeof setTimeout> | undefined
  const length = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)
  const start = (event: TouchEvent) => { if (event.touches.length >= 2) { clearTimeout(clear); distance = length(event.touches); multi = true; galleryMotion.pinching = true; galleryMotion.suppressClick = true; event.preventDefault() } }
  const move = (event: TouchEvent) => { if (event.touches.length >= 2 && multi) { const next = length(event.touches); if (!isPaused()) travel((next - distance) * GALLERY.sensitivity); distance = next; event.preventDefault() } }
  const end = (event: TouchEvent) => { if (multi && event.touches.length < 2) { galleryMotion.pinching = false; if (event.touches.length === 0) { multi = false; clearTimeout(clear); clear = setTimeout(() => { galleryMotion.suppressClick = false }, 450) } } }
  const cancel = () => { multi = false; galleryMotion.pinching = false; galleryMotion.suppressClick = true; clearTimeout(clear); clear = setTimeout(() => { galleryMotion.suppressClick = false }, 450) }
  const wheel = (event: WheelEvent) => { event.preventDefault(); if (!isPaused()) travel(Math.max(-4, Math.min(4, event.deltaY * .015))) }
  canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', cancel); canvas.addEventListener('wheel', wheel, { passive: false })
  return () => { clearTimeout(clear); canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); canvas.removeEventListener('touchend', end); canvas.removeEventListener('touchcancel', cancel); canvas.removeEventListener('wheel', wheel); galleryMotion.pinching = false; galleryMotion.suppressClick = false }
}
