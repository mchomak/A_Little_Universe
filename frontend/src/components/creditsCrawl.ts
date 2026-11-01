import { gsap } from 'gsap'
import { getCreditsScrollProgress } from '../engine/filmConfig'

export interface CreditsCrawlTweenOptions {
  time: number
  startAt: number
  duration: number
  playbackSpeed: number
  onProgress: (progress: number) => void
  onComplete: () => void
}

/** One independent letter crawl, seeded from canonical film time for exact DEV seeks. */
export function createCreditsCrawlTween({ time, startAt, duration, playbackSpeed, onProgress, onComplete }: CreditsCrawlTweenOptions) {
  const position = { value: getCreditsScrollProgress(time, startAt, duration) }
  let totalDuration = duration
  let speed = playbackSpeed
  let paused = false
  let completed = false
  let disposed = false
  let tween: gsap.core.Tween | null = null

  const complete = () => {
    if (disposed || completed) return
    completed = true
    position.value = 1
    onProgress(position.value)
    onComplete()
  }
  const rebuild = () => {
    tween?.kill()
    tween = null
    onProgress(position.value)
    if (position.value >= 1) {
      complete()
      return
    }
    completed = false
    const remainingDuration = totalDuration * (1 - position.value)
    if (remainingDuration <= 0) {
      complete()
      return
    }
    tween = gsap.to(position, {
      value: 1,
      duration: remainingDuration,
      ease: 'none',
      paused: true,
      onUpdate: () => onProgress(position.value),
      onComplete: complete,
    })
    // Keep the stored value absolute; the new tween starts at its own zero.
    tween.progress(0, true)
    tween.timeScale(speed)
    tween.paused(paused)
  }

  rebuild()
  return {
    get progress() { return position.value },
    get remainingSeconds() { return Math.max(0, totalDuration * (1 - position.value)) },
    resize(nextDuration: number) {
      if (!Number.isFinite(nextDuration) || nextDuration <= 0 || disposed) return
      totalDuration = nextDuration
      rebuild()
    },
    setSpeed(nextSpeed: number) {
      if (!Number.isFinite(nextSpeed) || nextSpeed <= 0 || disposed) return
      speed = nextSpeed
      tween?.timeScale(speed)
    },
    pause() {
      paused = true
      tween?.pause()
    },
    resume() {
      paused = false
      tween?.resume()
    },
    dispose() {
      if (disposed) return
      disposed = true
      tween?.kill()
      tween = null
    },
  }
}
