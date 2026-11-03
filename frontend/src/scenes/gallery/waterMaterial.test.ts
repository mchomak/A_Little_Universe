import { DataTexture, Matrix4, PerspectiveCamera, RepeatWrapping, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { calculateGalleryMoonTrackLongitudinal, calculateMoonReflectionTrack, calculateWaterMoonReflectionGain, createGalleryWaterMaterial, createGalleryWaterNormalTexture, updateGalleryWaterCamera, updateGalleryWaterMaterial } from './waterMaterial'

describe('gallery water material', () => {
  it('gates the lunar reflection with reflection strength while keeping the moon highlight separate', () => {
    expect(calculateWaterMoonReflectionGain(0)).toBe(0)
    expect(calculateWaterMoonReflectionGain(0.5)).toBe(1)
    expect(calculateWaterMoonReflectionGain(0.6)).toBe(1.2)
  })

  it('runs from the moon horizon to the camera and keeps the reflected glint inside the track', () => {
    const moon = { x: 0.2, y: 16, z: -126 }
    const aim = { x: 0, y: -2.35, z: -34 }
    const camera = { x: 0, y: 1.7, z: 0 }
    const initial = calculateMoonReflectionTrack(moon, aim, camera, -2.35)
    const movedCamera = calculateMoonReflectionTrack(moon, aim, { ...camera, z: -24 }, -2.35)
    const movedAim = calculateMoonReflectionTrack(moon, { ...aim, x: -10 }, camera, -2.35)

    expect(initial.origin[0]).toBeCloseTo(moon.x, 4)
    expect(initial.origin[1]).toBeCloseTo(moon.z, 4)
    expect(initial.hotspot).toBeGreaterThan(100)
    expect(initial.hotspot).toBeLessThan(initial.length)
    expect(initial.length).toBeCloseTo(126.00016, 3)
    expect(initial.direction[1]).toBeGreaterThan(0.999)
    expect(initial.origin[0] + initial.direction[0] * initial.length).toBeCloseTo(camera.x, 4)
    expect(initial.origin[1] + initial.direction[1] * initial.length).toBeCloseTo(camera.z, 4)
    expect(movedCamera.length).toBeCloseTo(102.0002, 3)
    expect(movedCamera.hotspot).toBeLessThanOrEqual(movedCamera.length)
    expect(movedAim.origin).toEqual(initial.origin)
  })

  it('keeps the longitudinal band visible from its origin up to a local glint', () => {
    const trackLength = 126
    const hotspot = 103.219
    const atStartEdge = calculateGalleryMoonTrackLongitudinal(-3, trackLength, hotspot)
    const atOrigin = calculateGalleryMoonTrackLongitudinal(0, trackLength, hotspot)
    const middleBand = calculateGalleryMoonTrackLongitudinal(40, trackLength, hotspot)
    const beforeGlint = calculateGalleryMoonTrackLongitudinal(hotspot - 20, trackLength, hotspot)
    const glint = calculateGalleryMoonTrackLongitudinal(hotspot, trackLength, hotspot)
    const reflection = new Texture()
    const normal = new Texture()
    const material = createGalleryWaterMaterial(reflection, normal, new Matrix4())

    expect(atStartEdge).toBe(0)
    expect(atOrigin).toBeCloseTo(0.62, 2)
    expect(middleBand).toBeGreaterThan(0.35)
    expect(beforeGlint).toBeGreaterThan(0.2)
    expect(glint).toBeGreaterThan(beforeGlint)
    expect(material.fragmentShader).toContain('float startFade = smoothstep(-3.0, 0.0, trackAlong);')
    expect(material.fragmentShader).toContain('float moonCore = exp(-pow((trackAlong - uMoonTrackHotspot) / 3.8, 2.0));')
    expect(material.fragmentShader).toContain('float moonTail = exp(-max(trackAlong, 0.0) / max(24.0, trackLength * 0.75)) * 0.62;')
    expect(material.fragmentShader).not.toContain('smoothstep(uMoonTrackHotspot - 3.0')

    material.dispose()
    reflection.dispose()
    normal.dispose()
  })

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
    expect(material.uniforms.uReflectionFalloff?.value).toBe(settings.reflectionFalloff)
    expect(material.uniforms.uBaseBrightness?.value).toBe(settings.waterBaseBrightness)
    expect(material.uniforms.uWaterDistortion?.value).toBe(settings.waterDistortion)
    expect(material.uniforms.uDistortionScale?.value).toBe(settings.waterDistortionScale)
    expect(material.uniforms.uRippleSpeed?.value).toBe(settings.waterRippleSpeed)
    expect(material.uniforms.uNormalStrength?.value).toBe(settings.waterNormalStrength)
    expect(material.uniforms.uMoonHighlightStrength?.value).toBe(settings.moonHighlightStrength)
    expect(material.uniforms.uMoonReflectionGain?.value).toBe(1.2)
    expect(material.uniforms.uMoonReflectionSpread?.value).toBe(settings.moonReflectionSpread)
    expect(material.uniforms.uWaterOpacity?.value).toBe(settings.waterOpacity)
    expect(material.uniforms.uTime?.value).toBe(3.25)

    const camera = new PerspectiveCamera()
    camera.position.set(0, 1.7, 0)
    updateGalleryWaterCamera(material, camera)
    const track = calculateMoonReflectionTrack(
      { x: settings.moonPositionX, y: settings.moonPositionY, z: settings.moonPositionZ },
      { x: settings.moonTargetX, y: settings.moonTargetY, z: settings.moonTargetZ },
      { x: 0, y: 1.7, z: 0 },
      -2.35,
    )
    expect((material.uniforms.uMoonTrackOrigin?.value as { x: number; y: number }).x).toBeCloseTo(track.origin[0])
    expect((material.uniforms.uMoonTrackOrigin?.value as { x: number; y: number }).y).toBeCloseTo(track.origin[1])
    expect((material.uniforms.uMoonTrackLength?.value as number)).toBeCloseTo(track.length)

    updateGalleryWaterMaterial(material, { ...settings, reflectionStrength: 0 }, 4, false)
    expect(material.uniforms.uMoonReflectionGain?.value).toBe(0)
    expect(material.uniforms.uMoonHighlightStrength?.value).toBe(settings.moonHighlightStrength)
    updateGalleryWaterMaterial(material, { ...settings, moonHighlightStrength: 0 }, 4, false)
    expect(material.uniforms.uMoonReflectionGain?.value).toBe(1.2)
    expect(material.uniforms.uMoonHighlightStrength?.value).toBe(0)

    updateGalleryWaterMaterial(material, settings, 6, true)
    expect(material.uniforms.uTime?.value).toBe(0)

    material.dispose()
    normal.dispose()
    reflection.dispose()
  })

  it('builds a high-resolution normal field with fine, low-amplitude surface detail', () => {
    const normal = createGalleryWaterNormalTexture(512)

    expect(normal.image.width).toBe(512)
    expect(normal.image.height).toBe(512)
    expect(normal.image.data).toHaveLength(512 * 512 * 4)
    expect(normal.wrapS).toBe(RepeatWrapping)
    expect(new Set(normal.image.data).size).toBeGreaterThan(32)

    normal.dispose()
  })
})
