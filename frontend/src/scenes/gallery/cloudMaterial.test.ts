import { describe, expect, it } from 'vitest'
import { GALLERY_WORLD } from './world'
import { createGalleryAtmosphereMaterial } from './cloudMaterial'

describe('gallery atmosphere material', () => {
  it('keeps cloud shading transparent and aims its cool response at the fixed moon', () => {
    const material = createGalleryAtmosphereMaterial({
      kind: 'cloud',
      seed: 37,
      opacity: 0.42,
      moonPosition: GALLERY_WORLD.moon.position,
      moonLightIntensity: 1.1,
    })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.uniforms.uMoonPosition!.value.toArray()).toEqual([...GALLERY_WORLD.moon.position])
    expect(material.uniforms.uMoonLightIntensity!.value).toBe(1.1)
    expect(material.uniforms.uOpacity!.value).toBe(0.42)
    material.dispose()
  })
})
