import { describe, expect, it } from 'vitest'
import { getGrowthHandoff, getGrowthViewportHeight, getSeedPose, sampleSeedParticles, SEED_ROOT } from './seedProcedure'
import { getPrologueLightPose } from '../prologue/lightPose'
import { getConfig } from '../../systems/scene-config/config'

describe('scene 02 seed procedure', () => {
  it('forms from the center, lands on the shared plant root, and hands off to growth', () => {
    expect(getSeedPose(0, 3.82, false).anchor).toEqual([0, -1.45, 0])
    expect(getSeedPose(0, 3.82, false).seedY).toBeCloseTo(1.45)
    expect(getSeedPose(3.45, 3.82, false).seedY).toBe(0)
    expect(getSeedPose(3.82, 3.82, false).stage).toBe('handoff')
    expect(getSeedPose(4.4, 3.82, false).stage).toBe('growth')
    expect(getSeedPose(4.4, 3.82, false).growthWeight).toBeCloseTo(0.065, 3)
    expect(getSeedPose(18, 3.82, false).growthWeight).toBeCloseTo(1)
    expect(getGrowthHandoff(4.4).localTime).toBeCloseTo(0.75)
    expect(getSeedPose(0, 3.82, false).seedSize).toBeCloseTo(0.0382)
    expect(getSeedPose(11.2, 3.82, false).growthWeight).toBeCloseTo(0.5325, 4)
    const settings = getConfig().scenes.prologue
    for (const time of [0, 0.575, 1.15]) {
      const pose = getSeedPose(time, 3.82, false)
      const appLight = getPrologueLightPose(time, time, 'playing', settings, false, true)
      expect(pose.lightTransfer).toBeCloseTo(time / 1.15, 8)
      expect(pose.lightTransfer + appLight.opacity).toBeCloseTo(1, 8)
    }
    const growth = getGrowthHandoff(4.4)
    expect(growth.anchor).toEqual(SEED_ROOT)
    expect(growth.stage).toBe('growth')
    expect(growth.localTime).toBeCloseTo(0.75)
    expect(growth.weight).toBeCloseTo(0.065)
  })

  it('keeps particles and poses deterministic for backward seek and replay', () => {
    const forward = getSeedPose(2.8, 3.82, false)
    getSeedPose(4.2, 3.82, false)
    expect(getSeedPose(2.8, 3.82, false)).toEqual(forward)
    expect(sampleSeedParticles(24)).toEqual(sampleSeedParticles(24))
    const seed = sampleSeedParticles(22)
    const maxX = Math.max(...seed.map((point) => Math.abs(point.x)))
    const maxY = Math.max(...seed.map((point) => Math.abs(point.y)))
    expect(seed).toHaveLength(22)
    expect(maxY).toBeGreaterThan(maxX * 1.6)
  })

  it('reduces motion continuously without trail or landing pulse and scales quality', () => {
    const still = getSeedPose(2.8, 3.82, true)
    expect(still.seedY).toBeGreaterThan(SEED_ROOT[1])
    expect(getSeedPose(4.4, 3.82, true).seedY).toBe(0)
    expect(still.trailOpacity).toBe(0)
    expect(getSeedPose(3.7, 3.82, true).pulseOpacity).toBe(0)
    expect(sampleSeedParticles(24, 'low')).toHaveLength(8)
    expect(sampleSeedParticles(24, 'standard')).toHaveLength(24)
  })

  it('fits the seed against the current landscape or portrait camera framing', () => {
    expect(getGrowthViewportHeight(1024, 768)).toBeCloseTo(3.856, 2)
    expect(getGrowthViewportHeight(768, 1024)).toBeCloseTo(5.732, 2)
  })
})
