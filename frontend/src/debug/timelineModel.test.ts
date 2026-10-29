import { describe, expect, it } from 'vitest'
import { filmReducer, initialFilmState } from '../engine/film'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { activeFrameIndex, canSeekTimeline, timelineFrames } from './timelineModel'

describe('scene editor timeline', () => {
  it('uses actual dynamic prologue and identity frame boundaries', () => {
    const frames = timelineFrames('prologue', DEFAULT_SCENE_COMPOSER_CONFIG)
    expect(frames.map((frame) => frame.start)).toEqual([0, 2, 7, 12.5, 18])
    expect(activeFrameIndex(frames, 10)).toBe(2)
    expect(timelineFrames('identity', DEFAULT_SCENE_COMPOSER_CONFIG).map((frame) => frame.start)).toEqual([0, 4, 8, 13, 17, 23, 28])
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
