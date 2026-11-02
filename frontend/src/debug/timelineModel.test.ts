import { describe, expect, it } from 'vitest'
import { filmReducer, initialFilmState } from '../engine/film'
import { getGreetingFrames, getSceneDuration, SCENES, TIMING } from '../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { activeFrameIndex, canSeekTimeline, timelineFrames } from './timelineModel'
import { getGrowthFrames } from '../scenes/growth/seedProcedure'

describe('scene editor timeline', () => {
  it('uses actual dynamic prologue and identity frame boundaries', () => {
    const frames = timelineFrames('prologue', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map((frame) => frame.start)).toEqual([0, 2, 6.85, 12.35, 18])
    expect(activeFrameIndex(frames, 10)).toBe(2)
    expect(timelineFrames('identity', DEFAULT_SCENE_COMPOSER_CONFIG).map((frame) => frame.start)).toEqual([0])
  })
  it('maps the new seed stages to seekable positions inside the growth scene', () => {
    const frames = timelineFrames('growth', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map(({ start }) => start)).toEqual([0, 3.2, 5.8, 6.3, 6.5, 15.5])
    expect(TIMING.growth.duration).toBe(17.4)
    expect(SCENES.growth.duration).toBe(TIMING.growth.duration)
    expect(frames.every((frame) => frame.start >= 0 && frame.start < SCENES.growth.duration)).toBe(true)

    const growth = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'growth' }, true)
    expect(canSeekTimeline(growth, true)).toBe(true)
    expect(filmReducer(growth, { type: 'dev-seek', time: 3.7 }, true).elapsed).toBe(3.7)

    const slowerFormation = { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      growth: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, formationDuration: 3.5 },
    } }
    const delayed = timelineFrames('growth', slowerFormation)
    expect(delayed[1]?.start).toBe(3.5)
    expect(delayed[2]?.start).toBe(6.1)
    expect(getGrowthFrames(slowerFormation.scenes.growth).fall[0]).toBe(3.5)
    expect(getSceneDuration('growth', slowerFormation)).toBe(17.7)
    expect(delayed.at(-1)?.start).toBeLessThan(getSceneDuration('growth', slowerFormation))
  })
  it('moves the Bloom contemplation marker and timeline endpoint with the configured clip', () => {
    const config = { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      bloom: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom, flowerBloomDuration: 11 },
    } }
    const frames = timelineFrames('bloom', config)
    expect(frames.map(({ start }) => start)).toEqual([0, 11])
    expect(getSceneDuration('bloom', config)).toBe(17)
  })
  it('shows the active galaxy slowdown and greeting beats without the retired bouquet marker', () => {
    const cosmos = timelineFrames('cosmos', DEFAULT_SCENE_COMPOSER_CONFIG)
    const greetingFrames = getGreetingFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    const greeting = timelineFrames('greeting', DEFAULT_SCENE_COMPOSER_CONFIG, 30)
    expect(cosmos.map(({ label }) => label)).not.toContain('07.4 Букет')
    expect(cosmos.map(({ label }) => label)).toContain('07.4 Плавное замедление')
    expect(cosmos.find(({ label }) => label === '07.4 Плавное замедление')?.start).toBe(15.8)
    expect(greeting.map(({ label }) => label)).toEqual([
      '08.1 Первая фраза', '08.2 Вторая фраза', '08.3 Чтение', '08.4 Растворение первой',
      '08.5 Растворение второй', '08.6 Начало письма', '08.7 Завершение титров', '09 Постоянный финал',
    ])
    expect(greeting[6]?.start).toBeCloseTo(greetingFrames.credits[0] + 30)
    expect(greeting[7]?.start).toBe(greeting[6]?.start)
    const replayLetter = timelineFrames('greeting', DEFAULT_SCENE_COMPOSER_CONFIG, 30, true)
    expect(replayLetter.map(({ start }) => start)).toEqual([0, 30, 30])
    expect(replayLetter.map(({ label }) => label)).toEqual(['08.6 Повторное письмо', '08.7 Завершение титров', '09 Постоянный финал'])
  })
  it('does not seek through waiting for a bud, gallery, preparation, transition or reading', () => {
    const bloom = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'bloom' }, true)
    expect(canSeekTimeline(bloom, true)).toBe(false)
    expect(canSeekTimeline(filmReducer(bloom, { type: 'interact' }), true)).toBe(true)
    expect(canSeekTimeline(filmReducer(bloom, { type: 'dev-jump', scene: 'gallery' }, true), true)).toBe(false)
    expect(canSeekTimeline({ ...initialFilmState, mode: 'playing' }, false)).toBe(false)
    expect(canSeekTimeline({ ...initialFilmState, mode: 'transitioning' }, true)).toBe(false)
    expect(canSeekTimeline({ ...initialFilmState, mode: 'playing', reading: true }, true)).toBe(false)
  })
})
