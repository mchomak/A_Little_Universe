import { afterEach, expect, it, vi } from 'vitest'
import { initialFilmState } from './film'
import { getConfig, resetConfig, updateConfig } from '../systems/scene-config/config'
import { retimeSceneElapsed } from './filmConfig'
import { subscribeFilmTimingConfig } from './filmTimingConfig'

afterEach(async () => { await resetConfig('all') })

it('retimes paused Growth using the canonical pose through edits, restore, and undo updates', async () => {
  const dispatch = vi.fn()
  const state = { ...initialFilmState, scene: 'growth' as const, mode: 'playing' as const, paused: true, elapsed: 6.2 }
  const runtimeTime = 6.4
  const unsubscribe = subscribeFilmTimingConfig({ getState: () => state, getRuntimeTime: () => runtimeTime, dispatch, enabled: true })

  try {
    const before = getConfig()
    await updateConfig({ scenes: { growth: { flowerGrowthDuration: 14 } } })
    const presetOrImported = getConfig()
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'dev-seek', time: retimeSceneElapsed('growth', runtimeTime, before, presetOrImported, 'playing') })
    expect(dispatch.mock.lastCall?.[0]).not.toEqual({ type: 'dev-seek', time: retimeSceneElapsed('growth', state.elapsed, before, presetOrImported, 'playing') })

    dispatch.mockClear()
    await updateConfig({ scenes: { growth: { flowerGrowthDuration: 4 } } })
    const restoredSnapshot = getConfig()
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'dev-seek', time: retimeSceneElapsed('growth', runtimeTime, presetOrImported, restoredSnapshot, 'playing') })

    dispatch.mockClear()
    await updateConfig({ scenes: { growth: { flowerGrowthDuration: 14 } } })
    expect(dispatch).toHaveBeenCalledTimes(1)
  } finally {
    unsubscribe()
  }
})

it('retimes an actively playing Growth scene when the fall duration changes', async () => {
  const dispatch = vi.fn()
  const state = { ...initialFilmState, scene: 'growth' as const, mode: 'playing' as const, paused: false, elapsed: 4 }
  const runtimeTime = 4.3
  const unsubscribe = subscribeFilmTimingConfig({ getState: () => state, getRuntimeTime: () => runtimeTime, dispatch, enabled: true })

  try {
    const before = getConfig()
    await updateConfig({ scenes: { growth: { seedFallDuration: 3.6 } } })
    const after = getConfig()
    const expected = retimeSceneElapsed('growth', runtimeTime, before, after, 'playing')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'dev-seek', time: expected })
    expect(expected).toBeGreaterThan(runtimeTime)
  } finally {
    unsubscribe()
  }
})

it('retimes a paused Growth scene from its frozen canonical runtime time when the fall duration changes', async () => {
  const dispatch = vi.fn()
  const state = { ...initialFilmState, scene: 'growth' as const, mode: 'playing' as const, paused: true, elapsed: 4 }
  const runtimeTime = 4.3
  const unsubscribe = subscribeFilmTimingConfig({ getState: () => state, getRuntimeTime: () => runtimeTime, dispatch, enabled: true })

  try {
    const before = getConfig()
    await updateConfig({ scenes: { growth: { seedFallDuration: 3.6 } } })
    const after = getConfig()
    const expected = retimeSceneElapsed('growth', runtimeTime, before, after, 'playing')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'dev-seek', time: expected })
    expect(expected).toBeGreaterThan(state.elapsed)
  } finally {
    unsubscribe()
  }
})

it('keeps the Bloom touch gate at time zero while retiming its configured opening', async () => {
  const dispatch = vi.fn()
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const, paused: true }
  const unsubscribe = subscribeFilmTimingConfig({ getState: () => state, getRuntimeTime: () => 5, dispatch, enabled: true })

  try {
    await updateConfig({ scenes: { bloom: { flowerBloomDuration: 12 } } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'dev-seek', time: 0 })
  } finally {
    unsubscribe()
  }
})
