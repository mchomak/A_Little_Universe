import { gsap } from 'gsap'
import type { FilmAction, FilmState } from './film'
import { SCENES } from './filmConfig'

export interface FilmRuntime {
  readonly time: number
  subscribeFrame(listener: (time: number) => void): () => void
}
export interface WritableFilmRuntime extends FilmRuntime { publish(time: number): void }

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
  const duration = SCENES[initial.scene].duration
  const clock = { time: 0 }
  let timeline!: gsap.core.Timeline
  const complete = () => {
    if (disposed || completed) return
    completed = true
    dispatch({ type: 'timeline-update', time: duration, revision })
    dispatch({ type: 'timeline-complete', revision })
  }
  const context = gsap.context(() => {
    timeline = gsap.timeline({ paused: true,
      onUpdate() {
        if (disposed) return
        runtime.publish(clock.time)
        const stamp = now()
        if (stamp - lastDispatch >= 100 || clock.time >= duration) {
          lastDispatch = stamp
          dispatch({ type: 'timeline-update', time: clock.time, revision })
        }
      },
      onComplete: complete,
    }).to(clock, { time: duration, duration, ease: 'none' })
  })
  timeline.time(initial.elapsed, true)
  runtime.publish(initial.elapsed)
  const sync = (next: FilmState) => {
    if (disposed || next.revision !== revision) return
    state = next
    timeline.timeScale(state.speed)
    const paused = state.mode !== 'playing' || state.paused || state.reading || Boolean(visibility?.hidden)
    timeline.paused(paused)
    if (!paused && timeline.time() >= duration) complete()
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
  const listeners = new Set<(time: number) => void>()
  return {
    get time() { return time },
    subscribeFrame(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(value) {
      if (!Number.isFinite(value)) return
      time = Math.max(0, value)
      for (const listener of listeners) listener(time)
    },
  }
}
