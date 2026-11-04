import { HalfFloatType, LinearFilter, Mesh, MeshBasicMaterial, NoColorSpace, PerspectiveCamera, PlaneGeometry, Scene, UnsignedByteType, Vector3, Vector4, WebGLRenderTarget, WebGLRenderer } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createGalleryWaterReflectionBackplate } from './galleryBackplate'
import { createGalleryPlanarReflectionPass } from './planarReflection'

describe('gallery planar reflection target', () => {
  it('uses a 2048 standard target with a safe color-buffer fallback', () => {
    const halfFloat = createGalleryPlanarReflectionPass({ quality: 'standard', supportsFloatColorBuffer: true })
    const fallback = createGalleryPlanarReflectionPass({ quality: 'standard', supportsFloatColorBuffer: false })

    expect(halfFloat.target.width).toBe(2048)
    expect(halfFloat.target.height).toBe(2048)
    expect(halfFloat.target.texture.type).toBe(HalfFloatType)
    expect(halfFloat.target.texture.colorSpace).toBe(NoColorSpace)
    expect(halfFloat.target.texture.minFilter).toBe(LinearFilter)
    expect(halfFloat.target.texture.magFilter).toBe(LinearFilter)
    expect(halfFloat.target.depthBuffer).toBe(true)
    expect(fallback.target.texture.type).toBe(UnsignedByteType)

    const low = createGalleryPlanarReflectionPass({ quality: 'low', supportsFloatColorBuffer: false })
    expect(low.target.width).toBe(512)
    expect(low.target.height).toBe(512)

    halfFloat.dispose()
    fallback.dispose()
    low.dispose()
  })

  it('mirrors the active camera position and view direction across the floor plane', () => {
    const scene = new Scene()
    const floor = new Mesh(new PlaneGeometry(20, 20), new MeshBasicMaterial())
    floor.position.set(0, -2.35, -180)
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    scene.updateMatrixWorld(true)

    const camera = new PerspectiveCamera(48, 16 / 9, 0.1, 420)
    camera.position.set(2, 1, 8)
    camera.lookAt(new Vector3(-1, -0.4, -20))
    camera.updateMatrixWorld(true)
    const reflectedPosition = new Vector3()
    const reflectedDirection = new Vector3()
    let mirrorCamera: PerspectiveCamera | null = null
    const screenTarget = new WebGLRenderTarget(800, 600)
    let currentTarget: WebGLRenderTarget | null = screenTarget
    const viewport = new Vector4(3, 5, 800, 600)
    const scissor = new Vector4(4, 6, 700, 500)
    const renderer = {
      xr: { enabled: true },
      shadowMap: { autoUpdate: true },
      autoClear: false,
      getRenderTarget: () => currentTarget,
      setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => { currentTarget = target }),
      getViewport: (target: Vector4) => target.copy(viewport),
      setViewport: vi.fn(),
      getScissor: (target: Vector4) => target.copy(scissor),
      setScissor: vi.fn(),
      getScissorTest: () => true,
      setScissorTest: vi.fn(),
      clear: vi.fn(),
      render: vi.fn((_scene: Scene, reflectedCamera: PerspectiveCamera) => {
      mirrorCamera = reflectedCamera
      reflectedCamera.getWorldPosition(reflectedPosition)
      reflectedDirection.set(0, 0, -1).applyQuaternion(reflectedCamera.quaternion).normalize()
      }),
    } as unknown as WebGLRenderer
    const pass = createGalleryPlanarReflectionPass({ quality: 'standard', supportsFloatColorBuffer: true })

    pass.render(renderer, scene, camera, floor)

    expect(reflectedPosition.x).toBeCloseTo(camera.position.x, 5)
    expect(reflectedPosition.y).toBeCloseTo(2 * floor.position.y - camera.position.y, 5)
    expect(reflectedPosition.z).toBeCloseTo(camera.position.z, 5)
    const sourceDirection = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
    expect(reflectedDirection.x).toBeCloseTo(sourceDirection.x, 5)
    expect(reflectedDirection.y).toBeCloseTo(-sourceDirection.y, 5)
    expect(reflectedDirection.z).toBeCloseTo(sourceDirection.z, 5)
    const floorWorldPoint = new Vector3(0, -2.35, -20)
    const textureCoord = new Vector4(floorWorldPoint.x, floorWorldPoint.y, floorWorldPoint.z, 1).applyMatrix4(pass.textureMatrix)
    const screenCoord = floorWorldPoint.clone().project(mirrorCamera!)
    expect(textureCoord.x / textureCoord.w).toBeCloseTo(screenCoord.x * 0.5 + 0.5, 5)
    expect(textureCoord.y / textureCoord.w).toBeCloseTo(screenCoord.y * 0.5 + 0.5, 5)
    expect(renderer.render).toHaveBeenCalledOnce()

    pass.dispose()
    screenTarget.dispose()
    floor.geometry.dispose()
    floor.material.dispose()
  })

  it('excludes the actual gallery photo backplate from capture and restores it after a failure', () => {
    const scene = new Scene()
    const floor = new Mesh(new PlaneGeometry(20, 20), new MeshBasicMaterial())
    floor.position.y = -2.35
    floor.rotation.x = -Math.PI / 2
    const backplate = createGalleryWaterReflectionBackplate(3, 3)
    const photo = new Mesh(new PlaneGeometry(3, 3), new MeshBasicMaterial())
    scene.add(floor, backplate, photo)
    const camera = new PerspectiveCamera(48, 1, 0.1, 200)
    camera.position.set(0, 1, 6)
    camera.lookAt(0, -0.5, -20)
    camera.updateMatrixWorld(true)
    const screenTarget = new WebGLRenderTarget(640, 360)
    let currentTarget: WebGLRenderTarget | null = screenTarget
    const viewport = new Vector4(3, 5, 640, 360)
    const scissor = new Vector4(7, 9, 600, 300)
    let captureState: unknown
    const renderer = {
      xr: { enabled: true },
      shadowMap: { autoUpdate: true },
      autoClear: false,
      getRenderTarget: () => currentTarget,
      setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => { currentTarget = target }),
      getViewport: (target: Vector4) => target.copy(viewport),
      setViewport: vi.fn(),
      getScissor: (target: Vector4) => target.copy(scissor),
      setScissor: vi.fn(),
      getScissorTest: () => true,
      setScissorTest: vi.fn(),
      clear: vi.fn(),
      render: vi.fn(() => {
        captureState = { target: currentTarget, floorVisible: floor.visible, backplateVisible: backplate.visible, photoVisible: photo.visible, xr: renderer.xr.enabled, shadows: renderer.shadowMap.autoUpdate }
        throw new Error('capture failed')
      }),
    } as unknown as WebGLRenderer
    const pass = createGalleryPlanarReflectionPass({ quality: 'standard', supportsFloatColorBuffer: false })

    expect(() => pass.render(renderer, scene, camera, floor)).toThrow('capture failed')

    expect(captureState).toEqual({ target: pass.target, floorVisible: false, backplateVisible: false, photoVisible: true, xr: false, shadows: false })
    expect(floor.visible).toBe(true)
    expect(backplate.visible).toBe(true)
    expect(renderer.xr.enabled).toBe(true)
    expect(renderer.shadowMap.autoUpdate).toBe(true)
    expect(currentTarget).toBe(screenTarget)
    expect(renderer.setViewport).toHaveBeenCalledWith(expect.objectContaining({ x: 3, y: 5, z: 640, w: 360 }))
    expect(renderer.setScissor).toHaveBeenCalledWith(expect.objectContaining({ x: 7, y: 9, z: 600, w: 300 }))
    expect(renderer.setScissorTest).toHaveBeenCalledWith(true)
    expect(renderer.clear).toHaveBeenCalledOnce()

    pass.dispose()
    screenTarget.dispose()
    floor.geometry.dispose()
    floor.material.dispose()
    backplate.geometry.dispose()
    backplate.material.dispose()
  })
})
