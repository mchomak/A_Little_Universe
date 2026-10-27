import { useCallback, useRef, type Dispatch } from 'react'
import { gsap } from 'gsap'
import { COPY, TIMING } from '../engine/filmConfig'
import type { FilmState, FilmAction } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { useSceneTimeline } from '../engine/useSceneTimeline'

export function GreetingOverlay({ state, dispatch, runtime, reducedMotion }: { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; reducedMotion: boolean }) {
  const title = useRef<HTMLHeadingElement>(null)
  const wish = useRef<HTMLParagraphElement>(null)
  const credits = useRef<HTMLDivElement>(null)
  const build = useCallback(() => {
    const reveal = TIMING.greeting.reveal
    const crawl = TIMING.greeting.credits
    const timeline = gsap.timeline({ paused: true })
    timeline.fromTo(title.current, { opacity: 0 }, { opacity: 1, duration: reducedMotion ? 0 : TIMING.transition }, reveal[0])
    timeline.fromTo(wish.current, { opacity: 0 }, { opacity: 1, duration: reducedMotion ? 0 : TIMING.transition }, (reveal[1] - reveal[0]) / 2)
    timeline.to([title.current, wish.current], { opacity: 0, duration: reducedMotion ? 0 : TIMING.transition }, reveal[1] - TIMING.transition)
    timeline.fromTo(credits.current, { opacity: 0, yPercent: reducedMotion ? 0 : 80 }, { opacity: 1, duration: TIMING.transition }, crawl[0])
    if (!reducedMotion) timeline.to(credits.current, { yPercent: -105, duration: crawl[1] - crawl[0], ease: 'none' }, crawl[0])
    return timeline
  }, [reducedMotion])
  useSceneTimeline(build, { runtime, reducedMotion })

  return <section className="greeting-overlay" aria-label="Поздравление">
    <div className="greeting-touch" data-testid="credits-touch" onPointerUp={(event) => { if (event.isPrimary && !state.reading) dispatch({ type: 'toggle-pause' }) }}>
      <div className="greeting-reveal"><h1 ref={title}>{COPY.greetingTitle}</h1><p ref={wish}>{COPY.greetingWish}</p></div>
      <div className={`credits-window${reducedMotion ? ' reduced-credits' : ''}`} aria-hidden={state.elapsed < TIMING.greeting.credits[0]}>
        <div className="credits-crawl" ref={credits}><h2>{COPY.letterTitle}</h2><p>{COPY.letter}</p><p>{COPY.credits}</p></div>
      </div>
    </div>
    <div className="greeting-controls"><button type="button" data-testid="open-reading" onClick={() => dispatch({ type: 'open-reading' })}>Читать без движения</button>
      {state.mode === 'waiting' ? <button type="button" data-testid="finish" onClick={() => dispatch({ type: 'finish' })}>Завершить</button> : <span className="gesture-hint">Коснись титров, чтобы {state.paused ? 'продолжить' : 'остановить'}.</span>}
    </div>
  </section>
}
