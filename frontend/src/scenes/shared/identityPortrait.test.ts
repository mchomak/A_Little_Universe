import { describe, expect, it } from 'vitest'
import { portraitPresence, portraitStage, portraitTone, portraitMotion, portraitSpark } from './identityPortrait'
import { nameSparkPosition } from './identityName'

describe('04.5 photographic portrait', () => {
  it('isolates the treatment to 17–23s with continuous handoffs', () => {
    for (const t of [0, 13, 16.99, 17, 23, 24, 28, 34]) expect(portraitPresence(t)).toBe(0)
    expect(portraitPresence(18)).toBe(1)
    expect(portraitPresence(21)).toBe(1)
    expect(portraitPresence(17.001)).toBeLessThan(.001)
    expect(portraitPresence(22.999)).toBeLessThan(.001)
  })

  it('reveals hair, eyes, nose, lips and shoulders in that order in source UV space', () => {
    const hair = portraitStage(.43, .27, .5)
    const eyes = portraitStage(.67, .365, .5)
    const nose = portraitStage(.696, .427, .5)
    const lips = portraitStage(.654, .493, .5)
    const shoulders = portraitStage(.79, .72, .5)
    expect(hair).toBeLessThan(eyes)
    expect(eyes).toBeLessThan(nose)
    expect(nose).toBeLessThan(lips)
    expect(lips).toBeLessThan(shoulders)
    expect(shoulders + .9).toBeLessThan(22)
  })

  it('preserves shadows and separates luminous detail from a flat wall', () => {
    expect(portraitTone(.04, .1)).toBeLessThan(portraitTone(.7, .1))
    expect(portraitTone(.5, .5)).toBeGreaterThan(portraitTone(.5, 0))
    expect(portraitTone(.98, 0)).toBeLessThan(1)
  })

  it('settles as recognition completes and has no motion under reduced motion', () => {
    expect(portraitMotion(18)).toBeGreaterThan(portraitMotion(20))
    expect(portraitMotion(21.5)).toBe(0)
    expect(portraitMotion(18, true)).toBe(0)
  })

  it('keeps the blue motif outside the image while leaving other shots untouched', () => {
    for (const t of [0, 8, 13, 17, 23, 28, 34]) expect(portraitSpark(t)).toEqual(nameSparkPosition(t))
    for (const t of [18, 19, 20, 21]) expect(portraitSpark(t)[0]).toBeLessThan(-1.45)
  })
})
