import { type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import { COPY } from '../engine/filmConfig'
import type { FilmRuntime } from '../engine/runtime'
import { GreetingOverlay } from './GreetingOverlay'
import { PrologueOverlay } from './PrologueOverlay'
import { BloomOverlay } from './BloomOverlay'
import { GalleryOverlay } from './GalleryOverlay'

interface Props { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; reducedMotion: boolean }

export function SceneOverlay({ state, dispatch, runtime, reducedMotion }: Props) {
  const { scene } = state
  if (scene === 'prologue') return <PrologueOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'bloom') return <BloomOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'identity') return null
  if (scene === 'gallery') return <GalleryOverlay paused={state.paused} />
  if (scene === 'eye') return <p className="simulation-note">Взгляд реагирует на указатель · симуляция без камеры</p>
  if (scene === 'greeting') return <GreetingOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'ending') return <section className="ending-screen" aria-labelledby="ending-title"><h1 id="ending-title">{COPY.ending}</h1><div className="ending-actions">
    <button type="button" data-testid="replay" onClick={() => dispatch({ type: 'replay' })}>Смотреть заново</button>
    <button type="button" onClick={() => dispatch({ type: 'open-gallery' })}>Открыть галерею</button>
    <button type="button" data-testid="ending-reading" onClick={() => dispatch({ type: 'open-reading' })}>Прочитать поздравление</button>
  </div></section>
  return null
}
