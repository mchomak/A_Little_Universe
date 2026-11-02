import { expect, it } from 'vitest'
import { getGrowthSceneFrames } from '../../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getBudGrowthActivation, getGrowthVfxParticleLimit, getGrowthZoneBurst, getGrowthZonePulse, getLeafGrowthActivation, getLilyGrowthVfxEnvelope } from './lilyGrowthVfx'

const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)

it('follows the actual clip sample and keeps the base glow continuous into Scene 03', () => {
  const beforeSprout = getLilyGrowthVfxEnvelope('growth', frames.model[0] - 0.1, 0, 9, frames)
  const sprout = getLilyGrowthVfxEnvelope('growth', frames.handoff[1] + 0.4, 1.2, 9, frames)
  const complete = getLilyGrowthVfxEnvelope('growth', frames.duration, 9, 9, frames)
  const bloom = getLilyGrowthVfxEnvelope('bloom', 0, 0, 9, frames)

  expect(beforeSprout.activity).toBe(0)
  expect(sprout.progress).toBeCloseTo(1.2 / 9)
  expect(sprout.activity).toBeGreaterThan(0.5)
  expect(complete.activity).toBe(0)
  expect(complete.core).toBeCloseTo(bloom.core, 2)
})

it('derives leaf and bud particle bursts from their posed GLB growth values', () => {
  const leafEmerging = getLeafGrowthActivation(0.62, 0.38)
  const leafFinished = getLeafGrowthActivation(1, 0)
  const budEmerging = getBudGrowthActivation(0.42)

  expect(leafEmerging).toBeCloseTo(0.3844)
  expect(getGrowthZoneBurst(leafEmerging)).toBeGreaterThan(0.9)
  expect(getGrowthZoneBurst(leafFinished)).toBe(0)
  expect(budEmerging).toBe(0.42)
  expect(getGrowthZoneBurst(budEmerging)).toBeGreaterThan(0.9)
})

it('scales the particle workload when the film switches to low quality', () => {
  expect(getGrowthVfxParticleLimit(88, 'standard')).toBe(88)
  expect(getGrowthVfxParticleLimit(88, 'low')).toBe(44)
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleCount).toBe(440)
  expect(getGrowthVfxParticleLimit(440, 'standard')).toBe(440)
  expect(getGrowthVfxParticleLimit(440, 'low')).toBe(220)
  expect(getGrowthVfxParticleLimit(600, 'standard')).toBe(528)
  expect(getGrowthVfxParticleLimit(600, 'low')).toBe(264)
})

it('concentrates the local glow only as the pulse reaches a forming zone', () => {
  expect(getGrowthZonePulse(0.42, 0.42, 0.08, 0.5)).toBeCloseTo(1)
  expect(getGrowthZonePulse(0.1, 0.42, 0.08, 0.5)).toBeLessThan(0.001)
  expect(getGrowthZonePulse(0.42, 0.42, 0.08, 1)).toBe(0)
})
