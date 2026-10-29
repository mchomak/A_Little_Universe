import { describe, expect, it } from 'vitest'
import { filmReducer, initialFilmState } from '../engine/film'
import { SCENES, TIMING } from '../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { activeFrameIndex, canSeekTimeline, timelineFrames } from './timelineModel'

describe('scene editor timeline', () => {
  it('uses actual dynamic prologue and identity frame boundaries', () => {
    const frames = timelineFrames('prologue', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map((frame) => frame.start)).toEqual([0, 2, 7, 12.5, 18])
    expect(activeFrameIndex(frames, 10)).toBe(2)
    expect(timelineFrames('identity', DEFAULT_SCENE_COMPOSER_CONFIG).map((frame) => frame.start)).toEqual([0, 4, 8, 13, 17, 23, 28])
  })
  it('maps the new seed stages to seekable positions inside the growth scene', () => {
    const frames = timelineFrames('growth', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map(({ label, start }) => [label, start])).toEqual([
      ['02.1 Формирование семечка', 0],
      ['02.2 Падение', 2.8],
      ['02.3 Удар и искры', 4.45],
      ['02.3 Лунный свет', 4.95],
      ['02.4 Рост и передача', 5.65],
      ['02.5 Завершение роста', 18],
    ])
    expect(TIMING.growth.duration).toBe(23)
    expect(SCENES.growth.duration).toBe(TIMING.growth.duration)
    expect(frames.every((frame) => frame.start >= 0 && frame.start < SCENES.growth.duration)).toBe(true)

    const growth = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'growth' }, true)
    expect(canSeekTimeline(growth, true)).toBe(true)
    expect(filmReducer(growth, { type: 'dev-seek', time: 3.7 }, true).elapsed).toBe(3.7)
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
