import { expect, it } from 'vitest'
import { AnimationClip, Group, Vector3 } from 'three'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import {
  createLilyGrowthVfx,
  getBloomPollenOpacity,
  getGrowthVortexOpacity,
  getGrowthVortexParticleLimit,
  getBloomPollenParticleLimit,
  getGrowthVortexPosition,
  getGrowthVortexDissipationAge,
  getGrowthVortexElapsed,
  getGrowthVortexSizeScale,
  getBloomPollenAge,
  getBloomPollenPosition,
  type GrowthVortexParticleSeed,
} from './lilyGrowthVfx'

const vortex = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex

it('starts the growth vortex at the root and expands its orbit on successive turns', () => {
  const seed: GrowthVortexParticleSeed = {
    angle: 0, angularSpeed: 1, radius: 0, height: 0, verticalPhase: 0, spread: 0.5, lift: 0.5, birthProgress: 0,
  }
  const anchor = new Vector3(2, 3, 4)
  const clockwiseSettings = { ...vortex, rotationSpeed: 1, orbitRadius: 0.6, verticalSpread: 1 }
  const start = getGrowthVortexPosition(seed, 0, 0, anchor, clockwiseSettings, new Vector3(), 1, 1, 0, 2)
  const quarterTurn = getGrowthVortexPosition(seed, Math.PI / 2, 0, anchor, clockwiseSettings, new Vector3(), 1, 1, 0, 2)
  const oneTurn = getGrowthVortexPosition(seed, Math.PI * 2, 0, anchor, clockwiseSettings, new Vector3(), 1, 1, 0, 2)
  const twoTurns = getGrowthVortexPosition(seed, Math.PI * 4, 0, anchor, clockwiseSettings, new Vector3(), 1, 1, 0, 2)

  expect(start.x - anchor.x).toBeLessThan(0.1)
  expect(start.y).toBeCloseTo(3)
  expect(start.z).toBeCloseTo(4)
  // Viewed from +Y, positive X moving toward positive Z is clockwise.
  expect(quarterTurn.x).toBeCloseTo(anchor.x)
  expect(quarterTurn.z).toBeGreaterThan(anchor.z)
  expect(Math.hypot(oneTurn.x - anchor.x, oneTurn.z - anchor.z)).toBeGreaterThan(Math.hypot(start.x - anchor.x, start.z - anchor.z))
  expect(Math.hypot(twoTurns.x - anchor.x, twoTurns.z - anchor.z)).toBeGreaterThan(Math.hypot(oneTurn.x - anchor.x, oneTurn.z - anchor.z))
  const ahead = getGrowthVortexPosition(seed, Math.PI * 4, 0, anchor, clockwiseSettings, new Vector3(), 1, 1, 1, 2)
  expect(ahead.y).toBeGreaterThan(anchor.y + 2)
})

it('moves new vortex births up the stem below the posed bud while retaining the root at zero growth', () => {
  const seed: GrowthVortexParticleSeed = {
    angle: 0, angularSpeed: 1, radius: 0, height: 0, verticalPhase: 0, spread: 0.5, lift: 0.5, birthProgress: 0.65,
  }
  const root = new Vector3(1, 2, 3)
  const bud = new Vector3(1.4, 6, 3.8)
  const settings = { ...vortex, orbitRadius: 0 }
  const atRoot = getGrowthVortexPosition({ ...seed, birthProgress: 0 }, 0, 0, root, settings, new Vector3(),
    1, 1, 0, bud.y - root.y, bud)
  const atBirth = getGrowthVortexPosition(seed, 0, 0, root, settings, new Vector3(),
    1, 1, seed.birthProgress, bud.y - root.y, bud)

  expect(atRoot.distanceTo(root)).toBeCloseTo(0)
  expect(atBirth.x).toBeCloseTo(1.3)
  expect(atBirth.y).toBeCloseTo(5)
  expect(atBirth.z).toBeCloseTo(3.6)
  expect(atBirth.y).toBeLessThan(bud.y)
})

it('keeps an existing vortex particle anchored to its birth point as the posed bud continues upward', () => {
  const seed: GrowthVortexParticleSeed = {
    angle: 0, angularSpeed: 1, radius: 0, height: 0, verticalPhase: 0, spread: 0.5, lift: 0.5, birthProgress: 0.4,
  }
  const root = new Vector3(1, 2, 3)
  const budAtBirth = new Vector3(1.4, 4, 3.4)
  const budLater = new Vector3(1.8, 6, 3.8)
  const settings = { ...vortex, orbitRadius: 0, verticalSpread: 0, dissipationSpread: 0 }
  const born = getGrowthVortexPosition(seed, 0, 0, root, settings, new Vector3(), 1, 1,
    seed.birthProgress, 0, budAtBirth)
  const later = getGrowthVortexPosition(seed, 0, 0, root, settings, new Vector3(), 1, 1,
    0.8, 0, budLater)

  expect(born.x).toBeCloseTo(1.3)
  expect(born.y).toBeCloseTo(3.5)
  expect(born.z).toBeCloseTo(3.3)
  expect(later.x).toBeCloseTo(born.x)
  expect(later.y).toBeCloseTo(born.y)
  expect(later.z).toBeCloseTo(born.z)
})

it('fades the remaining growth vortex tail into automatic Bloom', () => {
  const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
  const settleDuration = frames.duration - frames.model[1]
  const delay = Math.max(0, vortex.dissipationDuration - settleDuration)
  const bloomFrames = getBloomSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  const bloomStart = {
    scene: 'bloom' as const, time: 0, clipTime: 9, clipDuration: 9, frames, bloomFrames,
    bloomClipTime: 0, bloomClipDuration: 16, bloomOpen: true, bloomElapsed: 0, pixelRatio: 1,
    reducedMotion: false, quality: 'standard' as const,
  }

  expect(delay).toBeCloseTo(0.4)
  expect(getGrowthVortexDissipationAge({ ...bloomStart, bloomElapsed: delay - 0.01 })).toBeLessThan(vortex.dissipationDuration)
  expect(getGrowthVortexDissipationAge({ ...bloomStart, bloomElapsed: delay })).toBeCloseTo(vortex.dissipationDuration)
})

it('fades and expands the vortex only across its configured dissipation interval', () => {
  const seed: GrowthVortexParticleSeed = {
    angle: 0, angularSpeed: 1, radius: 0.4, height: 0, verticalPhase: 0, spread: 1, lift: 1,
  }
  const anchor = new Vector3()
  const before = getGrowthVortexPosition(seed, 0, 0, anchor, vortex, new Vector3())
  const after = getGrowthVortexPosition(seed, 0, 0.5, anchor, { ...vortex, dissipationSpread: 1 }, new Vector3())

  expect(after.x).toBeGreaterThan(before.x)
  expect(getGrowthVortexOpacity(0.5, 0.4, 0, 4)).toBeGreaterThan(0)
  expect(getGrowthVortexOpacity(0.5, 0.4, 4, 4)).toBe(0)
  expect(getGrowthVortexOpacity(0.2, 0.4, 0, 4)).toBe(0)
  expect(getGrowthVortexSizeScale(0.5)).toBeLessThan(getGrowthVortexSizeScale(0))
  expect(getGrowthVortexSizeScale(1)).toBeLessThan(0.4)
})

it('ages the vortex continuously through automatic Bloom and DEV seeks', () => {
  const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
  const bloomFrames = getBloomSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  const base = {
    scene: 'bloom' as const, time: 0, clipTime: 9, clipDuration: 9, frames, bloomFrames,
    bloomClipTime: 0, bloomClipDuration: 16, bloomOpen: true, bloomElapsed: 0, pixelRatio: 1,
    reducedMotion: false, quality: 'standard' as const,
  }

  const seed: GrowthVortexParticleSeed = { angle: 0.2, angularSpeed: 0.9, radius: 0.5, height: 0,
    verticalPhase: 0, spread: 0.5, lift: 0.5 }
  const timedSeed = { ...seed, birthProgress: 0.3 }
  const opened = { ...base, time: 1.2, bloomClipTime: 1.2, bloomElapsed: 1.2 }
  const paused = { ...opened }
  const seeked = { ...base, time: 3.4, bloomClipTime: 3.4, bloomElapsed: 3.4 }

  expect(getGrowthVortexDissipationAge(opened)).toBeGreaterThan(getGrowthVortexDissipationAge(base))
  expect(getGrowthVortexDissipationAge(paused)).toBe(getGrowthVortexDissipationAge(opened))
  expect(getGrowthVortexElapsed(opened, timedSeed)).toBeGreaterThan(getGrowthVortexElapsed(base, timedSeed))
  expect(getGrowthVortexElapsed(seeked, timedSeed)).toBeGreaterThan(getGrowthVortexElapsed(opened, timedSeed))
})

it('reveals pollen with the opening, peaks before full bloom, then leaves a sparse tail', () => {
  const seed = { phase: 0.2, brightness: 0.8, radius: 0.5, depth: 0.4, drift: 0.3, size: 0.6, angle: 0.7 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const early = getBloomPollenOpacity(seed, 0.15, 0.2, settings)
  const nearOpen = getBloomPollenOpacity(seed, 0.9, 1.2, settings)
  const fullOpen = getBloomPollenOpacity(seed, 1, 2.2, settings)
  const expired = getBloomPollenOpacity(seed, 1, settings.lifetime + 0.1, settings)

  expect(early).toBe(0)
  expect(nearOpen).toBeGreaterThan(0)
  expect(fullOpen).toBeGreaterThan(0)
  expect(fullOpen).toBeLessThan(nearOpen)
  expect(expired).toBe(0)
})

it('keeps pollen hidden below half bloom and reveals it smoothly after the threshold', () => {
  const seed = { phase: 0.35, brightness: 0.8, radius: 0.5, depth: 0.4, drift: 0.3, size: 0.6, angle: 0.7 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const beforeThreshold = getBloomPollenOpacity(seed, 0.49, 0.9, settings)
  const atThreshold = getBloomPollenOpacity(seed, 0.5, 0.9, settings)
  const beginning = getBloomPollenOpacity(seed, 0.55, 0.9, settings)
  const furtherOpen = getBloomPollenOpacity(seed, 0.62, 0.9, settings)

  expect(beforeThreshold).toBe(0)
  expect(atThreshold).toBe(0)
  expect(beginning).toBeGreaterThan(0)
  expect(beginning).toBeLessThan(furtherOpen)
})

it('starts each pollen trajectory at the half-bloom boundary even for an early seed phase', () => {
  const seed = { phase: 0.2, brightness: 0.8, radius: 0.5, depth: 0.4, drift: 0.3, size: 0.6, angle: 0.7 }
  const atThreshold = getBloomPollenAge(seed, 8, 16, 0, 6, 3.8)
  const afterThreshold = getBloomPollenAge(seed, 8.8, 16, 0, 6, 3.8)

  expect(atThreshold.age).toBe(0)
  expect(afterThreshold.age).toBeCloseTo(0.8)
  expect(atThreshold.terminalTail).toBe(false)
})

it('gives only a few late pollen seeds a new, short-lived birth in the held-open pose', () => {
  const tailSeed = { phase: 0.9, brightness: 0.8, radius: 0.5, depth: 0.4, drift: 0.3, size: 0.6, angle: 0.7 }
  const ordinarySeed = { ...tailSeed, phase: 0.5 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const tail = getBloomPollenAge(tailSeed, 9, 9, 6, 6, settings.lifetime)
  const ordinary = getBloomPollenAge(ordinarySeed, 9, 9, 6, 6, settings.lifetime)

  expect(tail.age).toBeCloseTo(0.6)
  expect(tail.terminalTail).toBe(true)
  expect(getBloomPollenOpacity(tailSeed, 1, tail.age, settings)).toBeGreaterThan(0)
  expect(ordinary.age).toBeCloseTo(10.5)
  expect(ordinary.terminalTail).toBe(false)
  expect(getBloomPollenOpacity(ordinarySeed, 1, ordinary.age, settings)).toBe(0)
})

it('caps the added workload by quality and reduces motion without disabling the effect', () => {
  expect(getGrowthVortexParticleLimit(2000, 'standard')).toBe(1600)
  expect(getGrowthVortexParticleLimit(360, 'low')).toBe(180)
  expect(getGrowthVortexParticleLimit(360, 'standard', true)).toBe(198)
  expect(getBloomPollenParticleLimit(900, 'standard')).toBe(600)
  expect(getBloomPollenParticleLimit(48, 'low', true)).toBe(17)
  expect(getGrowthVortexParticleLimit(0, 'standard')).toBe(0)
  expect(getBloomPollenParticleLimit(0, 'standard')).toBe(0)
})

it('splits the pollen budget between an inner quarter and the outer flow', () => {
  expect(getBloomPollenParticleLimit(100, 'standard', false, 'inner')).toBe(25)
  expect(getBloomPollenParticleLimit(100, 'standard', false, 'outer')).toBe(75)
  expect(getBloomPollenParticleLimit(1, 'standard', false, 'inner')).toBe(1)
  expect(getBloomPollenParticleLimit(1, 'standard', false, 'outer')).toBe(0)
  expect(getBloomPollenParticleLimit(0, 'standard', false, 'inner')).toBe(0)
  expect(getBloomPollenParticleLimit(0, 'standard', false, 'outer')).toBe(0)
})

it('keeps default pollen point sizes visibly distinct from the flower at standard quality', () => {
  const wrapper = new Group()
  const model = new Group()
  const cup = new Group()
  cup.name = 'Flower_Interior'
  model.add(cup)
  wrapper.add(model)

  const defaults = DEFAULT_SCENE_COMPOSER_CONFIG
  const settings = defaults.scenes.bloom.lilyBloomPollen
  const effect = createLilyGrowthVfx(wrapper, model, new AnimationClip('Growth', 9, []))
  effect.update({
    scene: 'bloom', time: 11, clipTime: 0, clipDuration: 9,
    frames: getGrowthSceneFrames(defaults.scenes.growth), bloomFrames: getBloomSceneFrames(defaults.scenes.bloom),
    bloomClipTime: 10, bloomClipDuration: 16, bloomOpen: true, bloomElapsed: 0,
    pixelRatio: 1, reducedMotion: false, quality: 'standard',
  }, defaults.scenes.growth, settings)

  const pollenStart = 30 + effect.particleSources.length + 1600
  const innerCount = getBloomPollenParticleLimit(settings.particleCount, 'standard', false, 'inner')
  const outerCount = getBloomPollenParticleLimit(settings.particleCount, 'standard', false, 'outer')
  const pointSizes = effect.geometry.getAttribute('aSize')
  const opacities = effect.geometry.getAttribute('aOpacity')
  const activeInnerIndices = Array.from({ length: innerCount }, (_, index) => pollenStart + index)
    .filter(index => opacities.getX(index) > 0)
  const activeOuterIndices = Array.from({ length: outerCount }, (_, index) => pollenStart + innerCount + index)
    .filter(index => opacities.getX(index) > 0)
  const innerSizes = activeInnerIndices.map(index => pointSizes.getX(index))
  const outerSizes = activeOuterIndices.map(index => pointSizes.getX(index))

  expect(activeInnerIndices.length).toBeGreaterThan(0)
  expect(activeOuterIndices.length).toBeGreaterThan(0)
  expect(Math.min(...outerSizes)).toBeGreaterThan(2.4)
  expect(Math.min(...innerSizes)).toBeGreaterThan(Math.max(...outerSizes))

  effect.dispose()
})

it('moves inner pollen from the cup base to a bounded hover around anthers', () => {
  const seed = { phase: 0.6, brightness: 0.8, radius: 0.5, depth: 0.2, drift: 0.4, size: 0.5, angle: 0.5 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const source = new Vector3(0, 0, 0)
  const anthers = new Vector3(0, 0.42, 0)
  const atBirth = getBloomPollenPosition(seed, 0, source, settings, new Vector3(), 1, 1, 'inner', anthers)

  expect(atBirth.distanceTo(source)).toBeLessThan(0.05)
  for (const age of [0.8, 2, 3.7]) {
    const hovering = getBloomPollenPosition(seed, age, source, settings, new Vector3(), 1, 1, 'inner', anthers)
    expect(hovering.distanceTo(anthers)).toBeLessThan(0.1)
  }
})

it('lets inner pollen drift within the cup instead of holding a fixed orbital radius', () => {
  const seed = { phase: 0.6, brightness: 0.8, radius: 0.5, depth: 0.2, drift: 0.4, size: 0.5, angle: 0.5 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const source = new Vector3(0, 0, 0)
  const anthers = new Vector3(0, 0.42, 0)
  const positions = [0.8, 1.2, 1.8, 2.5, 3.3].map(age =>
    getBloomPollenPosition(seed, age, source, settings, new Vector3(), 1, 1, 'inner', anthers))
  const horizontalRadii = positions.map(point => Math.hypot(point.x - anthers.x, point.z - anthers.z))
  const beforeSmallStep = getBloomPollenPosition(seed, 1.5, source, settings, new Vector3(), 1, 1, 'inner', anthers)
  const afterSmallStep = getBloomPollenPosition(seed, 1.51, source, settings, new Vector3(), 1, 1, 'inner', anthers)
  const smallStep = beforeSmallStep.distanceTo(afterSmallStep)

  expect(Math.max(...horizontalRadii) - Math.min(...horizontalRadii)).toBeGreaterThan(0.01)
  expect(Math.max(...positions.map(point => point.distanceTo(anthers)))).toBeLessThan(0.12)
  expect(smallStep).toBeGreaterThan(0)
  expect(smallStep).toBeLessThan(0.00013)
})

it('lifts outer pollen around the petal silhouette and fans it sideways smoothly', () => {
  const seed = { phase: 0.6, brightness: 0.8, radius: 0.3, depth: 0, drift: 0.35, size: 0.5, angle: 0 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const source = new Vector3(0, 0, 0)
  const position = (age: number) => getBloomPollenPosition(seed, age, source, settings, new Vector3())
  const born = position(0)
  const middle = position(1.5)
  const fanning = position(2.8)
  const beforeFan = position(2.2)
  const afterFan = position(2.21)
  const sideRadius = (point: Vector3) => Math.hypot(point.x - source.x, point.z - source.z)

  expect(sideRadius(born)).toBeLessThan(0.03)
  expect(fanning.y).toBeGreaterThan(middle.y)
  expect(sideRadius(fanning)).toBeGreaterThan(sideRadius(middle) + 0.03)
  expect(beforeFan.distanceTo(afterFan)).toBeLessThan(0.01)
})

it('makes inner pollen brighter while preserving the configured glow as its base', () => {
  const seed = { phase: 0.4, brightness: 0.5, radius: 0.5, depth: 0, drift: 0.4, size: 0.5, angle: 0.7 }
  const settings = { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen, glowIntensity: 0.5 }
  const outer = getBloomPollenOpacity(seed, 0.75, 0.7, settings, 'outer')
  const inner = getBloomPollenOpacity(seed, 0.75, 0.7, settings, 'inner')

  expect(outer).toBeGreaterThan(0)
  expect(inner).toBeCloseTo(outer * 1.35)
})

it('keeps inner pollen present through the open hold while outer pollen expires', () => {
  const seed = { phase: 0.6, brightness: 0.8, radius: 0.5, depth: 0, drift: 0.4, size: 0.5, angle: 0.7 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const heldAge = settings.lifetime + 4

  expect(getBloomPollenOpacity(seed, 1, heldAge, settings, 'outer')).toBe(0)
  expect(getBloomPollenOpacity(seed, 1, heldAge, settings, 'inner')).toBeGreaterThan(0)
})

it('rebuilds both pollen paths from the same absolute bloom sample after a seek', () => {
  const seed = { phase: 0.58, brightness: 0.8, radius: 0.5, depth: 0.2, drift: 0.4, size: 0.5, angle: 0.7 }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const source = new Vector3(0, 0, 0)
  const anthers = new Vector3(0, 0.42, 0)
  const sample = (progress: number, group: 'inner' | 'outer') => {
    const age = getBloomPollenAge(seed, progress * 16, 16, 0, 6, settings.lifetime).age
    return getBloomPollenPosition(seed, age, source, settings, new Vector3(), 1, 1, group, anthers).toArray()
  }
  const openingInner = sample(0.72, 'inner')
  const openingOuter = sample(0.72, 'outer')
  sample(0.96, 'inner')
  sample(0.96, 'outer')

  expect(sample(0.72, 'inner')).toEqual(openingInner)
  expect(sample(0.72, 'outer')).toEqual(openingOuter)
  expect(openingInner).not.toEqual(openingOuter)
})
