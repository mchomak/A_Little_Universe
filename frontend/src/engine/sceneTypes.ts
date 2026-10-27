import type { Dispatch } from 'react'
import type { FilmAction, FilmState } from './film'
import type { FilmRuntime } from './runtime'

export interface SceneProps {
  state: FilmState
  dispatch: Dispatch<FilmAction>
  runtime: FilmRuntime
  reducedMotion: boolean
}
