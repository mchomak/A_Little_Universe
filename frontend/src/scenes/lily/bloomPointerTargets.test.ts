import { expect, it, vi } from 'vitest'

const bloomPointerHooks = vi.hoisted(() => ({ pointerHandler: vi.fn(), getElapsed: vi.fn(() => 0) }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useCallback: (callback: (...args: never[]) => unknown) => callback,
    useLayoutEffect: () => {},
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => ({ current: initial }),
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  }
})
vi.mock('@react-three/drei', () => ({ useGLTF: () => ({ scene: {}, animations: [] }) }))
vi.mock('@react-three/fiber', () => ({ useThree: (select: (state: unknown) => unknown) => select({ invalidate: vi.fn(), viewport: { dpr: 1 } }) }))
vi.mock('three/addons/utils/SkeletonUtils.js', () => ({ clone: () => ({}) }))
vi.mock('./BloomPointerContext', () => ({
  useBloomPointerHandler: () => bloomPointerHooks.pointerHandler,
  useBloomElapsedTime: () => bloomPointerHooks.getElapsed,
}))

import { initialFilmState } from '../../engine/film'
import { createFilmRuntime } from '../../engine/runtime'
import { FloatingIsland } from '../growth/FloatingIsland'
import { AnimatedLily } from './AnimatedLily'

it('connects the full flower and floating island hit targets to the shared bloom handler', () => {
  const props = {
    state: { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const },
    dispatch: vi.fn(),
    runtime: createFilmRuntime(),
    reducedMotion: false,
  }
  const lily = AnimatedLily({ ...props, dissolveUniforms: {} as Parameters<typeof AnimatedLily>[0]['dissolveUniforms'] })
  const island = FloatingIsland({
    runtime: props.runtime,
    radius: 1,
    grassDensity: 0,
    windSpeed: 1,
    reducedMotion: false,
    opacity: { current: 1 },
  })

  expect(lily.props.onPointerDown).toBe(bloomPointerHooks.pointerHandler)
  expect(island.props.onPointerDown).toBe(bloomPointerHooks.pointerHandler)
})
