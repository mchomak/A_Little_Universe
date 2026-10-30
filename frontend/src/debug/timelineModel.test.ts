import { describe, expect, it } from 'vitest'
import { filmReducer, initialFilmState } from '../engine/film'
import { SCENES, TIMING } from '../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { activeFrameIndex, canSeekTimeline, timelineFrames } from './timelineModel'
import { getGrowthFrames } from '../scenes/growth/seedProcedure'

describe('scene editor timeline', () => {
  it('uses actual dynamic prologue and identity frame boundaries', () => {
    const frames = timelineFrames('prologue', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map((frame) => frame.start)).toEqual([0, 2, 6.85, 12.35, 18])
    expect(activeFrameIndex(frames, 10)).toBe(2)
    expect(timelineFrames('identity', DEFAULT_SCENE_COMPOSER_CONFIG).map((frame) => frame.start)).toEqual([0, 4, 8, 13, 17, 23, 28])
  })
  it('maps the new seed stages to seekable positions inside the growth scene', () => {
    const frames = timelineFrames('growth', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map(({ start }) => start)).toEqual([0, 3.2, 4.4, 4.9, 5.1, 14.2])
    expect(TIMING.growth.duration).toBe(16)
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
    expect(delayed[2]?.start).toBe(4.7)
    expect(getGrowthFrames(slowerFormation.scenes.growth).fall[0]).toBe(3.5)
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
