import { useEffect, useMemo, type Dispatch, type PointerEvent } from 'react'
import type { FilmAction } from '../engine/film'
import { createGalleryGesture } from './galleryGesture'

export function useGallerySwipe(enabled: boolean, dispatch: Dispatch<FilmAction>) {
  const gesture = useMemo(() => createGalleryGesture((direction) => dispatch({ type: 'gallery-step', direction })), [dispatch])
  useEffect(() => {
    if (!enabled) return
    // Listen globally so releasing outside the scene cannot leave a stale drag.
    const end = (event: globalThis.PointerEvent) => gesture.end(event)
    const cancel = () => gesture.cancel()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      gesture.cancel()
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    }
  }, [enabled, gesture])
  return {
    onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
      if (!enabled || !event.isPrimary || event.button !== 0) return
      if (event.target instanceof Element && event.target.closest('button, select, input, a, textarea, summary, dialog, [data-no-swipe]')) return
      gesture.begin({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY })
    },
    onLostPointerCapture() { gesture.cancel() },
  }
}
