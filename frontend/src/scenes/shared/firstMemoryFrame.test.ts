import { describe, expect, it } from 'vitest'
import { firstMemoryFrame, firstMemoryCamera } from './firstMemoryFrame'
import { MEMORIES } from '../../engine/filmConfig'
import { filmReducer, initialFilmState } from '../../engine/film'

describe('04.7 first memory and gallery entry', () => {
  it('preserves the restored photograph at 28s, then lets the caption settle before the dolly', () => {
    expect(firstMemoryFrame(28)).toMatchObject({ scale: 1.3, rotation: [0, 0, 0], caption: 0, particles: 0 })
    expect(firstMemoryFrame(30).caption).toBe(1)
    expect(firstMemoryFrame(31).scale).toBe(1.3)
    expect(firstMemoryFrame(31).particles).toBe(0)
    expect(firstMemoryFrame(33).scale).toBeLessThan(1.3)
  })
  it('shares the final transform/camera with a direct or automatic gallery entry', () => {
    expect(firstMemoryFrame(34).scale).toBe(1)
    expect(firstMemoryFrame(34)).toEqual(firstMemoryFrame(100))
    expect(firstMemoryCamera(28)).toEqual({ x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
    expect(firstMemoryCamera(34)).toEqual(firstMemoryCamera(100))
    expect(firstMemoryCamera(33.999).z).toBeCloseTo(firstMemoryCamera(34).z, 5)
    expect(firstMemoryFrame(33.999).scale).toBeCloseTo(1, 5)
    expect(firstMemoryCamera(34, true)).toEqual(firstMemoryCamera(28))
    expect(firstMemoryFrame(34, true).rotation).toEqual([0, 0, 0])
  })
  it('offers only the real available memory and retains gallery focus, bounds, pause and exit', () => {
    expect(MEMORIES).toHaveLength(1)
    expect(MEMORIES[0]).toMatchObject({ index: 0, placeholder: false })
    let state = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'gallery' }, true)
    expect(filmReducer(state, { type: 'gallery-step', direction: 1 })).toBe(state)
    expect(filmReducer(state, { type: 'gallery-step', direction: -1 })).toBe(state)
    expect(filmReducer(state, { type: 'gallery-focus', index: 0 }).galleryIndex).toBe(0)
    state = filmReducer(state, { type: 'toggle-pause' })
    expect(state.paused).toBe(true)
    expect(filmReducer(state, { type: 'gallery-exit' }).scene).toBe('eye')
  })
})
