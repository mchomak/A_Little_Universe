import { expect, it } from 'vitest'
import { createBloomTextClock, handleBloomPointerDown, isBloomGestureReady, isBloomPrimaryClick } from './bloomGesture'
import { initialFilmState } from '../../engine/film'
import { vi } from 'vitest'

it('accepts a single primary left click across the shared island and flower target', () => {
  expect(isBloomPrimaryClick(0, true)).toBe(true)
  expect(isBloomPrimaryClick(2, true)).toBe(false)
  expect(isBloomPrimaryClick(0, false)).toBe(false)
  expect(isBloomGestureReady(2.99, 3)).toBe(false)
  expect(isBloomGestureReady(3, 3)).toBe(true)
})

it('dispatches interact once for a ready left click while bloom is waiting', () => {
  const dispatch = vi.fn()
  const stopPropagation = vi.fn()
  const handled = handleBloomPointerDown(
    { ...initialFilmState, scene: 'bloom', mode: 'waiting' },
    true,
    { button: 0, isPrimary: true, stopPropagation },
    dispatch,
  )

  expect(handled).toBe(true)
  expect(stopPropagation).toHaveBeenCalledOnce()
  expect(dispatch).toHaveBeenCalledOnce()
  expect(dispatch).toHaveBeenCalledWith({ type: 'interact' })
})

it.each([
  ['while paused', { paused: true }],
  ['while reading', { reading: true }],
  ['outside bloom', { scene: 'growth' }],
  ['after waiting', { mode: 'playing' }],
] as const)('does not dispatch interact %s', (_condition, stateOverride) => {
  const dispatch = vi.fn()
  const stopPropagation = vi.fn()
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const, ...stateOverride }

  expect(handleBloomPointerDown(state, true, { button: 0, isPrimary: true, stopPropagation }, dispatch)).toBe(false)
  expect(stopPropagation).not.toHaveBeenCalled()
  expect(dispatch).not.toHaveBeenCalled()
})

it('does not dispatch before the invitation text is ready', () => {
  const dispatch = vi.fn()
  const stopPropagation = vi.fn()
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const }

  expect(handleBloomPointerDown(state, false, { button: 0, isPrimary: true, stopPropagation }, dispatch)).toBe(false)
  expect(stopPropagation).toHaveBeenCalledOnce()
  expect(dispatch).not.toHaveBeenCalled()
})

it.each([
  ['right click', 2, true],
  ['non-primary click', 0, false],
] as const)('ignores a %s', (_condition, button, isPrimary) => {
  const dispatch = vi.fn()
  const stopPropagation = vi.fn()
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const }

  expect(handleBloomPointerDown(state, true, { button, isPrimary, stopPropagation }, dispatch)).toBe(false)
  expect(stopPropagation).not.toHaveBeenCalled()
  expect(dispatch).not.toHaveBeenCalled()
})

it('keeps waiting time continuous through the touch and preserves local seeks', () => {
  const clock = createBloomTextClock(20, 'waiting', 3)
  clock.update(23.5, 0)
  expect(clock.waitingElapsed()).toBeCloseTo(3.5)
  clock.setState('playing', 4)
  clock.update(0, 0)
  expect(clock.time()).toBeCloseTo(3.5)
  clock.update(0, 2.25)
  expect(clock.time()).toBeCloseTo(5.75)
  clock.update(0, 20.9)
  expect(clock.time()).toBeCloseTo(24.4)
})

it('restarts the gate clock on a fresh scene revision', () => {
  const clock = createBloomTextClock(12, 'waiting', 2)
  clock.update(18, 0)
  clock.setState('waiting', 3)
  expect(clock.waitingElapsed()).toBe(0)
})
