import { expect, it, vi } from 'vitest'
import { Group, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { createBackgroundStarsMaterial, createBlackCenterMaterial, faceBlackCenterToCamera, GALAXY_RENDER_ORDER } from './rendering'
import { deferGalaxyCloudDisposal } from './resourceLifecycle'

it('draws the optional black center after star points without depth-based star occlusion', () => {
  const material = createBlackCenterMaterial()
  try {
    expect(GALAXY_RENDER_ORDER.blackCenter).toBeGreaterThan(GALAXY_RENDER_ORDER.starPoints)
    expect(material.color.getHex()).toBe(0x000000)
    expect(material.transparent).toBe(true)
    expect(material.opacity).toBe(1)
    expect(material.depthTest).toBe(false)
    expect(material.depthWrite).toBe(false)
  } finally {
    material.dispose()
  }
})

it('keeps the black center circular by matching the active camera orientation', () => {
  const disc = new Object3D()
  const camera = new PerspectiveCamera()
  camera.position.set(0, 11, 11)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  faceBlackCenterToCamera(disc, camera)

  const discNormal = new Vector3(0, 0, 1).applyQuaternion(disc.quaternion)
  const cameraDirection = camera.getWorldDirection(new Vector3())
  expect(discNormal.dot(cameraDirection)).toBeCloseTo(-1, 6)
  expect(disc.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6)
})

it('keeps the black center facing the camera when its galaxy parent rotates', () => {
  const galaxy = new Group()
  galaxy.rotation.set(0.18, 0.62, -0.21)
  const disc = new Object3D()
  galaxy.add(disc)
  const camera = new PerspectiveCamera()
  camera.position.set(4, 3, 7)
  camera.lookAt(0, 0, 0)
  galaxy.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)

  faceBlackCenterToCamera(disc, camera)
  galaxy.updateMatrixWorld(true)

  const discWorldNormal = new Vector3(0, 0, 1).applyQuaternion(disc.getWorldQuaternion(new Quaternion()))
  const cameraDirection = camera.getWorldDirection(new Vector3())
  expect(discWorldNormal.dot(cameraDirection)).toBeCloseTo(-1, 6)
})

it('lets the background brightness setting control the full star opacity', () => {
  const material = createBackgroundStarsMaterial()
  try {
    expect(material.transparent).toBe(true)
    expect(material.opacity).toBe(1)
    expect(material.sizeAttenuation).toBe(false)
    expect(material.depthWrite).toBe(false)
  } finally {
    material.dispose()
  }
})

it('keeps memoized nebula clouds alive through StrictMode effect replay', async () => {
  const mounted = new WeakSet<object>()
  const cloud = { dispose: vi.fn() }

  mounted.add(cloud)
  deferGalaxyCloudDisposal(cloud, mounted)
  mounted.add(cloud)
  await Promise.resolve()
  expect(cloud.dispose).not.toHaveBeenCalled()

  deferGalaxyCloudDisposal(cloud, mounted)
  await Promise.resolve()
  expect(cloud.dispose).toHaveBeenCalledOnce()
})
