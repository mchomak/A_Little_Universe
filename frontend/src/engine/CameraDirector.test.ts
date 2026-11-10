import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PerspectiveCamera } from 'three'
import { CameraDirector } from './CameraDirector'
import { createCameraPoseRestorer } from './cameraPoseContinuity'
import { initialFilmState } from './film'
import { createFilmRuntime } from './runtime'

const mocks = vi.hoisted(() => ({ state: { camera: null as unknown, size: { width: 1200, height: 900 }, invalidate: () => {} } }))
vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
  useFrame: () => {},
}))
vi.mock('./useSceneTimeline', () => ({ useSceneTimeline: (build: () => unknown) => { build() } }))

beforeEach(() => { mocks.state.camera = new PerspectiveCamera() })

it('keeps the camera position through reduced-motion growth to bloom without changing the identity framing', () => {
  const camera = mocks.state.camera as PerspectiveCamera
  const runtime = createFilmRuntime()
  const renderScene = (scene: 'growth' | 'bloom' | 'identity') => {
    renderToString(createElement(CameraDirector, { state: { ...initialFilmState, scene }, dispatch: () => {}, runtime, reducedMotion: true }))
    return camera.position.clone()
  }
  const growth = renderScene('growth')
  const bloom = renderScene('bloom')
  expect(bloom.toArray()).toEqual(growth.toArray())
  expect(bloom.toArray()).toEqual([0, -0.2, 7.8])
  expect(renderScene('identity').toArray()).toEqual([0, 0, 5.6])
})

it('keeps the settled galaxy framing through greeting and ending with reduced motion', () => {
  const camera = mocks.state.camera as PerspectiveCamera
  const runtime = createFilmRuntime()
  const renderScene = (scene: 'cosmos' | 'greeting' | 'ending') => {
    renderToString(createElement(CameraDirector, {
      state: { ...initialFilmState, scene }, dispatch: () => {}, runtime, reducedMotion: true,
    }))
    return camera.position.clone()
  }

  const galaxy = renderScene('cosmos')
  expect(renderScene('greeting').toArray()).toEqual(galaxy.toArray())
  expect(renderScene('ending').toArray()).toEqual(galaxy.toArray())
})

it('restores the rendered camera position and field of view after a timeline revert', () => {
  const camera = mocks.state.camera as PerspectiveCamera
  const pose = { x: 2, y: 1, z: 12, tx: 0, ty: 0.2, tz: 0 }
  camera.position.set(pose.x, pose.y, pose.z)
  camera.lookAt(pose.tx, pose.ty, pose.tz)
  camera.fov = 38
  camera.updateProjectionMatrix()
  const expectedPosition = camera.position.clone()
  const expectedRotation = camera.quaternion.clone()
  const restore = createCameraPoseRestorer(pose, camera, (fovOverride) => {
    camera.position.set(pose.x, pose.y, pose.z)
    camera.lookAt(pose.tx, pose.ty, pose.tz)
    if (fovOverride !== undefined) {
      camera.fov = fovOverride
      camera.updateProjectionMatrix()
    }
  })

  Object.assign(pose, { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
  camera.position.set(0, 0, 5.6)
  camera.lookAt(0, 0, 0)
  camera.fov = 55
  camera.updateProjectionMatrix()
  restore()

  expect(camera.position.toArray()).toEqual(expectedPosition.toArray())
  expect(camera.quaternion.toArray()).toEqual(expectedRotation.toArray())
  expect(camera.fov).toBe(38)
})
