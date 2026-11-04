import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getGrowthSceneFrames, retimeSceneElapsed } from '../../engine/filmConfig'
import { getBloomCameraApproachDuration, getBloomClipTime, getGrowthClipTime, getMappedClipTime, getSyncedBloomClipTime } from './animationTiming'

describe('Lily clip timing', () => {
  it('maps the full GLB clip into its configured scene interval without cutting the endpoint', () => {
    expect(getMappedClipTime(4, [5.1, 14.1], 9)).toBe(0)
    expect(getMappedClipTime(9.6, [5.1, 14.1], 9)).toBeCloseTo(4.5)
    expect(getMappedClipTime(14.1, [5.1, 14.1], 9)).toBe(9)
    expect(getMappedClipTime(18, [5.1, 14.1], 9)).toBe(9)
  })

  it('keeps the first 0.75 seconds of Growth fixed and preserves later clip pose through duration edits', () => {
    const previous = { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      growth: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, flowerGrowthDuration: 14 },
    } }
    const next = { ...previous, scenes: {
      ...previous.scenes,
      growth: { ...previous.scenes.growth, flowerGrowthDuration: 4 },
    } }
    const before = getGrowthSceneFrames(previous.scenes.growth)
    const after = getGrowthSceneFrames(next.scenes.growth)
    const handoffTime = before.handoff[0] + 0.4

    expect(getGrowthClipTime(handoffTime, before, 9)).toBeCloseTo(0.4)
    expect(getGrowthClipTime(handoffTime, after, 9)).toBeCloseTo(0.4)

    const oldTime = before.handoff[1] + 2
    const newTime = retimeSceneElapsed('growth', oldTime, previous, next, 'playing')
    expect(getGrowthClipTime(oldTime, before, 9)).toBeCloseTo(getGrowthClipTime(newTime, after, 9))
  })

  it('holds the terminal Growth keyframe through the quiet handoff into Bloom', () => {
    const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
    expect(getGrowthClipTime(frames.duration, frames, 9)).toBe(9)
  })

  it('starts the Bloom clip at its opening pose and respects reduced motion', () => {
    expect(getBloomClipTime(0, [0, 16], 16, false)).toBe(0)
    expect(getBloomClipTime(4, [0, 16], 16, false)).toBe(4)
    expect(getBloomClipTime(0, [0, 16], 16, true)).toBe(16)
  })

  it('synchronizes the close-up with a configurable fraction of the bloom clip', () => {
    const opening: readonly [number, number] = [0, 16]
    const approach = getBloomCameraApproachDuration(10.7, opening)

    expect(approach).toBe(10.7)
    expect(getSyncedBloomClipTime(0, opening, 16, false, approach, 0.67)).toBe(0)
    expect(getSyncedBloomClipTime(approach, opening, 16, false, approach, 0.67)).toBeCloseTo(10.72, 5)
    expect(getSyncedBloomClipTime(16, opening, 16, false, approach, 0.67)).toBe(16)
    expect(getSyncedBloomClipTime(20.9, opening, 16, false, approach, 0.67)).toBe(16)
    expect(getSyncedBloomClipTime(approach / 2, opening, 16, false, approach, 0.67))
      .toBeLessThan(getSyncedBloomClipTime(approach, opening, 16, false, approach, 0.67))
  })

  it('keeps camera completion inside short or edited bloom openings', () => {
    expect(getBloomCameraApproachDuration(10.7, [0, 6])).toBeCloseTo(5.7)
    expect(getSyncedBloomClipTime(5.7, [0, 6], 16, false, 10.7, 0.67)).toBeCloseTo(10.72, 5)
    expect(getSyncedBloomClipTime(6, [0, 6], 16, false, 10.7, 0.67)).toBe(16)
    expect(getSyncedBloomClipTime(2, [0, 16], 16, true, 10.7, 0.67)).toBe(16)
  })
})
