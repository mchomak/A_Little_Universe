import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { createHandwritingSchedule, getPrologueFrames } from './filmConfig'

describe('prologue frames', () => {
  it('keeps the default reveal, hold, dissolve and prompt within the 21 second gate', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)

    expect(frames.duration).toBe(21)
    expect(frames.seed).toEqual([0, 3])
    expect(frames.first).toEqual([3, 7])
    expect(frames.second[0]).toBe(10)
    expect(frames.second[1]).toBeCloseTo(14.8)
    expect(frames.hold[0]).toBeCloseTo(14.8)
    expect(frames.hold[1]).toBe(16)
    expect(frames.dissolve).toEqual([16, 21])
    expect(frames.prompt).toBe(21)
    expect(frames.particleTravelDuration).toBe(4)
  })

  it('keeps Cyrillic graphemes intact and gives punctuation a slower handwritten beat', () => {
    const schedule = createHandwritingSchedule('Я…', 4, 0.82)

    expect(schedule.map((step) => step.glyph)).toEqual(['Я', '…'])
    expect(schedule[0]!.start).toBe(0)
    expect(schedule[1]!.start).toBeCloseTo(schedule[0]!.duration)
    expect(schedule[1]!.duration).toBeGreaterThan(schedule[0]!.duration)
    expect(schedule[1]!.start + schedule[1]!.duration).toBeCloseTo(4)
  })

  it('moves the second phrase for a longer configured interval while keeping the gate at 21 seconds', () => {
    const frames = getPrologueFrames({ ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue, interphraseInterval: 3 })

    expect(frames.second[0]).toBeCloseTo(11.8)
    expect(frames.second[1]).toBe(15)
    expect(frames.dissolve[1]).toBe(21)
  })
})
