import type { Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import { COPY, MEMORIES, TIMING } from '../engine/filmConfig'
import type { FilmRuntime } from '../engine/runtime'
import { GreetingOverlay } from './GreetingOverlay'
import { PrologueOverlay } from './PrologueOverlay'

interface Props { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; reducedMotion: boolean }

function cue(time: number, interval: readonly [number, number]) { return time >= interval[0] && time < interval[1] }

export function SceneOverlay({ state, dispatch, runtime, reducedMotion }: Props) {
  const { scene, elapsed, mode } = state
  if (scene === 'prologue') return <PrologueOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'bloom') return mode === 'waiting' ? <div className="interaction-prompt"><button type="button" data-testid="interact" onClick={() => dispatch({ type: 'interact' })}>{COPY.flowerPrompt}</button></div> : null
  if (scene === 'identity') return <div className="identity-caption" aria-live="polite">
    {cue(elapsed, TIMING.identity.name) && <p className="identity-name">{COPY.name}</p>}
    {cue(elapsed, TIMING.identity.portrait) && <p>{COPY.portrait}</p>}
    {cue(elapsed, TIMING.identity.photo) && <p>{COPY.photo}</p>}
    {cue(elapsed, TIMING.identity.caption) && <p className="caption-phrase">{COPY.photoCaption}</p>}
  </div>
  if (scene === 'gallery') {
    const memory = MEMORIES[state.galleryIndex]
    if (!memory) return null
    return <section className="gallery-panel" aria-label="Галерея воспоминаний" data-testid="gallery">
      <div className="gallery-caption" aria-live="polite" aria-atomic="true"><p className="gallery-count">{state.galleryIndex + 1} / {MEMORIES.length}</p><h2>{memory.title} · placeholder</h2><p>{memory.caption}</p></div>
      <div className="gallery-controls">
        <button type="button" data-testid="gallery-prev" disabled={state.galleryIndex === 0} onClick={() => dispatch({ type: 'gallery-step', direction: -1 })}>Назад</button>
        <button type="button" data-testid="gallery-next" disabled={state.galleryIndex === MEMORIES.length - 1} onClick={() => dispatch({ type: 'gallery-step', direction: 1 })}>Вперёд</button>
        {(state.galleryIndex === MEMORIES.length - 1 || state.returnToEnding) && <button type="button" data-testid="gallery-exit" onClick={() => dispatch({ type: 'gallery-exit' })}>{state.returnToEnding ? 'Вернуться к завершению' : 'Продолжить историю'}</button>}
      </div>
      <p className="gesture-hint">Листай вверх и вниз или коснись карточки.</p>
    </section>
  }
  if (scene === 'eye') return <p className="simulation-note">Взгляд реагирует на указатель · симуляция без камеры</p>
  if (scene === 'greeting') return <GreetingOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'ending') return <section className="ending-screen" aria-labelledby="ending-title"><h1 id="ending-title">{COPY.ending}</h1><div className="ending-actions">
    <button type="button" data-testid="replay" onClick={() => dispatch({ type: 'replay' })}>Смотреть заново</button>
    <button type="button" onClick={() => dispatch({ type: 'open-gallery' })}>Открыть галерею</button>
    <button type="button" data-testid="ending-reading" onClick={() => dispatch({ type: 'open-reading' })}>Прочитать поздравление</button>
  </div></section>
  return null
}
