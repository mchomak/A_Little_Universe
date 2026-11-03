import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PerspectiveCamera } from 'three'
import { CameraDirector } from './CameraDirector'
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
