import { describe, expect, it } from 'vitest'
import { getGrowthBloomEntryCameraPose, getGrowthCameraPose, getGrowthFrames, getGrowthHandoff, getGrowthViewportHeight, getSeedCorePose, getSeedPose, getSeedShellCenterY, sampleSeedParticleSeeds, SEED_ROOT, SEED_SHELL_HALF_HEIGHT, type GrowthSettings } from './seedProcedure'
import { getPrologueLightPose } from '../prologue/lightPose'
import { getConfig } from '../../systems/scene-config/config'

describe('scene 02 seed procedure', () => {
  it('fits seed formation and a full plant growth pass inside the v3 scene window', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    expect(frames.formation).toEqual([0, settings.formationDuration])
    expect(frames.fall[0]).toBe(frames.formation[1])
    expect(frames.fall[1] - frames.fall[0]).toBeCloseTo(settings.seedFallDuration, 5)
    expect(frames.islandReveal[1]).toBe(frames.fall[1])
    expect(frames.islandReveal[1] - frames.islandReveal[0]).toBe(settings.islandRevealDuration)
    expect(frames.model[0]).toBe(frames.fall[1] + 0.7)
    expect(frames.model[1] - frames.model[0]).toBe(settings.flowerGrowthDuration)
    expect(frames.sprout[1] - frames.handoff[1]).toBeGreaterThanOrEqual(8)
    expect(frames.sprout[1] - frames.handoff[1]).toBeLessThanOrEqual(10)
    expect(frames.sprout[1]).toBeLessThan(frames.duration)
    expect(frames.duration).toBe(frames.model[1] + 1.9)
  })

  it('forms from the center, lands on the shared plant root, and hands off to growth', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    expect(getSeedPose(0, 3.82, false).anchor).toEqual([0, -1.45, 0])
    expect(getSeedPose(0, 3.82, false).seedY).toBeCloseTo(1.45)
    expect(getSeedPose(frames.fall[1], 3.82, false).seedY).toBe(0)
    expect(getSeedPose(frames.handoff[0] + 0.1, 3.82, false).stage).toBe('handoff')
    expect(getSeedPose(frames.handoff[1], 3.82, false).stage).toBe('growth')
    expect(getSeedPose(frames.handoff[1], 3.82, false).growthWeight).toBeCloseTo(0.065, 3)
    expect(getSeedPose(18, 3.82, false).growthWeight).toBeCloseTo(1)
    expect(getGrowthHandoff(frames.handoff[1]).localTime).toBeCloseTo(0.75)
    expect(getSeedPose(frames.formation[1], 3.82, false).seedSize).toBeGreaterThanOrEqual(0.0764)
    const settings = getConfig().scenes.prologue
    for (const time of [0, 0.575, 1.15]) {
      const pose = getSeedPose(time, 3.82, false)
      const appLight = getPrologueLightPose(time, time, 'playing', settings, false, true)
      expect(pose.lightTransfer).toBeCloseTo(time / 1.15, 8)
      expect(pose.lightTransfer + appLight.opacity).toBeCloseTo(1, 8)
    }
    const growth = getGrowthHandoff(frames.handoff[1])
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

  it('absorbs orbit particles deterministically as the organic seed forms', () => {
    const duration = getConfig().scenes.growth.formationDuration
    const early = getSeedPose(duration * 0.2, 3.82, false)
    const mid = getSeedPose(duration * 0.7, 3.82, false)
    const formed = getSeedPose(duration, 3.82, false)
    getSeedPose(duration * 0.95, 3.82, false)
    expect(early.orbitAbsorption).toBe(0)
    expect(mid.orbitAbsorption).toBeGreaterThan(0)
    expect(formed.orbitAbsorption).toBeCloseTo(1)
    expect(getSeedPose(duration * 0.7, 3.82, false)).toEqual(mid)
  })

  it('reveals the island through the falling beat and keeps impact controls deterministic', () => {
    const base = getConfig().scenes.growth
    const settings = {
      ...base, seedFallDuration: 3, islandRevealDuration: 1.25,
      seedImpactLifetime: 0.8, seedImpactRadius: 0.72, seedImpactStrength: 0.6,
      seedTrailIntensity: 1.5, seedCameraLag: 0.3,
    } as GrowthSettings
    const frames = getGrowthFrames(settings)
    expect(frames.fall[1] - frames.fall[0]).toBe(3)
    expect(frames.islandReveal).toEqual([frames.fall[1] - 1.25, frames.fall[1]])
    expect(getSeedPose(frames.fall[0] + 0.1, 3.82, false, settings).trailOpacity).toBeGreaterThan(0)
    const contact = getSeedPose(frames.fall[1] + 0.1, 3.82, false, settings)
    expect(contact.impactPulse).toBeGreaterThan(0)
    expect(contact.impactOpacity).toBeGreaterThan(0)
    expect(contact.impactProgress).toBeCloseTo(0.125)
    expect(getSeedPose(frames.fall[1] + 0.9, 3.82, false, settings).impactPulse).toBe(0)
    const disabledImpact = getSeedPose(frames.fall[1] + 0.1, 3.82, false, { ...settings, seedImpactStrength: 0 })
    expect(disabledImpact.impactPulse).toBeGreaterThan(0)
    expect(disabledImpact.impactOpacity).toBe(0)
    expect(disabledImpact.mound).toBe(0)
    expect(getGrowthCameraPose(frames.fall[0] + 0.2, false, settings).y).toBe(0)
    expect(getGrowthCameraPose(frames.fall[0] + 0.8, false, settings).y).toBeLessThan(0)
  })

  it('reduces motion continuously without trail or landing pulse and scales quality', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const still = getSeedPose(2.8, 3.82, true)
    expect(still.seedY).toBeGreaterThan(SEED_ROOT[1])
    expect(getSeedPose(frames.fall[1], 3.82, true).seedY).toBe(0)
    expect(still.trailOpacity).toBe(0)
    expect(getSeedPose(frames.landing[0] + 0.2, 3.82, true).impact).toBe(1)
    expect(getSeedPose(frames.fall[1] + 0.08, 3.82, true).impactPulse).toBe(0)
  })

  it('fits the seed against the current landscape or portrait camera framing', () => {
    expect(getGrowthViewportHeight(1024, 768)).toBeCloseTo(3.856, 2)
    expect(getGrowthViewportHeight(768, 1024)).toBeCloseTo(5.732, 2)
  })

  it('accelerates early, settles to zero speed at impact, and keeps the camera aligned', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const [start, end] = frames.fall
    const step = (end - start) / 20
    const ys = Array.from({ length: 21 }, (_, i) => getSeedPose(start + step * i, 3.82, false).seedY)
    const drops = ys.slice(1).map((y, i) => ys[i]! - y)
    const velocities = drops.map(drop => drop / step)
    const averageVelocity = (ys[0]! - ys[ys.length - 1]!) / (end - start)
    expect(ys[0]).toBeCloseTo(1.45)
    expect(ys[ys.length - 1]).toBeCloseTo(0)
    expect(ys.every((y, i) => i === 0 || y <= ys[i - 1]!)).toBe(true)
    expect(velocities[0]).toBeLessThan(averageVelocity * 0.2)
    expect(velocities[1]).toBeGreaterThan(velocities[0]!)
    expect(velocities[10]).toBeGreaterThan(velocities[2]!)
    expect(velocities[19]).toBeLessThan(velocities[18]!)
    expect(velocities[19]).toBeLessThan(averageVelocity * 0.2)
    expect(getGrowthCameraPose(start + 0.15, false).y).toBe(0)
    expect(getGrowthCameraPose(start + 0.8, false).y).toBeLessThan(0)
    expect(getGrowthCameraPose(23, false).y).toBeCloseTo(-0.02)
    expect(getGrowthCameraPose(23, false).ty).toBeCloseTo(-0.12)
    expect(getGrowthCameraPose(23, false).z).toBeCloseTo(7.8)
    expect(getGrowthCameraPose(end + 0.1, true).y).toBe(-0.2)
    expect(getGrowthCameraPose(23, true)).toMatchObject({ y: -0.2, ty: -0.2, z: 7.8 })
    const before = getGrowthCameraPose(end - 0.001, false)
    const after = getGrowthCameraPose(end + 0.001, false)
    expect(Math.abs(before.y - after.y)).toBeLessThan(0.01)
  })

  it('keeps the island base inside a 4:3 frame through landing and growth settle', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    const tangent = Math.tan(38 * Math.PI / 360)
    const islandBottom = SEED_ROOT[1] - settings.islandThickness - settings.islandDepth - settings.islandRadius * 0.05
    const contact = getGrowthCameraPose(frames.fall[1], false, settings)
    const finale = getGrowthCameraPose(15.5, false, settings)
    const reduced = getGrowthCameraPose(frames.fall[1], true, settings)
    const budTip = 1.8

    expect(contact.z * tangent).toBeGreaterThanOrEqual(contact.ty - islandBottom + 0.2)
    expect(finale.z * tangent).toBeGreaterThanOrEqual(finale.ty - islandBottom + 0.3)
    expect(finale.z * tangent).toBeGreaterThanOrEqual(budTip - finale.ty + 0.2)
    expect(reduced.z * tangent).toBeGreaterThanOrEqual(reduced.ty - islandBottom + 0.2)
  })

  it('uses one smooth, shared camera endpoint for Growth and Bloom', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    const beforeExit = getGrowthCameraPose(frames.duration - 0.01, false, settings)
    const growthExit = getGrowthCameraPose(frames.duration, false, settings)
    const bloomEntry = getGrowthBloomEntryCameraPose(settings, false)
    expect(bloomEntry).toEqual(growthExit)
    expect(Math.abs(growthExit.z - beforeExit.z)).toBeLessThan(0.01)
    expect(Math.abs(growthExit.ty - beforeExit.ty)).toBeLessThan(0.01)
  })

  it('keeps a dim seed core until the lily stem has time to appear', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const handoffEnd = frames.handoff[1]
    const atHandoff = getSeedPose(handoffEnd, 3.82, false)
    const duringGrowth = getSeedPose(handoffEnd + 0.55, 3.82, false)
    const afterGrowth = getSeedPose(handoffEnd + 1.1, 3.82, false)

    expect(atHandoff.seedOpacity).toBe(0)
    expect(atHandoff.coreOpacity).toBeCloseTo(0.36)
    expect(duringGrowth.coreOpacity).toBeGreaterThan(0)
    expect(afterGrowth.coreOpacity).toBe(0)
  })

  it('raises the afterimage glow above the grass independently of the shrinking shell', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    const atHandoff = getSeedPose(frames.handoff[1], 3.82, false, settings)
    const visibleCore = getSeedCorePose(atHandoff, settings.grassHeight)
    const fadedCore = getSeedCorePose(getSeedPose(frames.handoff[1] + 1.1, 3.82, false, settings), settings.grassHeight)

    expect(visibleCore.positionY).toBeGreaterThan(settings.grassHeight)
    expect(visibleCore.scale).toBeGreaterThan(atHandoff.seedSize)
    expect(fadedCore.afterimage).toBe(0)
    expect(fadedCore.scale).toBeCloseTo(atHandoff.seedSize)
  })

  it('places the seed shell bottom on the soil when the fall reaches its landing frame', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const landed = getSeedPose(frames.fall[1], 3.82, false)
    const shellBottom = getSeedShellCenterY(landed) - landed.seedSize * SEED_SHELL_HALF_HEIGHT
    expect(landed.fall).toBe(1)
    expect(shellBottom).toBeCloseTo(0, 6)
  })

  it('keeps the seed landing, short spark burst, mound and delayed moonlight timing', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const impact = frames.fall[1]
    expect(getSeedPose(impact - 0.01, 3.82, false).mound).toBe(0)
    expect(getSeedPose(impact - 0.01, 3.82, false).seedOpacity).toBeGreaterThan(0.9)
    expect(getSeedPose(impact + 0.2, 3.82, false).seedOpacity).toBeGreaterThan(0.95)
    expect(getSeedPose(frames.handoff[1], 3.82, false).seedOpacity).toBe(0)
    expect(getSeedPose(impact + 0.2, 3.82, false).seedSize).toBeLessThan(getSeedPose(impact - 0.01, 3.82, false).seedSize)
    expect(getSeedPose(impact + 0.15, 3.82, false).sparkOpacity).toBeGreaterThan(0)
    expect(getSeedPose(impact + 1, 3.82, false).sparkOpacity).toBe(0)
    expect(getSeedPose(impact + 0.49, 3.82, false).moonlight).toBe(0)
    expect(getSeedPose(impact + 0.8, 3.82, false).moonlight).toBeGreaterThan(0)
    expect(getSeedPose(impact + 2.2, 3.82, false).moonlight).toBe(1)
    expect(getSeedPose(impact + 0.04, 3.82, false).mound).toBeGreaterThan(0)
    expect(getSeedPose(impact + 1.8, 3.82, false).mound).toBe(0)
    expect(getSeedPose(impact + 0.4, 3.82, false).growthWeight).toBe(0)
    expect(getSeedPose(impact + 0.15, 3.82, true).sparkOpacity).toBe(0)
  })
})
