import { describe, it, expect } from 'vitest'
import { createFilmClock, createFilmRuntime } from '../engine/runtime'
import { filmReducer, initialFilmState, type FilmAction, type FilmState } from '../engine/film'
import { createLoopListener, validLoop } from './timelinePlayback'
import { getConfig, updateConfig } from '../systems/scene-config/config'
import { subscribeFilmGlobals } from '../engine/filmGlobals'

describe('timeline loop', () => {
  it('accepts only finite nonempty ranges within a timed scene', () => {
    expect(validLoop(0, 21, 21)).toBe(true)
    expect(validLoop(10, 10, 21)).toBe(false)
    expect(validLoop(10, 10.01, 21)).toBe(false)
    expect(validLoop(-1, 5, 21)).toBe(false)
    expect(validLoop(0, 22, 21)).toBe(false)
    expect(validLoop(0, NaN, 21)).toBe(false)
  })
  it('preserves the selected speed across replay', () => {
    const state = filmReducer({ ...initialFilmState, speed: 0.5, quality: 'low' }, { type: 'replay' })
    expect(state.speed).toBe(0.5)
    expect(state.quality).toBe('low')
  })
  it('synchronizes changed global speed without resetting an independently selected quality', async () => {
    const before = getConfig()
    const actions: FilmAction[] = []
    const stop = subscribeFilmGlobals(before.global, action => actions.push(action))
    try {
      await updateConfig({ global: { playbackSpeed: 0.5 } })
      expect(actions).toEqual([{ type: 'set-speed', speed: 0.5 }])
      await updateConfig({ scenes: { prologue: { glow: 0.9 } } })
      expect(actions).toHaveLength(1)
    } finally {
      stop()
      await updateConfig({ global: before.global, scenes: { prologue: before.scenes.prologue } })
    }
  })
  it('seeks once at a boundary before completion and the stale completion cannot advance the scene', () => {
    const runtime = createFilmRuntime()
    let state: FilmState = { ...initialFilmState, mode: 'playing', revision: 1 }
    const actions: FilmAction[] = []
    const off = runtime.subscribeFrame(createLoopListener({ start: 3, end: 18 }, action => actions.push(action)))
    const clock = createFilmClock({ state, runtime, dispatch: action => actions.push(action) })
    clock.timeline.time(18)
    expect(actions.map(action => action.type)).toEqual(['dev-seek', 'timeline-update', 'timeline-update', 'timeline-complete'])
    for (const action of actions) state = filmReducer(state, action, true)
    expect(state.scene).toBe('prologue')
    expect(state.mode).toBe('playing')
    expect(state.elapsed).toBe(3)
    runtime.publish(18)
    expect(actions.filter(action => action.type === 'dev-seek')).toHaveLength(1)
    runtime.publish(3)
    runtime.publish(18)
    expect(actions.filter(action => action.type === 'dev-seek')).toHaveLength(2)
    off(); clock.dispose()
  })
})

