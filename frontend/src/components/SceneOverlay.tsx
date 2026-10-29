import { useLayoutEffect, useRef, type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import { COPY, MEMORIES, TIMING } from '../engine/filmConfig'
import type { FilmRuntime } from '../engine/runtime'
import { GreetingOverlay } from './GreetingOverlay'
import { PrologueOverlay } from './PrologueOverlay'

interface Props { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; reducedMotion: boolean }

function IdentityCaption({ runtime }: { runtime: FilmRuntime }) {
  const caption = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const render = (time: number) => {
      if (!caption.current) return
      const [start, end] = TIMING.identity.caption
      const opacity = Math.min(1, Math.max(0, (time - start) / (end - start)))
      caption.current.style.opacity = String(opacity)
      caption.current.setAttribute('aria-hidden', String(opacity === 0))
    }
    render(runtime.time)
    return runtime.subscribeFrame(render)
  }, [runtime])
  return <div ref={caption} className="identity-caption" aria-live="polite"><p className="caption-phrase">{COPY.photoCaption}</p></div>
}

export function SceneOverlay({ state, dispatch, runtime, reducedMotion }: Props) {
  const { scene, mode } = state
  if (scene === 'prologue') return <PrologueOverlay state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
  if (scene === 'bloom') return mode === 'waiting' ? <div className="interaction-prompt"><button type="button" data-testid="interact" onClick={() => dispatch({ type: 'interact' })}>{COPY.flowerPrompt}</button></div> : null
  if (scene === 'identity') return <IdentityCaption runtime={runtime} />
  if (scene === 'gallery') {
    const memory = MEMORIES[state.galleryIndex]
    if (!memory) return null
    return <>
      {state.galleryIndex === 0 && <div className="identity-caption" aria-live="polite"><p className="caption-phrase">{COPY.photoCaption}</p></div>}
      <section className="gallery-panel" aria-label="Галерея воспоминаний" data-testid="gallery">
      <div className="gallery-caption" aria-live="polite" aria-atomic="true"><p className="gallery-count">{state.galleryIndex + 1} / {MEMORIES.length}</p>{state.galleryIndex !== 0 && <><h2>{memory.title} · placeholder</h2><p>{memory.caption}</p></>}</div>
      <div className="gallery-controls">
        <button type="button" data-testid="gallery-prev" disabled={state.galleryIndex === 0} onClick={() => dispatch({ type: 'gallery-step', direction: -1 })}>Назад</button>
        <button type="button" data-testid="gallery-next" disabled={state.galleryIndex === MEMORIES.length - 1} onClick={() => dispatch({ type: 'gallery-step', direction: 1 })}>Вперёд</button>
        {(state.galleryIndex === MEMORIES.length - 1 || state.returnToEnding) && <button type="button" data-testid="gallery-exit" onClick={() => dispatch({ type: 'gallery-exit' })}>{state.returnToEnding ? 'Вернуться к завершению' : 'Продолжить историю'}</button>}
      </div>
      <p className="gesture-hint">Листай вверх и вниз или коснись карточки.</p>
      </section>
    </>
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
