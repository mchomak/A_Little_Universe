import { useLayoutEffect, useReducer, useRef, useState, type Dispatch } from 'react'
import { filmReducer, initialFilmState, type FilmAction, type FilmState } from './film'
import { createFilmClock, createFilmRuntime, type FilmRuntime } from './runtime'
import { getConfig } from '../systems/scene-config/config'
import { subscribeFilmTimingConfig } from './filmTimingConfig'
import { subscribeFilmGlobals } from './filmGlobals'

const reducer = (state: FilmState, action: FilmAction) => filmReducer(state, action, import.meta.env.DEV)

export function useFilm(): { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime } {
  const [initialGlobals] = useState(() => getConfig().global)
  const [state, dispatch] = useReducer(reducer, { ...initialFilmState, speed: initialGlobals.playbackSpeed, quality: initialGlobals.quality })
  const [runtime] = useState(createFilmRuntime)
  const clock = useRef<ReturnType<typeof createFilmClock> | null>(null)
  const currentState = useRef(state)

  useLayoutEffect(() => subscribeFilmGlobals(initialGlobals, dispatch), [initialGlobals])
  useLayoutEffect(() => { currentState.current = state }, [state])

  useLayoutEffect(() => subscribeFilmTimingConfig({
    getState: () => currentState.current,
    getRuntimeTime: () => runtime.time,
    dispatch,
    enabled: import.meta.env.DEV,
  }), [dispatch, runtime])

  // Seek/replay/scene changes discard old callbacks at the revision boundary.
  useLayoutEffect(() => {
    const instance = createFilmClock({ state, dispatch, runtime, visibility: document })
    clock.current = instance
    return () => {
      instance.dispose()
      clock.current = null
    }
    // Other state is synchronized below without recreating the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.revision, runtime])

  useLayoutEffect(() => { clock.current?.sync(state) }, [state])
  return { state, dispatch, runtime }
}
