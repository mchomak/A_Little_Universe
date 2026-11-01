import { gsap } from 'gsap'
import { getCreditsScrollProgress } from '../engine/filmConfig'

export interface CreditsCrawlTweenOptions {
  time: number
  startAt: number
  duration: number
  playbackSpeed: number
  paused?: boolean
  onProgress: (progress: number) => void
  onComplete: () => void
}

/** One independent letter crawl, seeded from canonical film time for exact DEV seeks. */
export function createCreditsCrawlTween({ time, startAt, duration, playbackSpeed, paused: initiallyPaused = false, onProgress, onComplete }: CreditsCrawlTweenOptions) {
  const position = { value: getCreditsScrollProgress(time, startAt, duration) }
  let totalDuration = duration
  let speed = playbackSpeed
  let paused = initiallyPaused
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
      if (!paused) complete()
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
    get paused() { return paused },
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
    setPaused(nextPaused: boolean) {
      if (disposed) return
      const wasPaused = paused
      paused = nextPaused
      if (paused) tween?.pause()
      else if (position.value >= 1 && (wasPaused || !completed)) {
        completed = false
        complete()
      }
      else tween?.resume()
    },
    /** Resync to canonical film time after a developer seek or restart. */
    seek(time: number) {
      if (!Number.isFinite(time) || disposed) return
      position.value = getCreditsScrollProgress(time, startAt, totalDuration)
      if (position.value < 1) completed = false
      rebuild()
    },
    pause() {
      if (disposed) return
      paused = true
      tween?.pause()
    },
    resume() {
      if (disposed) return
      const wasPaused = paused
      paused = false
      if (position.value >= 1 && (wasPaused || !completed)) {
        completed = false
        complete()
      }
      else tween?.resume()
    },
    dispose() {
      if (disposed) return
      disposed = true
      tween?.kill()
      tween = null
    },
  }
}
