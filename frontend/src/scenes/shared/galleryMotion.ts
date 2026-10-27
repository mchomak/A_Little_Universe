import { gsap } from 'gsap'

export interface CameraPose { x: number; y: number; z: number; tx: number; ty: number; tz: number }
interface MotionOptions { paused: boolean; reading: boolean; speed: number }
type Visibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>

/** Separate from the frozen exploration clock, and scoped to one gallery focus. */
export function createGalleryMove(pose: CameraPose, target: CameraPose, render: () => void,
  options: MotionOptions, duration: number, visibility: Visibility) {
  let state = options
  let disposed = false
  let timeline!: gsap.core.Timeline
  const context = gsap.context(() => {
    timeline = gsap.timeline({ paused: true }).to(pose, { ...target, duration, ease: 'power2.inOut', onUpdate: render })
  })
  const sync = (next: MotionOptions) => {
    if (disposed) return
    state = next
    timeline.timeScale(state.speed)
    timeline.paused(state.paused || state.reading || visibility.hidden)
  }
  const onVisibility = () => sync(state)
  visibility.addEventListener('visibilitychange', onVisibility)
  sync(state)
  return { timeline, sync, dispose() {
    if (disposed) return
    disposed = true
    visibility.removeEventListener('visibilitychange', onVisibility)
    context.revert()
  } }
}
