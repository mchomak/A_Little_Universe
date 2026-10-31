import { describe, expect, it } from 'vitest'
import { GALLERY_WORLD } from './world'
import { createGalleryAtmosphereMaterial, setGalleryAtmosphereTime } from './cloudMaterial'

describe('gallery atmosphere material', () => {
  it('keeps cloud shading transparent and aims its cool response at the fixed moon', () => {
    const material = createGalleryAtmosphereMaterial({
      kind: 'cloud',
      seed: 37,
      opacity: 0.42,
      intensity: 1.3,
      moonPosition: GALLERY_WORLD.moon.position,
      moonLightIntensity: 1.1,
    })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.uniforms.uMoonPosition!.value.toArray()).toEqual([...GALLERY_WORLD.moon.position])
    expect(material.uniforms.uMoonLightIntensity!.value).toBe(1.1)
    expect(material.uniforms.uOpacity!.value).toBe(0.42)
    expect(material.uniforms.uCloudIntensity!.value).toBe(1.3)
    expect(material.uniforms.uDriftSpeed!.value).toBe(0.7)
    expect(material.uniforms.uTime!.value).toBe(0)
    expect(material.vertexShader).toContain('uTime * uDriftSpeed')
    expect(material.fragmentShader).toContain('uTime * uDriftSpeed')
    expect(material.uniforms.uContourStrength!.value).toBe(0.7)
    material.dispose()
  })

  it('clamps cloud drift to a calm, finite range', () => {
    const material = createGalleryAtmosphereMaterial({
      kind: 'cloud', seed: 13, opacity: 0.4, intensity: 1,
      moonPosition: GALLERY_WORLD.moon.position, moonLightIntensity: 1,
      driftSpeed: 9,
    })
    expect(material.uniforms.uDriftSpeed!.value).toBe(2)
    material.dispose()
  })

  it('updates cloud animation from the gallery clock and falls back on invalid time', () => {
    const material = createGalleryAtmosphereMaterial({
      kind: 'cloud', seed: 13, opacity: 0.4, intensity: 1,
      moonPosition: GALLERY_WORLD.moon.position, moonLightIntensity: 1,
    })
    setGalleryAtmosphereTime([material], 18.5)
    expect(material.uniforms.uTime!.value).toBe(18.5)
    setGalleryAtmosphereTime([material], Number.NaN)
    expect(material.uniforms.uTime!.value).toBe(0)
    material.dispose()
  })

  it('keeps the haze branch distinct and exposes its cloud-light intensity', () => {
    const material = createGalleryAtmosphereMaterial({
      kind: 'haze',
      seed: 41,
      opacity: 0.31,
      intensity: 1.4,
      moonPosition: GALLERY_WORLD.moon.position,
      moonLightIntensity: 0.9,
    })

    expect(material.transparent).toBe(true)
    expect(material.uniforms.uIsHaze!.value).toBe(1)
    expect(material.uniforms.uOpacity!.value).toBe(0.31)
    expect(material.uniforms.uCloudIntensity!.value).toBe(1.4)
    expect(material.uniforms.uContourStrength!.value).toBe(0)
    material.dispose()
  })
})
