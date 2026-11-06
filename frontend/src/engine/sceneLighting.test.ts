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
    for (const scene of ['prologue', 'growth', 'bloom', 'identity', 'cosmos', 'greeting', 'ending']) {
      expect(getSceneLighting(scene, 0)).toEqual(original)
      expect(getSceneLighting(scene, 1.8)).toEqual(original)
    }
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
