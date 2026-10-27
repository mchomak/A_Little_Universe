import { useCallback, useRef } from 'react'
import { gsap } from 'gsap'
import type { SceneProps } from '../engine/sceneTypes'
import { COPY } from '../engine/filmConfig'
import { useSceneTimeline } from '../engine/useSceneTimeline'
import './prologue.css'

export function PrologueOverlay({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const first = useRef<HTMLParagraphElement>(null)
  const second = useRef<HTMLParagraphElement>(null)
  const prompt = useRef<HTMLParagraphElement>(null)
  const build = useCallback(() => {
    const fade = reducedMotion ? 0.05 : 1.5
    return gsap.timeline({ paused: true })
      .fromTo(first.current, { opacity: 0 }, { opacity: 1, duration: fade, ease: 'sine.inOut' }, 3)
      .to(first.current, { opacity: 0, duration: reducedMotion ? 0.05 : 0.7, ease: 'sine.inOut' }, 7.3)
      .fromTo(second.current, { opacity: 0 }, { opacity: 1, duration: reducedMotion ? 0.05 : 1.3, ease: 'sine.inOut' }, 8.7)
      .to(second.current, { opacity: 0, duration: reducedMotion ? 0.05 : 1, ease: 'sine.inOut' }, 14)
      .fromTo(prompt.current, { opacity: 0 }, { opacity: 1, duration: reducedMotion ? 0.05 : 1, ease: 'sine.inOut' }, 15)
  }, [reducedMotion])
  useSceneTimeline(build, { runtime })
  const waiting = state.mode === 'waiting'
  const activate = () => { if (waiting && !state.paused) dispatch({ type: 'interact' }) }
  return <section className="prologue-overlay" aria-label="Пролог">
    <div className="prologue-phrases" aria-live="polite">
      <p ref={first} aria-hidden={state.elapsed < 3 || state.elapsed >= 8}>{COPY.prologueFirst}</p>
      <p ref={second} aria-hidden={state.elapsed < 8.7 || state.elapsed >= 15}>{COPY.prologueSecond}</p>
    </div>
    {waiting && <button type="button" className="prologue-light-target" aria-label="Прикоснись к свету" data-testid="interact" disabled={state.paused} onClick={activate} />}
    <p ref={prompt} className="prologue-prompt" aria-hidden={!waiting} style={{ visibility: state.mode === 'transitioning' ? 'hidden' : undefined }}>Прикоснись к свету</p>
  </section>
}
