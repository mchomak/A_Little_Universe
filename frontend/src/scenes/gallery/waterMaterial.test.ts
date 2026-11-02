import { DataTexture, Matrix4, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { createGalleryWaterMaterial, createGalleryWaterNormalTexture, updateGalleryWaterMaterial } from './waterMaterial'

describe('gallery water material', () => {
  it('binds live reflection and normal maps and obeys water settings and reduced motion', () => {
    const reflection = new Texture()
    const normal = createGalleryWaterNormalTexture(16)
    const matrix = new Matrix4()
    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const material = createGalleryWaterMaterial(reflection, normal, matrix)

    expect(normal).toBeInstanceOf(DataTexture)
    expect(new Set(normal.image.data).size).toBeGreaterThan(1)
    expect(material.uniforms.uReflectionMap?.value).toBe(reflection)
    expect(material.uniforms.uNormalMap?.value).toBe(normal)
    expect(material.uniforms.uTextureMatrix?.value).toBe(matrix)

    updateGalleryWaterMaterial(material, settings, 3.25, false)
    expect(material.uniforms.uReflectionStrength?.value).toBe(settings.reflectionStrength)
    expect(material.uniforms.uReflectionBlur?.value).toBe(settings.reflectionBlur)
    expect(material.uniforms.uWaterDistortion?.value).toBe(settings.waterDistortion)
    expect(material.uniforms.uRippleSpeed?.value).toBe(settings.waterRippleSpeed)
    expect(material.uniforms.uNormalStrength?.value).toBe(settings.waterNormalStrength)
    expect(material.uniforms.uMoonHighlightStrength?.value).toBe(settings.moonHighlightStrength)
    expect(material.uniforms.uWaterOpacity?.value).toBe(settings.waterOpacity)
    expect(material.uniforms.uTime?.value).toBe(3.25)

    updateGalleryWaterMaterial(material, settings, 6, true)
    expect(material.uniforms.uTime?.value).toBe(0)

    material.dispose()
    normal.dispose()
    reflection.dispose()
  })
})
