import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getScene04FrameAssemblyProgress, getScene04PhotoRevealClock, getScene04PortraitParticleOpacity, getScene04Timeline, SCENE04_FINAL_HOLD_SECONDS } from './scene04Timeline'

const timeline = getScene04Timeline(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)

describe('Scene 04 transition timing', () => {
  it('pulls the camera back after the portrait, then starts the photo and leaves three seconds for its frame', () => {
    expect(timeline.portraitComplete).toBeCloseTo(12.1)
    expect(timeline.cameraPullbackStart).toBe(timeline.portraitComplete)
    expect(timeline.cameraPullbackComplete - timeline.cameraPullbackStart).toBeCloseTo(4)
    expect(timeline.photoStart - timeline.cameraPullbackComplete).toBeCloseTo(0.65)
    expect(timeline.photoRevealDuration).toBeCloseTo(5.8)
    expect(timeline.photoComplete - timeline.photoStart).toBeCloseTo(timeline.photoRevealDuration)
    expect(timeline.frameStart).toBe(timeline.photoComplete)
    expect(timeline.frameComplete - timeline.frameStart).toBe(3)
    expect(timeline.frameComplete).toBeLessThan(34)
  })

  it('maps reveal samples onto the existing face-to-edges clock and fades particles continuously', () => {
    expect(getScene04PhotoRevealClock(timeline.photoStart, timeline)).toBe(23)
    expect(getScene04PhotoRevealClock(timeline.photoStart + timeline.photoRevealDuration, timeline)).toBeCloseTo(28)
    expect(getScene04PhotoRevealClock(timeline.photoComplete, timeline)).toBeCloseTo(28)
    expect(getScene04PortraitParticleOpacity(timeline.photoStart, timeline)).toBe(1)
    expect(getScene04PortraitParticleOpacity((timeline.photoStart + timeline.photoComplete) / 2, timeline)).toBeCloseTo(0.5)
    expect(getScene04PortraitParticleOpacity(timeline.photoComplete, timeline)).toBe(0)
  })

  it('keeps seeking and replay deterministic and holds the completed frame', () => {
    const sample = () => [
      getScene04PhotoRevealClock(timeline.photoStart + 2, timeline),
      getScene04PortraitParticleOpacity(timeline.photoStart + 2, timeline),
      getScene04FrameAssemblyProgress(timeline.frameStart + 1.5, timeline),
    ]
    const first = sample()
    sample() // seek away to another time
    expect(sample()).toEqual(first)
    expect(getScene04FrameAssemblyProgress(timeline.frameComplete, timeline)).toBe(1)
    expect(getScene04FrameAssemblyProgress(34, timeline)).toBe(1)
  })

  it('reserves photo, frame, and a final hold when DEV portrait settings would overrun the scene', () => {
    const latePortrait = getScene04Timeline({
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity,
      portraitStartProgress: 1,
      portraitDuration: 16,
    })
    expect(latePortrait.portraitDuration).toBeLessThan(16)
    expect(latePortrait.frameComplete + SCENE04_FINAL_HOLD_SECONDS).toBeCloseTo(34)
    expect(latePortrait.portraitComplete).toBeLessThan(latePortrait.photoStart)
    expect(latePortrait.cameraPullbackComplete).toBeLessThan(latePortrait.photoStart)
    expect(latePortrait.photoComplete).toBe(latePortrait.frameStart)
  })

  it('keeps the minimum portrait duration and final hold within 34 seconds at maximum DEV settings', () => {
    const maximumSettings = getScene04Timeline({
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity,
      dissolveDuration: 18,
      portraitStartProgress: 1,
      portraitDuration: 16,
      cameraMoveDuration: 18,
    })
    expect(maximumSettings.portraitStart).toBeCloseTo(16.55)
    expect(maximumSettings.portraitDuration).toBe(2)
    expect(maximumSettings.cameraPullbackStart).toBe(maximumSettings.portraitComplete)
    expect(maximumSettings.frameComplete + SCENE04_FINAL_HOLD_SECONDS).toBeCloseTo(34)
  })

  it('keeps all bounded DEV timing combinations inside the scene and preserves the two-second portrait floor', () => {
    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity
    for (const dissolveDuration of [2, 12, 18]) {
      for (const portraitStartProgress of [0, 0.3, 1]) {
        for (const portraitDuration of [2, 8.5, 16]) {
          for (const cameraMoveDuration of [1, 12, 18]) {
            const sample = getScene04Timeline({ ...settings, dissolveDuration, portraitStartProgress, portraitDuration, cameraMoveDuration })
            expect(sample.portraitDuration).toBeGreaterThanOrEqual(2)
            expect(sample.frameComplete + SCENE04_FINAL_HOLD_SECONDS).toBeLessThanOrEqual(34.000001)
          }
        }
      }
    }
  })
})
