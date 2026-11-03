import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createBloomTextClock, getBloomTextStartDelay } from './bloomGesture'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import {
  getBloomPollenOpacity,
  getGrowthVortexOpacity,
  getGrowthVortexParticleLimit,
  getBloomPollenParticleLimit,
  getGrowthVortexPosition,
  getGrowthVortexDissipationAge,
  getGrowthVortexElapsed,
  getGrowthVortexSizeScale,
  getBloomPollenAge,
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

it('starts text only after the remaining vortex dissipation tail has cleared', () => {
  const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
  const settleDuration = frames.duration - frames.model[1]
  const delay = getBloomTextStartDelay(vortex.dissipationDuration, settleDuration)
  const bloomFrames = getBloomSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  const bloomStart = {
    scene: 'bloom' as const, time: 0, clipTime: 9, clipDuration: 9, frames, bloomFrames,
    bloomClipTime: 0, bloomClipDuration: 16, bloomOpen: false, bloomElapsed: 0, pixelRatio: 1,
    reducedMotion: false, quality: 'standard' as const,
  }

  expect(delay).toBeCloseTo(0.4)
  expect(getGrowthVortexDissipationAge({ ...bloomStart, bloomElapsed: delay - 0.01 })).toBeLessThan(vortex.dissipationDuration)
  expect(getGrowthVortexDissipationAge({ ...bloomStart, bloomElapsed: delay })).toBeCloseTo(vortex.dissipationDuration)
  expect(getBloomTextStartDelay(1, 1.9)).toBe(0)
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

it('keeps vortex age and orbit phase continuous from Bloom waiting through touch', () => {
  const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
  const bloomFrames = getBloomSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  const base = {
    scene: 'bloom' as const, time: 0, clipTime: 9, clipDuration: 9, frames, bloomFrames,
    bloomClipTime: 0, bloomClipDuration: 16, bloomOpen: false, bloomElapsed: 0, pixelRatio: 1,
    reducedMotion: false, quality: 'standard' as const,
  }

  const seed: GrowthVortexParticleSeed = { angle: 0.2, angularSpeed: 0.9, radius: 0.5, height: 0,
    verticalPhase: 0, spread: 0.5, lift: 0.5 }
  const timedSeed = { ...seed, birthProgress: 0.3 }
  const clock = createBloomTextClock(100, 'waiting', 1)
  clock.update(105.2, 0)
  const waited = { ...base, bloomElapsed: clock.time() }
  clock.setState('playing', 2)
  clock.update(105.2, 0)
  const opened = { ...base, bloomElapsed: clock.time() }

  expect(getGrowthVortexDissipationAge(waited)).toBeGreaterThan(vortex.dissipationDuration)
  expect(getGrowthVortexDissipationAge(opened)).toBe(getGrowthVortexDissipationAge(waited))
  expect(getGrowthVortexOpacity(1, 0, getGrowthVortexDissipationAge(opened), vortex.dissipationDuration)).toBe(0)
  expect(getGrowthVortexElapsed(opened, timedSeed)).toBe(getGrowthVortexElapsed(waited, timedSeed))

  // A paused frame holds its last sample; DEV seek advances from carried wait,
  // while a fresh waiting revision resets the presentation origin.
  const paused = { ...base, bloomElapsed: clock.time() }
  expect(getGrowthVortexDissipationAge(paused)).toBe(getGrowthVortexDissipationAge(opened))
  clock.update(105.2, 2)
  const seeked = { ...base, bloomElapsed: clock.time() }
  expect(clock.time()).toBeCloseTo(7.2)
  expect(getGrowthVortexElapsed(seeked, timedSeed)).toBeGreaterThan(getGrowthVortexElapsed(opened, timedSeed))
  clock.update(108.7, 0)
  clock.setState('waiting', 3)
  expect(clock.time()).toBe(0)
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
