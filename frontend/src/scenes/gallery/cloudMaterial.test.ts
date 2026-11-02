import { describe, expect, it } from 'vitest'
import { BackSide, FrontSide, NormalBlending } from 'three'
import { GALLERY_WORLD } from './world'
import { createGalleryCloudVolumeMaterial, getGalleryVolumeDepthFade, setGalleryAtmosphereTime } from './cloudMaterial'

const cloudOptions = {
  kind: 'cloud' as const,
  center: [-22, 11, -25] as const,
  radii: [12.5, 8, 17] as const,
  seed: 13,
  opacity: 0.42,
  intensity: 1.3,
  moonPosition: GALLERY_WORLD.moon.position,
  moonColor: '#C3D8F2',
  moonLightIntensity: 1.1,
  driftSpeed: 0.7,
  steps: 8,
}

describe('gallery volumetric atmosphere material', () => {
  it('ray-marches seeded density through a world-space cloud volume', () => {
    const material = createGalleryCloudVolumeMaterial(cloudOptions)

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(BackSide)
    expect(material.blending).toBe(NormalBlending)
    expect(material.defines?.CLOUD_STEPS).toBe(8)
    expect(material.uniforms.uCenter!.value.toArray()).toEqual([...cloudOptions.center])
    expect(material.uniforms.uRadii!.value.toArray()).toEqual([...cloudOptions.radii])
    expect(material.uniforms.uMoonPosition!.value.toArray()).toEqual([...GALLERY_WORLD.moon.position])
    expect(material.uniforms.uMoonLightIntensity!.value).toBe(1.1)
    expect(material.uniforms.uOpacity!.value).toBe(0.42)
    expect(material.uniforms.uCloudDensity!.value).toBe(0.9)
    expect(material.uniforms.uCloudIntensity!.value).toBe(1.3)
    expect(material.uniforms.uBaseColor!.value.getHexString()).toBe('17375c')
    expect(material.uniforms.uCoolTint!.value).toBe(1)
    expect(material.uniforms.uWhiteHighlight!.value).toBe(0.48)
    expect(material.uniforms.uSeed!.value).toBe(cloudOptions.seed)
    expect(material.fragmentShader).toContain('float opticalDepth = density * uOpacity * segmentLength * 0.16')
    expect(material.fragmentShader).toContain('mix(coolBase * innerShade, uMoonColor, lunarLift) * uCloudIntensity')
    expect(material.fragmentShader).toContain('uCloudDensity * 0.18')
    expect(material.fragmentShader).toContain('uWhiteHighlight')
    expect(material.fragmentShader).toContain('vec3 blueAir')
    expect(material.fragmentShader).toContain('vec3 uvDrift = vec3(time * 0.014')
    expect(material.fragmentShader).toContain('softBoundary = smoothMax(smoothMax(lobeA, lobeB, edgeSoftness), lobeC, edgeSoftness)')
    expect(material.fragmentShader).toContain('float lobeA = 1.0 - smoothstep')
    expect(material.fragmentShader).toContain('float cloudTexture = broad * 0.52 + detail * 0.48')
    expect(material.fragmentShader).toContain('float silverEdge = smoothstep')
    expect(material.fragmentShader).toContain('transmittance *= 1.0 - sampleAlpha')
    material.dispose()
  })

  it('fades short ray segments but keeps haze visible when the camera begins inside it', () => {
    const material = createGalleryCloudVolumeMaterial({ ...cloudOptions, kind: 'haze', steps: 4 })
    expect(material.fragmentShader).toContain('rayStart > 0.001 ? rayStart : rayEnd')
    expect(getGalleryVolumeDepthFade(0, 3)).toBeGreaterThan(0)
    expect(getGalleryVolumeDepthFade(0, 20)).toBe(1)
    expect(getGalleryVolumeDepthFade(4, 20)).toBeGreaterThan(0)
    expect(getGalleryVolumeDepthFade(Number.NaN, 3)).toBe(0)
    material.dispose()
  })

  it('bounds mobile ray-step count and animation controls', () => {
    const material = createGalleryCloudVolumeMaterial({
      ...cloudOptions,
      steps: 90,
      driftSpeed: 9,
      opacity: 8,
    })
    expect(material.defines?.CLOUD_STEPS).toBe(12)
    expect(material.uniforms.uDriftSpeed!.value).toBe(2)
    expect(material.uniforms.uOpacity!.value).toBe(1.5)
    material.dispose()
  })

  it('applies a bounded softness control to the procedural cloud edges', () => {
    const material = createGalleryCloudVolumeMaterial({ ...cloudOptions, softness: 0.86 })
    expect(material.uniforms.uSoftness!.value).toBe(0.86)
    expect(material.fragmentShader).toContain('uSoftness')
    material.dispose()
  })

  it('keeps cloud and haze noise at their original spatial scales', () => {
    const material = createGalleryCloudVolumeMaterial(cloudOptions)

    expect(material.defines?.CLOUD_DETAIL_OCTAVE).toBeUndefined()
    expect(material.fragmentShader).toContain('float broadFrequency = 2.3;')
    expect(material.fragmentShader).toContain('float detailFrequency = 7.1;')
    expect(material.fragmentShader).toContain('broadFrequency = 1.55;')
    expect(material.fragmentShader).toContain('detailFrequency = 4.4;')
    expect(material.fragmentShader).not.toContain('fineDetail')

    material.dispose()
  })

  it('uses a depth-tested near shell for wisps that softly overlap the moon', () => {
    const volume = createGalleryCloudVolumeMaterial(cloudOptions)
    const moonWisp = createGalleryCloudVolumeMaterial({ ...cloudOptions, moonOcclusion: true })

    expect(volume.side).toBe(BackSide)
    expect(moonWisp.side).toBe(FrontSide)
    expect(moonWisp.depthTest).toBe(true)
    expect(moonWisp.depthWrite).toBe(false)

    volume.dispose()
    moonWisp.dispose()
  })

  it('keeps the broad haze mode soft and follows the shared gallery clock', () => {
    const material = createGalleryCloudVolumeMaterial({
      ...cloudOptions,
      kind: 'haze',
      steps: 6,
      center: [0, -1, -67],
      radii: [38, 3.8, 17],
    })

    expect(material.uniforms.uIsHaze!.value).toBe(1)
    expect(material.uniforms.uCenter!.value.toArray()).toEqual([0, -1, -67])
    expect(material.uniforms.uSeed!.value).toBe(0)
    expect(material.defines?.CLOUD_STEPS).toBe(6)
    expect(material.fragmentShader).toContain('noisePosition = sampleWorld * 0.045 + eddies + flow')
    expect(material.fragmentShader).toContain('float sampleDepthFade = smoothstep(3.0, 16.0, distanceAlongRay)')
    expect(material.fragmentShader).toContain('softBoundary = 1.0 - smoothstep(0.5, 1.0, radius)')
    expect(material.fragmentShader).toContain('density = softBoundary * (0.22 + coverage * 0.58)')
    setGalleryAtmosphereTime([material], 18.5)
    expect(material.uniforms.uTime!.value).toBe(18.5)
    setGalleryAtmosphereTime([material], Number.NaN)
    expect(material.uniforms.uTime!.value).toBe(0)
    const overlappingHaze = createGalleryCloudVolumeMaterial({ ...cloudOptions, kind: 'haze', seed: 227 })
    expect(overlappingHaze.uniforms.uSeed!.value).toBe(material.uniforms.uSeed!.value)
    overlappingHaze.dispose()
    material.dispose()
  })
})
