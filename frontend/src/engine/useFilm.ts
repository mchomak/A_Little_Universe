import { useLayoutEffect, useReducer, useRef, useState, type Dispatch } from 'react'
import { filmReducer, initialFilmState, type FilmAction, type FilmState } from './film'
import { createFilmClock, createFilmRuntime, type FilmRuntime } from './runtime'

const reducer = (state: FilmState, action: FilmAction) => filmReducer(state, action, import.meta.env.DEV)

export function useFilm(): { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime } {
  const [state, dispatch] = useReducer(reducer, initialFilmState)
  const [runtime] = useState(createFilmRuntime)
  const clock = useRef<ReturnType<typeof createFilmClock> | null>(null)

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
