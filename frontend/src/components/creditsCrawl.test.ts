import { expect, it } from 'vitest'
import { createFilmClock, createFilmRuntime } from '../engine/runtime'
import { filmReducer, initialFilmState } from '../engine/film'
import { getGreetingFrames } from '../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { timelineFrames } from '../debug/timelineModel'
import { createCreditsCrawlTween } from './creditsCrawl'

it('re-seeds the crawl from DEV seek time, preserves absolute progress on resize, and completes at the runtime marker', () => {
  const runtime = createFilmRuntime()
  const startAt = getGreetingFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue).credits[0]
  const config = DEFAULT_SCENE_COMPOSER_CONFIG
  const frameAt = (duration: number) => timelineFrames('greeting', config, duration)[6]?.start
  let state = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'greeting' }, true)
  state = { ...state, paused: true, speed: 0.5 }
  const resources: { clock?: ReturnType<typeof createFilmClock>; crawl?: ReturnType<typeof createCreditsCrawlTween> } = {}
  let completions = 0

  const seek = (time: number, duration = 100) => {
    state = filmReducer(state, { type: 'dev-seek', time }, true)
    resources.clock?.dispose()
    resources.clock = createFilmClock({ state, runtime, dispatch: () => undefined })
    resources.crawl?.dispose()
    resources.crawl = createCreditsCrawlTween({
      time: runtime.time,
      startAt,
      duration,
      playbackSpeed: state.speed,
      onProgress: () => undefined,
      onComplete: () => { completions += 1 },
    })
    return resources.crawl
  }

  try {
    const quarter = seek(startAt + 25)
    expect(runtime.time).toBe(startAt + 25)
    expect(quarter.progress).toBeCloseTo(0.25)

    quarter.resize(200)
    expect(quarter.progress).toBeCloseTo(0.25)
    expect(quarter.remainingSeconds).toBeCloseTo(150)

    const forward = seek(startAt + 160, 200)
    expect(forward.progress).toBeCloseTo(0.8)

    const backward = seek(startAt + 80, 200)
    expect(backward.progress).toBeCloseTo(0.4)

    const completionTime = frameAt(200)
    expect(completionTime).toBeCloseTo(startAt + 200)
    const final = seek(completionTime!, 200)
    expect(final.progress).toBe(1)
    expect(completions).toBe(1)
    expect(filmReducer(state, { type: 'greeting-complete' }).scene).toBe('ending')
  } finally {
    resources.crawl?.dispose()
    resources.clock?.dispose()
  }
})
