import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { FilmRuntime } from './runtime'

/** Non-React lifecycle seam used by the hook and verified with real GSAP objects. */
export function createSceneTimeline(
  build: () => gsap.core.Timeline,
  runtime: FilmRuntime,
  preserveOnRevert?: () => () => void,
) {
  let timeline!: gsap.core.Timeline
  const context = gsap.context(() => { timeline = build().pause() })
  const scrub = (time: number) => { timeline.time(time, false) }
  scrub(runtime.time)
  const unsubscribe = runtime.subscribeFrame(scrub)
  let disposed = false
  return {
    timeline,
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe()
      const restore = preserveOnRevert?.()
      context.revert()
      restore?.()
    },
  }
}

interface TimelineOptions {
  paused: boolean
  reducedMotion: boolean
  revision: number
}

interface RuntimeTimelineOptions {
  runtime: FilmRuntime
  reducedMotion?: boolean
  /** Restore shared scene state after GSAP reverts its timeline targets. */
  preserveOnRevert?: () => () => void
}

/** The scene supplies a stable builder. Every setup owns exactly one GSAP context. */
export function useSceneTimeline(
  build: () => gsap.core.Timeline,
  options: TimelineOptions | RuntimeTimelineOptions,
) {
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const runtime = 'runtime' in options ? options.runtime : undefined
  const preserveOnRevert = 'runtime' in options ? options.preserveOnRevert : undefined
  const paused = 'paused' in options ? options.paused : true
  const revision = 'revision' in options ? options.revision : 0
  const reducedMotion = options.reducedMotion ?? false

  useLayoutEffect(() => {
    if (runtime) {
      const scene = createSceneTimeline(build, runtime, preserveOnRevert)
      timeline.current = scene.timeline
      return () => {
        scene.dispose()
        timeline.current = null
      }
    }
    if (reducedMotion) return

    const context = gsap.context(() => {
      timeline.current = build()
    })

    return () => {
      context.revert()
      timeline.current = null
    }
  }, [build, preserveOnRevert, reducedMotion, revision, runtime])

  useLayoutEffect(() => {
    if (runtime) return
    timeline.current?.paused(paused)
  }, [paused, build, reducedMotion, revision, runtime])
}
