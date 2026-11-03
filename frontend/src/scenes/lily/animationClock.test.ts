import { expect, it, vi } from 'vitest'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { initialFilmState } from '../../engine/film'
import { getConfig, subscribeConfig, updateConfig } from '../../systems/scene-config/config'
import { subscribeLilyAnimationClock } from './animationClock'

it('continues Bloom waiting presentation updates with reduced motion enabled', () => {
  const runtime = createFilmRuntime()
  const draw = vi.fn()
  const unsubscribe = subscribeLilyAnimationClock(runtime, draw, true)

  runtime.publishPresentation(1)
  runtime.publishPresentation(2)
  expect(draw).toHaveBeenCalledTimes(2)
  expect(draw).toHaveBeenNthCalledWith(1, 1)
  expect(draw).toHaveBeenNthCalledWith(2, 2)
  unsubscribe()
  runtime.publish(0)
  expect(draw).toHaveBeenCalledTimes(2)
})

it('keeps the animated IdleClosed presentation loop when motion is allowed', () => {
  const runtime = createFilmRuntime()
  const draw = vi.fn()
  const unsubscribe = subscribeLilyAnimationClock(runtime, draw, true)

  runtime.publishPresentation(2)
  expect(draw).toHaveBeenCalledTimes(1)
  unsubscribe()
})

it('updates Bloom waiting effects on presentation ticks and applies config edits while paused', async () => {
  const runtime = createFilmRuntime()
  const initialPollen = getConfig().scenes.bloom.lilyBloomPollen
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  const draws: Array<{ time: number; presentation: number; count: number }> = []
  const draw = () => draws.push({
    time: runtime.time,
    presentation: runtime.presentationTime,
    count: getConfig().scenes.bloom.lilyBloomPollen.particleCount,
  })
  const unsubscribeClock = subscribeLilyAnimationClock(runtime, draw, true)
  const unsubscribeConfig = subscribeConfig(draw)
  try {
    clock.timeline.totalTime(1.2)
    expect(draws.at(-1)).toMatchObject({ time: 0, presentation: 1.2, count: initialPollen.particleCount })

    clock.sync({ ...state, paused: true })
    expect(clock.timeline.paused()).toBe(true)
    const frozenPresentation = runtime.presentationTime
    const drawCount = draws.length
    await updateConfig({ scenes: { bloom: { lilyBloomPollen: { ...initialPollen, particleCount: 0 } } } })
    expect(runtime.presentationTime).toBe(frozenPresentation)
    expect(draws).toHaveLength(drawCount + 1)
    expect(draws.at(-1)).toMatchObject({ time: 0, presentation: frozenPresentation, count: 0 })

    clock.sync({ ...state, paused: false })
    clock.timeline.totalTime(1.5)
    expect(runtime.presentationTime).toBeGreaterThan(frozenPresentation)
    expect(draws.at(-1)?.count).toBe(0)
  } finally {
    unsubscribeConfig()
    unsubscribeClock()
    clock.dispose()
    await updateConfig({ scenes: { bloom: { lilyBloomPollen: initialPollen } } })
  }
})
