import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Texture, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { createFrameFootprintMaterial, createPhotoReflectionLayout, createPhotoReflectionMaterial, getReflectionUvEdgeMask, PHOTO_REFLECTION_PLANE_ROTATION_X, updateFrameFootprintMaterial, updatePhotoReflectionMaterial } from './reflections'

describe('gallery photo reflection layout', () => {
  it('lays the blurred image wash onto the floor along the photo yaw', () => {
    const layout = createPhotoReflectionLayout({
      position: { x: -3.1, y: 0.2, z: -4.5 },
      yaw: 0.72,
      width: 2.15,
      height: 2.15,
      scale: 1.35,
      floorY: -2.35,
    })

    expect(layout.position[0]).toBeCloseTo(-2.2869, 3)
    expect(layout.position[1]).toBeCloseTo(-2.34, 3)
    expect(layout.position[2]).toBeCloseTo(-3.5724, 3)
    expect(layout.yaw).toBe(0.72)
    expect(layout.scale).toBe(1.35)
    expect(layout.size[0]).toBeCloseTo(2.15, 4)
    expect(layout.size[1]).toBeCloseTo(1.8275, 4)
    expect(layout.footprintSize[0]).toBeGreaterThan(layout.size[0])
    expect(layout.footprintSize[1]).toBeGreaterThan(layout.size[1])
  })

  it('keeps both reflection planes horizontal through wall yaw and first-photo intro transforms', () => {
    const cases = [
      { yaw: 0.72, scale: 1.35, position: { x: -3.1, y: 0.2, z: -14.5 } },
      { yaw: -0.72, scale: 1.35, position: { x: 3.1, y: 0.2, z: -14.5 } },
      { yaw: 0.065, scale: 1.18, position: { x: -0.8, y: 0.15, z: -4.2 } },
    ]
    for (const { yaw, scale, position } of cases) {
      const layout = createPhotoReflectionLayout({
        position,
        yaw,
        width: 3.3,
        height: 2.2,
        scale,
        floorY: -2.35,
      })
      const root = new Group()
      root.position.set(...layout.position)
      root.rotation.y = layout.yaw
      root.scale.setScalar(layout.scale)
      const planes = [
        { size: layout.size, localY: 0.006 },
        { size: layout.footprintSize, localY: 0.002 },
      ]
      for (const { size, localY } of planes) {
        const plane = new Mesh(new PlaneGeometry(...size), new MeshBasicMaterial({ side: DoubleSide }))
        plane.position.y = localY
        plane.rotation.x = PHOTO_REFLECTION_PLANE_ROTATION_X
        root.add(plane)
        root.updateMatrixWorld(true)

        const normal = new Vector3(0, 0, 1).transformDirection(plane.matrixWorld)
        expect(normal.x).toBeCloseTo(0, 5)
        expect(normal.y).toBeCloseTo(1, 5)
        expect(normal.z).toBeCloseTo(0, 5)
        for (const x of [-size[0] / 2, size[0] / 2]) {
          for (const y of [-size[1] / 2, size[1] / 2]) {
            const corner = new Vector3(x, y, 0).applyMatrix4(plane.matrixWorld)
            expect(corner.y).toBeCloseTo(-2.35 + 0.01 + localY * scale, 5)
          }
        }
        plane.geometry.dispose()
        plane.material.dispose()
      }
    }
  })

  it('creates a weak blurred material from the actual photo texture and gallery settings', () => {
    const texture = new Texture()
    const material = createPhotoReflectionMaterial(texture, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery)

    expect(material).toBeInstanceOf(ShaderMaterial)
    expect(material.uniforms.map?.value).toBe(texture)
    expect(material.uniforms.uStrength?.value).toBe(0.24)
    expect(material.uniforms.uBlur?.value).toBe(0.8)
    expect(material.fragmentShader).toContain('mix(0.04, 0.12, clamp(uBlur, 0.0, 1.0))')
    expect(material.fragmentShader).toContain('vec2 reflectedUv = vec2(vUv.x, 1.0 - vUv.y)')
    expect(material.fragmentShader).toContain('pow(clamp(vUv.y, 0.0, 1.0), 1.75)')
    expect(material.fragmentShader).toContain('max(0.0, uStrength) * 0.4')
    expect(material.fragmentShader).toContain('edgeFade(vUv) * depthFade')
    expect(material.side).toBe(DoubleSide)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)

    material.dispose()
    texture.dispose()
  })

  it('smoothly fades the reflection and footprint masks at all four edges', () => {
    for (const [u, v] of [[0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1], [0, 0], [1, 1]]) {
      expect(getReflectionUvEdgeMask(u!, v!)).toBe(0)
    }

    expect(getReflectionUvEdgeMask(0.5, 0.5)).toBe(1)
    expect(getReflectionUvEdgeMask(0.06, 0.5)).toBeCloseTo(0.5)
    expect(getReflectionUvEdgeMask(0.94, 0.5)).toBeCloseTo(0.5)
    expect(getReflectionUvEdgeMask(0.5, 0.06)).toBeCloseTo(0.5)
    expect(getReflectionUvEdgeMask(0.5, 0.94)).toBeCloseTo(0.5)
  })

  it('uses the same four-edge mask for the warm footprint material', () => {
    const texture = new Texture()
    const material = createFrameFootprintMaterial(texture)
    updateFrameFootprintMaterial(material, 0.24)

    expect(material).toBeInstanceOf(ShaderMaterial)
    expect(material.uniforms.map?.value).toBe(texture)
    expect(material.uniforms.uOpacity?.value).toBe(0.24)
    expect(material.fragmentShader).toContain('edgeFade(vUv)')
    expect(material.blending).toBe(AdditiveBlending)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)

    material.dispose()
    texture.dispose()
  })

  it('updates blur, strength, and visibility without depending on playback time', () => {
    const texture = new Texture()
    const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const material = createPhotoReflectionMaterial(texture, defaults)
    const nextSettings = { ...defaults, reflectionStrength: 0.5, reflectionBlur: 0.35 }

    updatePhotoReflectionMaterial(material, nextSettings, 0.4)

    expect(material.uniforms.uStrength?.value).toBe(0.5)
    expect(material.uniforms.uBlur?.value).toBe(0.35)
    expect(material.uniforms.uOpacity?.value).toBe(0.4)

    material.dispose()
    texture.dispose()
  })
})
