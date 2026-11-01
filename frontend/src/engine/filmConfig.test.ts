import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { createHandwritingSchedule, getBloomSceneFrames, getCreditsScrollDuration, getCreditsScrollProgress, getGreetingFrames, getGrowthSceneFrames, getPrologueCopy, getPrologueFrames, getPrologueParticleOpacity, getSceneDuration, retimeSceneElapsed } from './filmConfig'

describe('prologue frames', () => {
  it('fits awakening, reading and dust into eighteen seconds before the indefinite gate', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)

    expect(frames.duration).toBe(18)
    expect(frames.seed).toEqual([0, 2])
    expect(frames.first).toEqual([2, 5.5])
    expect(frames.second).toEqual([6.85, 10.35])
    expect(frames.hold).toEqual([10.35, 12.35])
    expect(frames.dissolve).toEqual([12.35, 16])
    expect(frames.firstDissolve).toEqual([12.35, 13.85])
    expect(frames.secondDissolve).toEqual([13.1, 14.6])
    expect(frames.prompt).toBe(18)
    expect(frames.particleTravelDuration).toBe(2.2)
  })

  it('keeps Cyrillic graphemes intact and gives punctuation a slower handwritten beat', () => {
    const schedule = createHandwritingSchedule('Я…', 4, 0.82)

    expect(schedule.map((step) => step.glyph)).toEqual(['Я', '…'])
    expect(schedule[0]!.start).toBe(0)
    expect(schedule[1]!.start).toBeCloseTo(schedule[0]!.duration)
    expect(schedule[1]!.duration).toBeGreaterThan(schedule[0]!.duration)
    expect(schedule[1]!.start + schedule[1]!.duration).toBeCloseTo(4)
  })

  it('moves a longer interphrase interval without spending the invitation or bypassing the gate', () => {
    const frames = getPrologueFrames({ ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue, interphraseInterval: 3 })

    expect(frames.second).toEqual([8.5, 11.5])
    expect(frames.dissolve).toEqual([13.5, 16])
    expect(frames.duration).toBe(18)
  })

  it('keeps extreme legacy timings finite, ordered and inside the eighteen-second scene', () => {
    const frames = getPrologueFrames({ handwritingDuration: 20, interphraseInterval: 8, readableHold: 30, fractureDuration: 20, particleDuration: 20 })
    expect(frames.first).toEqual([2, 5.5])
    expect(frames.second).toEqual([10.5, 11.5])
    expect(frames.hold).toEqual([11.5, 14])
    expect(frames.dissolve).toEqual([14, 16])
    expect(frames.firstDissolve).toEqual([14, 14 + 4 / 3])
    expect(frames.secondDissolve).toEqual([14 + 2 / 3, 16])
    expect(frames.particleTravelDuration).toBe(2)
  })

  it('offers the previous personal wording as a configuration choice', () => {
    expect(getPrologueCopy({ copyVariant: 'awakening' }).second).toBe('И решил начать с одной маленькой искры.')
    expect(getPrologueCopy({ copyVariant: 'legacy' }).second).toBe('И решил, что ты заслуживаешь чего-то особенного:')
  })

  it('uses the approved phrases in the default prologue copy', () => {
    const copy = getPrologueCopy(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    expect(copy.first).toBe('Я долго думал, что тебе подарить…')
    expect(copy.second).toBe('И решил, что ты заслуживаешь чего-то особенного:')
  })

  it('leaves the invitation free of text dust before the gate opens', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    expect(getPrologueParticleOpacity(14, frames, false)).toBeGreaterThan(0)
    expect(getPrologueParticleOpacity(16, frames, false)).toBe(0)
    expect(getPrologueParticleOpacity(17, frames, false)).toBe(0)
    expect(getPrologueParticleOpacity(14, frames, true)).toBe(0)
  })
})

describe('greeting frames', () => {
  it('overlaps handwriting, holds both phrases to read, then dissolves them in order', () => {
    const frames = getGreetingFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    expect(frames.first[0]).toBe(1)
    expect(frames.second[0]).toBeGreaterThan(frames.first[0])
    expect(frames.second[0]).toBeLessThan(frames.first[1])
    expect(frames.reading[0]).toBe(frames.second[1])
    expect(frames.reading[1] - frames.reading[0]).toBeGreaterThanOrEqual(6)
    expect(frames.firstDissolve[0]).toBe(frames.reading[1])
    expect(frames.secondDissolve[0]).toBeGreaterThan(frames.firstDissolve[0])
    expect(frames.dissolve[1]).toBeGreaterThan(frames.secondDissolve[1])
    expect(frames.credits[0]).toBeGreaterThan(frames.dissolve[1])
  })

  it('sets scroll duration from the measured text and viewport heights at a steady speed', () => {
    expect(getCreditsScrollDuration(480, 800, 28)).toBe(1360 / 28)
    expect(getCreditsScrollDuration(960, 800, 28)).toBeGreaterThan(getCreditsScrollDuration(480, 800, 28))
    expect(getCreditsScrollProgress(30, 20, 100)).toBe(0.1)
    expect(getCreditsScrollProgress(120, 20, 100)).toBe(1)
  })
})

describe('Lily scene timing', () => {
  it('fits full Growth and Bloom clips plus the existing handoff and contemplation beats', () => {
    const growth = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
    const bloom = getBloomSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)

    expect(growth.model).toEqual([5.1, 14.1])
    expect(growth.duration).toBe(16)
    expect(getSceneDuration('growth', DEFAULT_SCENE_COMPOSER_CONFIG)).toBe(16)
    expect(bloom.opening).toEqual([0, 16])
    expect(bloom.contemplate).toEqual([16, 22])
    expect(getSceneDuration('bloom', DEFAULT_SCENE_COMPOSER_CONFIG)).toBe(22)
  })

  it('updates seed handoff and total duration together when animation timing changes', () => {
    const config = { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      growth: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, formationDuration: 3.5, flowerGrowthDuration: 7 },
      bloom: { flowerBloomDuration: 12 },
    } }
    const growth = getGrowthSceneFrames(config.scenes.growth)
    const bloom = getBloomSceneFrames(config.scenes.bloom)

    expect(growth.model).toEqual([5.4, 12.4])
    expect(growth.duration).toBe(14.3)
    expect(getSceneDuration('growth', config)).toBe(14.3)
    expect(bloom.opening).toEqual([0, 12])
    expect(bloom.contemplate).toEqual([12, 18])
    expect(getSceneDuration('bloom', config)).toBe(18)
  })

  it('preserves the current seed phase, clip progress, paused pose, and waiting gate on edits', () => {
    const previous = DEFAULT_SCENE_COMPOSER_CONFIG
    const next = { ...previous, scenes: {
      ...previous.scenes,
      growth: { ...previous.scenes.growth, formationDuration: 3.5, flowerGrowthDuration: 7 },
      bloom: { flowerBloomDuration: 12 },
    } }

    const elapsed = retimeSceneElapsed('growth', 6, previous, next, 'playing')
    expect(elapsed).toBeCloseTo(6.2636363636)
    const beforeFrames = getGrowthSceneFrames(previous.scenes.growth)
    const afterFrames = getGrowthSceneFrames(next.scenes.growth)
    expect((6 - beforeFrames.handoff[1]) / (beforeFrames.model[1] - beforeFrames.handoff[1]))
      .toBeCloseTo((elapsed - afterFrames.handoff[1]) / (afterFrames.model[1] - afterFrames.handoff[1]))
    expect(retimeSceneElapsed('growth', 15, previous, next, 'playing')).toBeCloseTo(13.3)
    expect(2 / 3.2).toBeCloseTo(retimeSceneElapsed('growth', 2, previous, next, 'playing') / 3.5)
    expect(retimeSceneElapsed('bloom', 8, previous, next, 'playing')).toBe(6)
    expect(retimeSceneElapsed('bloom', 0, previous, next, 'waiting')).toBe(0)
  })

  it('keeps the fixed seed handoff stable when Growth duration changes in either direction', () => {
    const long = { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      growth: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, flowerGrowthDuration: 14 },
    } }
    const short = { ...long, scenes: {
      ...long.scenes,
      growth: { ...long.scenes.growth, flowerGrowthDuration: 4 },
    } }
    const frames = getGrowthSceneFrames(long.scenes.growth)
    const duringHandoff = frames.handoff[0] + 0.4

    expect(retimeSceneElapsed('growth', duringHandoff, long, short, 'playing')).toBeCloseTo(duringHandoff)
    expect(retimeSceneElapsed('growth', duringHandoff, short, long, 'playing')).toBeCloseTo(duringHandoff)
  })
})
