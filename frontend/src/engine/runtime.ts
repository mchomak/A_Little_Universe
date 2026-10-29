import { gsap } from 'gsap'
import { filmDuration, type FilmAction, type FilmState } from './film'

export interface FilmRuntime {
  readonly time: number
  /** Canonical scene time while playing; continues only as decorative time at the prologue gate. */
  readonly presentationTime: number
  subscribeFrame(listener: (time: number) => void): () => void
  subscribePresentation(listener: (time: number) => void): () => void
}
export interface WritableFilmRuntime extends FilmRuntime {
  publish(time: number, presentationTime?: number): void
  publishPresentation(time: number): void
}

export interface FilmClockOptions {
  state: FilmState
  dispatch: (action: FilmAction) => void
  runtime: WritableFilmRuntime
  visibility?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
  now?: () => number
}

/** One revision owns a clock; state is sampled, frame subscribers receive exact time. */
export function createFilmClock({ state: initial, dispatch, runtime, visibility, now = () => performance.now() }: FilmClockOptions) {
  let state = initial
  let disposed = false
  let completed = false
  let lastDispatch = -Infinity
  const revision = initial.revision
  const waiting = initial.scene === 'prologue' && initial.mode === 'waiting'
  const start = waiting ? filmDuration(initial) : initial.mode === 'transitioning' ? initial.elapsed : 0
  const duration = waiting ? 1 : filmDuration(initial) - start
  const endpoint = start + duration
  const presentationStart = (waiting || initial.mode === 'transitioning') && runtime.time === start
    ? Math.max(start, runtime.presentationTime) : start
  const clock = { time: start }
  let timeline!: gsap.core.Timeline
  const complete = () => {
    if (disposed || completed || waiting) return
    completed = true
    dispatch({ type: 'timeline-update', time: endpoint, revision })
    dispatch({ type: 'timeline-complete', revision })
  }
  const context = gsap.context(() => {
    timeline = gsap.timeline({ paused: true, repeat: waiting ? -1 : 0,
      onUpdate() {
        if (disposed) return
        if (waiting) {
          // One repeatable GSAP clock, no scene-local ticker and no gate advancement.
          runtime.publishPresentation(presentationStart + timeline.totalTime())
          return
        }
        runtime.publish(clock.time, initial.mode === 'transitioning' ? presentationStart + clock.time - start : clock.time)
        const stamp = now()
        if (!waiting && (stamp - lastDispatch >= 100 || clock.time >= endpoint)) {
          lastDispatch = stamp
          dispatch({ type: 'timeline-update', time: clock.time, revision })
        }
      },
      onComplete: complete,
    })
    timeline.to(clock, { time: endpoint, duration, ease: 'none' })
  })
  timeline.time(Math.max(0, initial.elapsed - start), true)
  runtime.publish(initial.elapsed, waiting || initial.mode === 'transitioning' ? presentationStart : initial.elapsed)
  const sync = (next: FilmState) => {
    if (disposed || next.revision !== revision) return
    state = next
    timeline.timeScale(state.speed)
    const paused = (!waiting && state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || Boolean(visibility?.hidden)
    timeline.paused(paused)
    if (!paused && !waiting && timeline.time() >= duration) complete()
  }
  const onVisibility = () => sync(state)
  visibility?.addEventListener('visibilitychange', onVisibility)
  sync(state)
  return {
    timeline, sync,
    dispose() {
      if (disposed) return
      disposed = true
      visibility?.removeEventListener('visibilitychange', onVisibility)
      context.revert()
    },
  }
}

export function createFilmRuntime(): WritableFilmRuntime {
  let time = 0
  let presentationTime = 0
  const listeners = new Set<(time: number) => void>()
  const presentationListeners = new Set<(time: number) => void>()
  const publishPresentation = (value: number) => {
    if (!Number.isFinite(value)) return
    presentationTime = Math.max(0, value)
    for (const listener of presentationListeners) listener(presentationTime)
  }
  return {
    get time() { return time },
    get presentationTime() { return presentationTime },
    subscribeFrame(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    subscribePresentation(listener) {
      presentationListeners.add(listener)
      return () => { presentationListeners.delete(listener) }
    },
    publishPresentation,
    publish(value, presentation = value) {
      if (!Number.isFinite(value) || !Number.isFinite(presentation)) return
      time = Math.max(0, value)
      presentationTime = Math.max(0, presentation)
      for (const listener of listeners) listener(time)
      for (const listener of presentationListeners) listener(presentationTime)
    },
  }
}
