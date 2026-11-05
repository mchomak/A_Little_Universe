import { describe, expect, it } from 'vitest'
import { getSceneLighting } from './sceneLighting'

describe('scene lighting ownership', () => {
  it('keeps the existing lighting unchanged outside the gallery', () => {
    const original = {
      ambientIntensity: 0.9,
      keyIntensity: 2.4,
      keyColor: '#FFF0E8',
      fillIntensity: 1.1,
      fillColor: '#B9A4E8',
    }
    for (const scene of ['prologue', 'bloom', 'identity', 'eye', 'cosmos', 'greeting', 'ending']) {
      expect(getSceneLighting(scene, 0)).toEqual(original)
      expect(getSceneLighting(scene, 1.8)).toEqual(original)
    }
  })

  it('keeps Scene 02 dark until moonlight, then holds moderate light through growth and restores during settle', () => {
    const dark = {
      ambientIntensity: 0.1,
      keyIntensity: 0.2,
      keyColor: '#FFF0E8',
      fillIntensity: 0.08,
      fillColor: '#B9A4E8',
    }
    expect(getSceneLighting('growth', 0)).toEqual(dark)
    expect(getSceneLighting('growth', 0, 0)).toEqual(dark)
    expect(getSceneLighting('growth', 0, Number.NaN)).toEqual(dark)
    const halfwayMoonlight = getSceneLighting('growth', 0, 0.5, 0)
    expect(halfwayMoonlight.ambientIntensity).toBeCloseTo(0.225)
    expect(halfwayMoonlight.keyIntensity).toBeCloseTo(0.75)
    expect(halfwayMoonlight.fillIntensity).toBeCloseTo(0.24)
    expect(getSceneLighting('growth', 0, 1, 0)).toEqual({
      ambientIntensity: 0.35, keyIntensity: 1.3, keyColor: '#FFF0E8', fillIntensity: 0.4, fillColor: '#B9A4E8',
    })
    const halfwaySettle = getSceneLighting('growth', 0, 1, 0.5)
    expect(halfwaySettle.ambientIntensity).toBeCloseTo(0.625)
    expect(halfwaySettle.keyIntensity).toBeCloseTo(1.85)
    expect(halfwaySettle.fillIntensity).toBeCloseTo(0.75)
    expect(getSceneLighting('growth', 0, 1, 1)).toEqual(getSceneLighting('prologue', 0, 1))
  })

  it('applies cold intensity only to the gallery light rig', () => {
    expect(getSceneLighting('gallery', 0)).toEqual({
      ambientIntensity: 0, keyIntensity: 0, keyColor: '#b8cde8', fillIntensity: 0, fillColor: '#7895bb',
    })
    const gallery = getSceneLighting('gallery', 0.8)
    expect(gallery).toMatchObject({
      ambientIntensity: 0.256, keyColor: '#b8cde8', fillIntensity: 0.192, fillColor: '#7895bb',
    })
    expect(gallery.keyIntensity).toBeCloseTo(0.464, 12)
  })
})
