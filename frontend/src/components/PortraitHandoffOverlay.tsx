import { useLayoutEffect, useRef } from 'react'
import type { SceneId } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { TIMING } from '../engine/filmConfig'
import portraitUrl from '../assets/start_img.jpg'
import './portrait-handoff-overlay.css'

const OVERLAY_START = TIMING.identity.duration - 0.9
const OVERLAY_FADE_IN = 0.2

export function PortraitHandoffOverlay({ scene, runtime, reducedMotion }: { scene: SceneId; runtime: FilmRuntime; reducedMotion: boolean }) {
  const overlay = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = overlay.current
    if (!element) return

    if (scene === 'identity') {
      const update = (time: number) => {
        const progress = reducedMotion
          ? Number(time >= OVERLAY_START)
          : Math.max(0, Math.min(1, (time - OVERLAY_START) / OVERLAY_FADE_IN))
        element.style.transition = 'none'
        element.style.opacity = String(progress)
      }
      update(runtime.time)
      return runtime.subscribeFrame(update)
    }

    if (scene === 'gallery') {
      let animation: Animation | null = null
      // Wait for the gallery's first render to finish before starting the fade.
      // Its initial WebGL setup can block animation frames for several hundred ms.
      const fadeDelay = window.setTimeout(() => {
        animation = element.animate(
          [{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }],
          { duration: reducedMotion ? 0 : 900, easing: 'ease-out', fill: 'forwards' },
        )
      }, 250)
      return () => {
        clearTimeout(fadeDelay)
        animation?.cancel()
      }
    }

    element.style.transition = 'none'
    element.style.opacity = '0'
  }, [reducedMotion, runtime, scene])

  return <div ref={overlay} className="portrait-handoff-overlay" aria-hidden="true">
    <img src={portraitUrl} alt="" draggable={false} />
  </div>
}
