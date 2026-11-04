import {
  Camera,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NoColorSpace,
  Plane,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'

export type GalleryReflectionQuality = 'low' | 'standard'
export const GALLERY_WATER_REFLECTION_EXCLUDED = 'galleryWaterReflectionExcluded'

export interface GalleryPlanarReflectionPass {
  readonly target: WebGLRenderTarget
  readonly textureMatrix: Matrix4
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, reflector: Mesh): void
  dispose(): void
}

export function createGalleryPlanarReflectionPass(options: {
  quality: GalleryReflectionQuality
  supportsFloatColorBuffer: boolean
}): GalleryPlanarReflectionPass {
  // The reflected gallery covers a large share of the image on desktop. Keep
  // the full-size target for the M2 presentation profile; low quality remains
  // available as an explicit fallback for constrained devices.
  const resolution = options.quality === 'low' ? 512 : 2048
  const target = new WebGLRenderTarget(resolution, resolution, {
    format: RGBAFormat,
    type: options.supportsFloatColorBuffer ? HalfFloatType : UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  })
  target.texture.colorSpace = NoColorSpace
  target.texture.generateMipmaps = false
  const mirrorCamera = new PerspectiveCamera()
  const mirrorPlane = new Plane()
  const normal = new Vector3()
  const reflectorPosition = new Vector3()
  const cameraPosition = new Vector3()
  const rotation = new Matrix4()
  const lookAtPosition = new Vector3()
  const targetPosition = new Vector3()
  const view = new Vector3()
  const clipPlane = new Vector4()
  const q = new Vector4()
  const textureMatrix = new Matrix4()
  let rendering = false

  const updateMirrorCamera = (camera: Camera, reflector: Mesh) => {
    reflector.updateWorldMatrix(true, false)
    camera.updateWorldMatrix(true, false)
    reflectorPosition.setFromMatrixPosition(reflector.matrixWorld)
    cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    rotation.extractRotation(reflector.matrixWorld)
    normal.set(0, 0, 1).applyMatrix4(rotation).normalize()
    view.subVectors(reflectorPosition, cameraPosition)
    if (view.dot(normal) > 0) return false

    view.reflect(normal).negate().add(reflectorPosition)
    rotation.extractRotation(camera.matrixWorld)
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotation).add(cameraPosition)
    targetPosition.subVectors(reflectorPosition, lookAtPosition).reflect(normal).negate().add(reflectorPosition)
    mirrorCamera.position.copy(view)
    mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal).normalize()
    mirrorCamera.lookAt(targetPosition)
    const cameraClipRange = camera as Camera & { near?: number; far?: number }
    if (cameraClipRange.near !== undefined) mirrorCamera.near = cameraClipRange.near
    if (cameraClipRange.far !== undefined) mirrorCamera.far = cameraClipRange.far
    mirrorCamera.layers.mask = camera.layers.mask
    mirrorCamera.updateMatrixWorld(true)
    mirrorCamera.projectionMatrix.copy(camera.projectionMatrix)
    mirrorCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse)

    textureMatrix.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    )
    textureMatrix.multiply(mirrorCamera.projectionMatrix)
    textureMatrix.multiply(mirrorCamera.matrixWorldInverse)

    mirrorPlane.setFromNormalAndCoplanarPoint(normal, reflectorPosition)
    mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse)
    clipPlane.set(mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant)
    const projection = mirrorCamera.projectionMatrix
    q.x = (Math.sign(clipPlane.x) + projection.elements[8]!) / projection.elements[0]!
    q.y = (Math.sign(clipPlane.y) + projection.elements[9]!) / projection.elements[5]!
    q.z = -1
    q.w = (1 + projection.elements[10]!) / projection.elements[14]!
    const planeDot = clipPlane.dot(q)
    if (!Number.isFinite(planeDot) || Math.abs(planeDot) < 1e-6) return false
    clipPlane.multiplyScalar(2 / planeDot)
    projection.elements[2] = clipPlane.x
    projection.elements[6] = clipPlane.y
    projection.elements[10] = clipPlane.z + 1 - 0.003
    projection.elements[14] = clipPlane.w
    mirrorCamera.projectionMatrixInverse.copy(projection).invert()
    return true
  }

  return {
    target,
    textureMatrix,
    render: (renderer, scene, camera, reflector) => {
      if (rendering || !updateMirrorCamera(camera, reflector)) return

      const previousRenderTarget = renderer.getRenderTarget()
      const previousViewport = renderer.getViewport(new Vector4())
      const previousScissor = renderer.getScissor(new Vector4())
      const previousScissorTest = renderer.getScissorTest()
      const previousXrEnabled = renderer.xr.enabled
      const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate
      const previousVisibility = reflector.visible
      const excludedObjects: { object: Scene['children'][number]; visible: boolean }[] = []

      rendering = true
      try {
        reflector.visible = false
        scene.traverse((object) => {
          if (!object.userData[GALLERY_WATER_REFLECTION_EXCLUDED]) return
          excludedObjects.push({ object, visible: object.visible })
          object.visible = false
        })
        renderer.xr.enabled = false
        renderer.shadowMap.autoUpdate = false
        renderer.setRenderTarget(target)
        if (!renderer.autoClear) renderer.clear()
        renderer.render(scene, mirrorCamera)
      } finally {
        reflector.visible = previousVisibility
        excludedObjects.forEach(({ object, visible }) => { object.visible = visible })
        renderer.xr.enabled = previousXrEnabled
        renderer.shadowMap.autoUpdate = previousShadowAutoUpdate
        rendering = false
        try {
          renderer.setRenderTarget(previousRenderTarget)
        } finally {
          renderer.setViewport(previousViewport)
          renderer.setScissor(previousScissor)
          renderer.setScissorTest(previousScissorTest)
        }
      }
    },
    dispose: () => target.dispose(),
  }
}
