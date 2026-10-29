import { describe, expect, it } from 'vitest'
import { getGrowthCameraPose, getGrowthHandoff, getGrowthViewportHeight, getSeedPose, sampleSeedParticleSeeds, SEED_ROOT } from './seedProcedure'
import { getPrologueLightPose } from '../prologue/lightPose'
import { getConfig } from '../../systems/scene-config/config'
import { TIMING } from '../../engine/filmConfig'

describe('scene 02 seed procedure', () => {
  it('forms from the center, lands on the shared plant root, and hands off to growth', () => {
    expect(getSeedPose(0, 3.82, false).anchor).toEqual([0, -1.45, 0])
    expect(getSeedPose(0, 3.82, false).seedY).toBeCloseTo(1.45)
    expect(getSeedPose(TIMING.growth.fall[1], 3.82, false).seedY).toBe(0)
    expect(getSeedPose(TIMING.growth.handoff[0] + 0.1, 3.82, false).stage).toBe('handoff')
    expect(getSeedPose(TIMING.growth.handoff[1], 3.82, false).stage).toBe('growth')
    expect(getSeedPose(TIMING.growth.handoff[1], 3.82, false).growthWeight).toBeCloseTo(0.065, 3)
    expect(getSeedPose(18, 3.82, false).growthWeight).toBeCloseTo(1)
    expect(getGrowthHandoff(TIMING.growth.handoff[1]).localTime).toBeCloseTo(0.75)
    expect(getSeedPose(TIMING.growth.formation[1], 3.82, false).seedSize).toBeGreaterThanOrEqual(0.0764)
    const settings = getConfig().scenes.prologue
    for (const time of [0, 0.575, 1.15]) {
      const pose = getSeedPose(time, 3.82, false)
      const appLight = getPrologueLightPose(time, time, 'playing', settings, false, true)
      expect(pose.lightTransfer).toBeCloseTo(time / 1.15, 8)
      expect(pose.lightTransfer + appLight.opacity).toBeCloseTo(1, 8)
    }
    const growth = getGrowthHandoff(TIMING.growth.handoff[1])
    expect(growth.anchor).toEqual(SEED_ROOT)
    expect(growth.stage).toBe('growth')
    expect(growth.localTime).toBeCloseTo(0.75)
    expect(growth.weight).toBeCloseTo(0.065)
  })

  it('keeps particles and poses deterministic for backward seek and replay', () => {
    const forward = getSeedPose(2.8, 3.82, false)
    getSeedPose(4.2, 3.82, false)
    expect(getSeedPose(2.8, 3.82, false)).toEqual(forward)
    expect(sampleSeedParticleSeeds(76)).toEqual(sampleSeedParticleSeeds(76))
    expect(sampleSeedParticleSeeds(28)).toEqual(sampleSeedParticleSeeds(76).slice(0, 28 * 3))
  })

  it('reduces motion continuously without trail or landing pulse and scales quality', () => {
    const still = getSeedPose(2.8, 3.82, true)
    expect(still.seedY).toBeGreaterThan(SEED_ROOT[1])
    expect(getSeedPose(TIMING.growth.fall[1], 3.82, true).seedY).toBe(0)
    expect(still.trailOpacity).toBe(0)
    expect(getSeedPose(TIMING.growth.landing[0] + 0.2, 3.82, true).impact).toBe(1)
  })

  it('fits the seed against the current landscape or portrait camera framing', () => {
    expect(getGrowthViewportHeight(1024, 768)).toBeCloseTo(3.856, 2)
    expect(getGrowthViewportHeight(768, 1024)).toBeCloseTo(5.732, 2)
  })

  it('accelerates into impact while the camera follows later and settles continuously', () => {
    const [start, end] = TIMING.growth.fall
    const step = (end - start) / 4
    const ys = [0, 1, 2, 3, 4].map(i => getSeedPose(start + step * i, 3.82, false).seedY)
    const drops = ys.slice(1).map((y, i) => ys[i]! - y)
    expect(drops[3]).toBeGreaterThan(drops[2]!)
    expect(drops[2]).toBeGreaterThan(drops[1]!)
    expect(getGrowthCameraPose(start + 0.15, false).y).toBe(0)
    expect(getGrowthCameraPose(start + 0.8, false).y).toBeLessThan(0)
    expect(getGrowthCameraPose(23, false)).toMatchObject({ y: 0.2, ty: 0.1 })
    expect(getGrowthCameraPose(end + 0.1, true).y).toBe(0)
    expect(getGrowthCameraPose(23, true)).toMatchObject({ y: 0, ty: 0 })
    const before = getGrowthCameraPose(end - 0.001, false)
    const after = getGrowthCameraPose(end + 0.001, false)
    expect(Math.abs(before.y - after.y)).toBeLessThan(0.01)
  })

  it('shows rings before landing, bursts briefly, leaves a mound and delays moonlight by half a second', () => {
    const impact = TIMING.growth.fall[1]
    expect(getSeedPose(impact - 0.2, 3.82, false).ringOpacity).toBeGreaterThan(0)
    expect(getSeedPose(impact - 0.01, 3.82, false).mound).toBe(0)
    expect(getSeedPose(impact - 0.01, 3.82, false).seedOpacity).toBeGreaterThan(0.9)
    expect(getSeedPose(impact + 0.2, 3.82, false).seedOpacity).toBe(0)
    expect(getSeedPose(impact + 0.15, 3.82, false).sparkOpacity).toBeGreaterThan(0)
    expect(getSeedPose(impact + 1, 3.82, false).sparkOpacity).toBe(0)
    expect(getSeedPose(impact + 0.49, 3.82, false).moonlight).toBe(0)
    expect(getSeedPose(impact + 0.8, 3.82, false).moonlight).toBeGreaterThan(0)
    expect(getSeedPose(impact + 2.2, 3.82, false).moonlight).toBe(1)
    expect(getSeedPose(18, 3.82, false).mound).toBe(1)
    expect(getSeedPose(impact + 0.4, 3.82, false).growthWeight).toBe(0)
    expect(getSeedPose(impact + 0.15, 3.82, true).sparkOpacity).toBe(0)
  })
})
