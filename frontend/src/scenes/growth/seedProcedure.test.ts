import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { getGrowthBloomEntryCameraPose, getGrowthCameraPose, getGrowthFrames, getGrowthHandoff, getGrowthViewportHeight, getSeedCorePose, getSeedFallDistance, getSeedFallHeightMultiplier, getSeedFallProgress, getSeedPose, getSeedShellCenterY, sampleSeedParticleSeeds, SEED_ROOT, SEED_SHELL_HALF_HEIGHT, type GrowthSettings } from './seedProcedure'
import { getPrologueLightPose } from '../prologue/lightPose'
import { getConfig } from '../../systems/scene-config/config'

function projectWorldY(worldY: number, pose: { x: number; y: number; z: number; tx: number; ty: number; tz: number }, aspect: number): number {
  const camera = new PerspectiveCamera(38, aspect, 0.1, 100)
  camera.position.set(pose.x, pose.y, pose.z)
  camera.lookAt(pose.tx, pose.ty, pose.tz)
  camera.updateMatrixWorld()
  const projected = new Vector3(0, worldY, 0).project(camera)
  return (1 - projected.y) / 2
}

describe('scene 02 seed procedure', () => {
  it('fits seed formation and a full plant growth pass inside the v3 scene window', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    expect(frames.formation).toEqual([0, settings.formationDuration])
    expect(frames.fall[0]).toBe(frames.formation[1])
    expect(frames.fall[1] - frames.fall[0]).toBeCloseTo(settings.seedFallDuration, 5)
    expect(frames.islandReveal[1]).toBe(frames.fall[1])
    expect(frames.islandReveal[1] - frames.islandReveal[0]).toBe(settings.islandRevealDuration)
    expect(frames.model[0]).toBeCloseTo(frames.fall[1] + 0.7, 5)
    expect(frames.model[1] - frames.model[0]).toBeCloseTo(settings.flowerGrowthDuration, 5)
    expect(frames.sprout[1] - frames.handoff[1]).toBeGreaterThanOrEqual(8)
    expect(frames.sprout[1] - frames.handoff[1]).toBeLessThanOrEqual(10)
    expect(frames.sprout[1]).toBeLessThan(frames.duration)
    expect(frames.duration).toBeCloseTo(frames.model[1] + 1.9, 5)
  })

  it('forms from the center, lands on the shared plant root, and hands off to growth', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    expect(getSeedPose(0, 3.82, false).anchor).toEqual([0, -1.45, 0])
    expect(getSeedPose(0, 3.82, false).seedY).toBeCloseTo(getSeedFallDistance(3.82) * getConfig().scenes.growth.seedFallHeight)
    expect(getSeedPose(frames.fall[1], 3.82, false).seedY).toBe(0)
    expect(getSeedPose(frames.handoff[0] + 0.1, 3.82, false).stage).toBe('handoff')
    expect(getSeedPose(frames.handoff[1], 3.82, false).stage).toBe('growth')
    expect(getSeedPose(frames.handoff[1], 3.82, false).growthWeight).toBeCloseTo(0.065, 3)
    expect(getSeedPose(frames.model[1], 3.82, false).growthWeight).toBeCloseTo(1)
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
    const viewHeight = getGrowthViewportHeight(1024, 768)
    const startCamera = getGrowthCameraPose(frames.fall[0], false, settings, viewHeight)
    expect(getGrowthCameraPose(frames.fall[0] + 0.2, false, settings, viewHeight).y).toBe(startCamera.y)
    expect(getGrowthCameraPose(frames.fall[0] + 0.8, false, settings, viewHeight).y).toBe(startCamera.y)
    expect(getGrowthCameraPose(frames.fall[0] + 1.5, false, settings, viewHeight).y).toBeLessThan(startCamera.y)
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

  it('keeps a compact seed and the island in the fixed reduced-motion 4:3 camera at default and max height', () => {
    const base = getConfig().scenes.growth
    const width = 1024
    const height = 768
    const aspect = width / height
    const viewportHeight = getGrowthViewportHeight(width, height)

    for (const configuredHeight of [3.2, 6.4]) {
      const settings = { ...base, seedFallHeight: configuredHeight } as GrowthSettings
      const frames = getGrowthFrames(settings)
      const startCamera = getGrowthCameraPose(0, true, settings, viewportHeight)
      const contactCamera = getGrowthCameraPose(frames.fall[1], true, settings, viewportHeight)
      const startSeed = getSeedPose(0, viewportHeight, true, settings)
      const middleSeed = getSeedPose((frames.fall[0] + frames.fall[1]) / 2, viewportHeight, true, settings)
      const contactSeed = getSeedPose(frames.fall[1], viewportHeight, true, settings)
      const screenY = (seed: typeof startSeed) => projectWorldY(seed.anchor[1] + seed.seedY, startCamera, aspect)

      expect(getSeedFallHeightMultiplier(configuredHeight, true)).toBe(1)
      expect(screenY(startSeed)).toBeGreaterThan(0)
      expect(screenY(startSeed)).toBeLessThan(1)
      expect(screenY(middleSeed)).toBeGreaterThan(0)
      expect(screenY(middleSeed)).toBeLessThan(1)
      expect(screenY(contactSeed)).toBeGreaterThan(0)
      expect(screenY(contactSeed)).toBeLessThan(1)
      expect(projectWorldY(SEED_ROOT[1], startCamera, aspect)).toBeLessThan(1)
      expect(contactCamera).toEqual(startCamera)
      expect(getGrowthCameraPose(frames.duration, true, settings, viewportHeight))
        .toEqual(getGrowthBloomEntryCameraPose(settings, true, viewportHeight))
    }
  })

  it('fits the seed against the current landscape or portrait camera framing', () => {
    expect(getGrowthViewportHeight(1024, 768)).toBeCloseTo(3.856, 2)
    expect(getGrowthViewportHeight(768, 1024)).toBeCloseTo(5.732, 2)
  })

  it('accelerates through impact with nonzero terminal speed and keeps the camera aligned', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const [start, end] = frames.fall
    const step = (end - start) / 20
    const ys = Array.from({ length: 21 }, (_, i) => getSeedPose(start + step * i, 3.82, false).seedY)
    const drops = ys.slice(1).map((y, i) => ys[i]! - y)
    const velocities = drops.map(drop => drop / step)
    const averageVelocity = (ys[0]! - ys[ys.length - 1]!) / (end - start)
    expect(ys[0]).toBeCloseTo(getSeedFallDistance(3.82) * getConfig().scenes.growth.seedFallHeight)
    expect(ys[ys.length - 1]).toBeCloseTo(0)
    expect(ys.every((y, i) => i === 0 || y <= ys[i - 1]!)).toBe(true)
    expect(velocities[0]).toBeLessThan(averageVelocity * 0.2)
    expect(velocities[1]).toBeGreaterThan(velocities[0]!)
    expect(velocities[10]).toBeGreaterThan(velocities[2]!)
    expect(velocities[19]).toBeGreaterThan(velocities[18]!)
    expect(velocities[19]).toBeGreaterThan(averageVelocity * 2)
    const cameraAtFallStart = getGrowthCameraPose(start, false)
    expect(getGrowthCameraPose(start + 0.15, false).y).toBe(cameraAtFallStart.y)
    expect(getGrowthCameraPose(start + 0.8, false).y).toBe(cameraAtFallStart.y)
    expect(getGrowthCameraPose(23, false).y).toBeCloseTo(-0.02)
    expect(getGrowthCameraPose(23, false).ty).toBeCloseTo(-0.12)
    expect(getGrowthCameraPose(23, false).z).toBeCloseTo(7.8)
    expect(getGrowthCameraPose(end + 0.1, true).y).toBe(-0.2)
    expect(getGrowthCameraPose(23, true)).toMatchObject({ y: -0.2, ty: -0.2, z: 7.8 })
    const before = getGrowthCameraPose(end - 0.001, false)
    const after = getGrowthCameraPose(end + 0.001, false)
    expect(Math.abs(before.y - after.y)).toBeLessThan(0.01)
  })

  it('holds the camera until the falling seed reaches 62% of the 4:3 frame, then reveals the fixed island', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    const width = 1024
    const height = 768
    const viewportHeight = getGrowthViewportHeight(width, height)
    const startCamera = getGrowthCameraPose(frames.fall[0], false, settings, viewportHeight)
    const startSeed = getSeedPose(frames.fall[0], viewportHeight, false, settings)
    const startWorldY = startSeed.anchor[1] + startSeed.seedY

    expect(projectWorldY(startWorldY, startCamera, width / height)).toBeCloseTo(0.5, 4)
    expect(startWorldY).toBeGreaterThan(0.5)
    expect(projectWorldY(SEED_ROOT[1], startCamera, width / height)).toBeGreaterThan(1)

    const thresholdTime = Array.from({ length: 1001 }, (_, index) => frames.fall[0] + (frames.fall[1] - frames.fall[0]) * index / 1000)
      .find(time => {
        const pose = getSeedPose(time, viewportHeight, false, settings)
        return projectWorldY(pose.anchor[1] + pose.seedY, startCamera, width / height) >= 0.62
      })
    expect(thresholdTime).toBeDefined()
    const thresholdSeed = getSeedPose(thresholdTime!, viewportHeight, false, settings)
    expect(projectWorldY(thresholdSeed.anchor[1] + thresholdSeed.seedY, startCamera, width / height)).toBeLessThan(0.625)
    const cameraAtThreshold = getGrowthCameraPose(thresholdTime!, false, settings, viewportHeight)
    expect(Math.abs(cameraAtThreshold.y - startCamera.y)).toBeLessThan(0.001)
    expect(Math.abs(cameraAtThreshold.z - startCamera.z)).toBeLessThan(0.001)
    expect(getGrowthCameraPose(thresholdTime! - 0.01, false, settings, viewportHeight)).toMatchObject({ y: startCamera.y, z: startCamera.z, ty: startCamera.ty })
    expect(getGrowthCameraPose(thresholdTime! + settings.seedCameraLag + 0.1, false, settings, viewportHeight).y).toBeLessThan(startCamera.y)

    const landed = getSeedPose(frames.fall[1], viewportHeight, false, settings)
    const landingCamera = getGrowthCameraPose(frames.fall[1], false, settings, viewportHeight)
    expect(landed.anchor[1] + landed.seedY).toBeCloseTo(SEED_ROOT[1], 6)
    expect(projectWorldY(SEED_ROOT[1], landingCamera, width / height)).toBeLessThan(1)
  })

  it('catches the seed near the center at impact across the maximum 4:3 fall distance', () => {
    const base = getConfig().scenes.growth
    const settings = { ...base, seedFallHeight: 6.4 } as GrowthSettings
    const frames = getGrowthFrames(settings)
    const width = 1200
    const height = 900
    const aspect = width / height
    const viewportHeight = getGrowthViewportHeight(width, height)
    const startCamera = getGrowthCameraPose(frames.fall[0], false, settings, viewportHeight)
    const startSeed = getSeedPose(frames.fall[0], viewportHeight, false, settings)
    const startWorldY = startSeed.anchor[1] + startSeed.seedY
    const impactCamera = getGrowthCameraPose(frames.fall[1], false, settings, viewportHeight)
    const impactSeed = getSeedPose(frames.fall[1], viewportHeight, false, settings)
    const beforeImpact = getGrowthCameraPose(frames.fall[1] - 0.001, false, settings, viewportHeight)
    const afterImpact = getGrowthCameraPose(frames.fall[1] + 0.001, false, settings, viewportHeight)

    expect(projectWorldY(startWorldY, startCamera, aspect)).toBeCloseTo(0.5, 4)
    expect(projectWorldY(SEED_ROOT[1], startCamera, aspect)).toBeGreaterThan(1)
    expect(impactSeed.anchor[1] + impactSeed.seedY).toBeCloseTo(SEED_ROOT[1], 6)
    const impactScreenY = projectWorldY(impactSeed.anchor[1] + impactSeed.seedY, impactCamera, aspect)
    expect(impactScreenY).toBeGreaterThan(0.35)
    expect(impactScreenY).toBeLessThan(0.75)
    expect(impactCamera.y).toBeLessThan(startCamera.y)
    expect(Math.abs(beforeImpact.y - afterImpact.y)).toBeLessThan(0.01)
  })

  it('slows the seed spin smoothly to a stable orientation at contact', () => {
    const base = getConfig().scenes.growth
    const settings = { ...base, seedSpinSpeed: 2, seedWobbleAmplitude: 0.3 } as GrowthSettings
    const [start, end] = getGrowthFrames(settings).fall
    const samples = Array.from({ length: 21 }, (_, index) => getSeedPose(start + (end - start) * index / 20, 3.856, false, settings))
    const spinSteps = samples.slice(1).map((pose, index) => pose.spinAngle - samples[index]!.spinAngle)

    expect(samples[0]!.spinAngle).toBeCloseTo(start * 0.24, 6)
    expect(spinSteps.every(step => step >= 0)).toBe(true)
    expect(spinSteps[2]).toBeGreaterThan(spinSteps[0]!)
    expect(spinSteps[10]).toBeGreaterThan(spinSteps[5]!)
    expect(spinSteps[19]).toBeLessThan(spinSteps[0]! * 0.025)
    expect(getSeedPose(end + 0.2, 3.856, false, settings).spinAngle).toBeCloseTo(samples[20]!.spinAngle)
    expect(samples.every(pose => Math.abs(pose.wobbleAngle) <= settings.seedWobbleAmplitude)).toBe(true)
    expect(samples[0]!.wobbleAngle).toBeCloseTo(Math.sin(start * 1.8) * 0.035, 6)
    expect(samples[20]!.wobbleAngle).toBeCloseTo(0, 6)
    const reducedMotion = getSeedPose(start + 0.8, 3.856, true, settings)
    expect(reducedMotion.spinAngle).toBe(0)
    expect(reducedMotion.wobbleAngle).toBe(0)
    expect(samples[0]!.tumbleAngle).toBe(0)
    expect(samples[10]!.tumbleAngle).toBeGreaterThan(0)
    expect(samples[20]!.tumbleAngle).toBeGreaterThan(samples[10]!.tumbleAngle)
    expect(getSeedPose(end + 0.2, 3.856, false, settings).tumbleAngle).toBeCloseTo(samples[20]!.tumbleAngle)
    expect(reducedMotion.tumbleAngle).toBe(0)
  })

  it('uses a monotonic accelerating curve and retains nonzero terminal velocity', () => {
    const slow = getSeedFallProgress(0.5, 2)
    const fast = getSeedFallProgress(0.5, 3.2)
    expect(getSeedFallProgress(0, 3.2)).toBe(0)
    expect(getSeedFallProgress(1, 3.2)).toBe(1)
    expect(fast).toBeLessThan(slow)
    expect(getSeedFallProgress(0.9, 3.2)).toBeCloseTo(0.7138, 4)
  })

  it('preserves formation rotation and transitions continuously into the configured fall spin', () => {
    const settings = getConfig().scenes.growth
    const [fallStart] = getGrowthFrames(settings).fall
    const epsilon = 0.001
    const formation = getSeedPose(2.8, 3.856, false, settings)
    const before = getSeedPose(fallStart - epsilon, 3.856, false, settings)
    const at = getSeedPose(fallStart, 3.856, false, settings)
    const after = getSeedPose(fallStart + epsilon, 3.856, false, settings)

    expect(formation.spinAngle).toBeCloseTo(2.8 * 0.24, 6)
    expect(formation.wobbleAngle).toBeCloseTo(Math.sin(2.8 * 1.8) * 0.035, 6)
    expect(at.spinAngle).toBeCloseTo(fallStart * 0.24, 6)
    expect(at.wobbleAngle).toBeCloseTo(Math.sin(fallStart * 1.8) * 0.035, 6)
    expect(at.spinAngle - before.spinAngle).toBeCloseTo(0.24 * epsilon, 5)
    expect(after.spinAngle - at.spinAngle).toBeCloseTo(0.24 * epsilon, 5)
    expect(after.wobbleAngle).toBeCloseTo(at.wobbleAngle, 3)
  })

  it('keeps the island base inside a 4:3 frame through landing and growth settle', () => {
    const settings = getConfig().scenes.growth
    const frames = getGrowthFrames(settings)
    const tangent = Math.tan(38 * Math.PI / 360)
    const islandBottom = SEED_ROOT[1] - settings.islandThickness - settings.islandDepth - settings.islandRadius * 0.05
    const contact = getGrowthCameraPose(frames.fall[1], false, settings)
    const finale = getGrowthCameraPose(frames.duration, false, settings)
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
