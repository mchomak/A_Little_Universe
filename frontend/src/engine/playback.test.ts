import { describe, expect, it } from 'vitest'
import { initialPlayback, playbackReducer } from './playback'

describe('playback controls', () => {
  it('pauses and resumes without restarting the current scene', () => {
    const paused = playbackReducer(initialPlayback, { type: 'toggle-pause' })
    expect(paused).toEqual({ paused: true, revision: 0 })
    expect(playbackReducer(paused, { type: 'toggle-pause' })).toEqual(initialPlayback)
  })

  it('replay starts a fresh timeline and clears pause', () => {
    const paused = playbackReducer(initialPlayback, { type: 'toggle-pause' })
    const replayed = playbackReducer(paused, { type: 'replay' })
    expect(replayed).toEqual({ paused: false, revision: 1 })
    expect(playbackReducer(replayed, { type: 'replay' }).revision).toBe(2)
  })
})
