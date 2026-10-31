import { gsap } from 'gsap'
import { filmDuration, type FilmAction, type FilmState } from './film'

export interface FilmRuntime {
  readonly time: number
  /** Canonical scene time while playing; continues only as decorative time at the prologue gate. */
  readonly presentationTime: number
  readonly held: boolean
  subscribeFrame(listener: (time: number) => void): () => void
  subscribePresentation(listener: (time: number) => void): () => void
  /** Hold scene time while a scene-local Suspense boundary prepares resources. */
  hold(): () => void
  subscribeHold(listener: () => void): () => void
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
  const waiting = initial.mode === 'waiting' && (initial.scene === 'prologue' || initial.scene === 'bloom')
  const start = initial.scene === 'prologue' && initial.mode === 'waiting' ? filmDuration(initial) : initial.mode === 'transitioning' ? initial.elapsed : 0
  const ambientEnding = initial.scene === 'ending' && initial.mode === 'ended'
  const duration = ambientEnding ? 3600 : waiting ? 1 : filmDuration(initial) - start
  const endpoint = start + duration
  const presentationStart = (waiting || initial.mode === 'transitioning') && runtime.time === start
    ? Math.max(start, runtime.presentationTime) : start
  const clock = { time: start }
  let ambientOffset = 0
  let timeline!: gsap.core.Timeline
  const complete = () => {
    if (disposed || completed || waiting || ambientEnding) return
    completed = true
    dispatch({ type: 'timeline-update', time: endpoint, revision })
    dispatch({ type: 'timeline-complete', revision })
  }
  const context = gsap.context(() => {
    timeline = gsap.timeline({ paused: true, repeat: waiting || ambientEnding ? -1 : 0,
      onRepeat() { if (ambientEnding) ambientOffset += duration },
      onUpdate() {
        if (disposed) return
        if (waiting) {
          // One repeatable GSAP clock, no scene-local ticker and no gate advancement.
          runtime.publishPresentation(presentationStart + timeline.totalTime())
          return
        }
        if (ambientEnding) {
          runtime.publishPresentation(ambientOffset + timeline.time())
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
  runtime.publish(initial.elapsed, waiting || initial.mode === 'transitioning' || ambientEnding ? presentationStart : initial.elapsed)
  const sync = (next: FilmState) => {
    if (disposed || next.revision !== revision) return
    state = next
    timeline.timeScale(state.speed)
    const paused = (!waiting && !ambientEnding && state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || runtime.held || Boolean(visibility?.hidden)
    timeline.paused(paused)
    if (!paused && !waiting && !ambientEnding && timeline.time() >= duration) complete()
  }
  const onVisibility = () => sync(state)
  const unsubscribeHold = runtime.subscribeHold(() => sync(state))
  visibility?.addEventListener('visibilitychange', onVisibility)
  sync(state)
  return {
    timeline, sync,
    dispose() {
      if (disposed) return
      disposed = true
      visibility?.removeEventListener('visibilitychange', onVisibility)
      unsubscribeHold()
      context.revert()
    },
  }
}

export function createFilmRuntime(): WritableFilmRuntime {
  let time = 0
  let presentationTime = 0
  let holds = 0
  const holdListeners = new Set<() => void>()
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
    get held() { return holds > 0 },
    hold() {
      holds++
      if (holds === 1) for (const listener of holdListeners) listener()
      let active = true
      return () => {
        if (!active) return
        active = false
        holds--
        if (holds === 0) for (const listener of holdListeners) listener()
      }
    },
    subscribeHold(listener) {
      holdListeners.add(listener)
      return () => { holdListeners.delete(listener) }
    },
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
