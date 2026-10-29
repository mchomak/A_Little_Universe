import { useLayoutEffect } from 'react'
import type { FilmState } from '../../engine/film'
import type { FilmRuntime } from '../../engine/runtime'
import { AudioDirector } from './AudioDirector'
import { getPrologueFrames } from '../../engine/filmConfig'
import { getConfig } from '../scene-config/config'
import { getPrologueAudioCues } from './prologueCues'

/** Audio follows the film clock; it never creates a scene timer or requests permissions. */
export function useAudioDirector(director: AudioDirector, state: FilmState, runtime: FilmRuntime) {
  useLayoutEffect(() => {
    const sync = () => {
      director.setSpeed(state.speed)
      if (state.paused || state.reading || document.hidden || state.mode === 'ready') director.pause()
      else director.resume()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [director, state.paused, state.reading, state.speed, state.mode])

  useLayoutEffect(() => {
    director.stop()
    if (state.scene === 'prologue' && state.mode === 'transitioning') director.cue('prologue-touch')
    if (state.scene === 'growth' && state.elapsed === 0) director.cue('growth')
    let previous = state.elapsed === 0 ? -0.001 : runtime.time
    const onFrame = (time: number) => {
      if (state.scene === 'prologue' && state.mode === 'playing') {
        for (const slot of getPrologueAudioCues(getPrologueFrames(getConfig().scenes.prologue))) {
          if (previous < slot.time && time >= slot.time) director.cue(slot.cue)
        }
      }
      previous = time
    }
    onFrame(runtime.time)
    const unsubscribe = runtime.subscribeFrame(onFrame)
    return () => { unsubscribe(); director.stop() }
    // Revision changes own cue cancellation; frame updates must not replay cues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, runtime, state.revision])
}

