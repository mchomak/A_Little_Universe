import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { createHandwritingSchedule, getPrologueCopy, getPrologueFrames, getPrologueParticleOpacity } from './filmConfig'

describe('prologue frames', () => {
  it('fits awakening, reading and dust into eighteen seconds before the indefinite gate', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)

    expect(frames.duration).toBe(18)
    expect(frames.seed).toEqual([0, 2])
    expect(frames.first).toEqual([2, 5.5])
    expect(frames.second).toEqual([7, 10.5])
    expect(frames.hold).toEqual([10.5, 12.5])
    expect(frames.dissolve).toEqual([12.5, 16])
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
    const frames = getPrologueFrames({ handwritingDuration: 20, interphraseInterval: 8, readableHold: 30, particleDuration: 20 })
    expect(frames.first).toEqual([2, 5.5])
    expect(frames.second).toEqual([10.5, 11.5])
    expect(frames.hold).toEqual([11.5, 14])
    expect(frames.dissolve).toEqual([14, 16])
    expect(frames.particleTravelDuration).toBe(2)
  })

  it('offers the previous personal wording as a configuration choice', () => {
    expect(getPrologueCopy({ copyVariant: 'awakening' }).second).toBe('И решил начать с одной маленькой искры.')
    expect(getPrologueCopy({ copyVariant: 'legacy' }).second).toBe('И решил, что ты заслуживаешь чего-то особенного:')
  })

  it('leaves the invitation free of text dust before the gate opens', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    expect(getPrologueParticleOpacity(14, frames, false)).toBeGreaterThan(0)
    expect(getPrologueParticleOpacity(16, frames, false)).toBe(0)
    expect(getPrologueParticleOpacity(17, frames, false)).toBe(0)
    expect(getPrologueParticleOpacity(14, frames, true)).toBe(0)
  })
})
