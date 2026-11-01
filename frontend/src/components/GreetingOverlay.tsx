import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch } from 'react'
import { getCreditsScrollDuration, getGreetingFrames } from '../engine/filmConfig'
import type { FilmAction, FilmState } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { useSceneTimeline } from '../engine/useSceneTimeline'
import { createPrologueOverlayTimeline } from './PrologueOverlay'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { GREETING_LETTER } from '../scenes/greeting/content'
import { createCreditsCrawlTween } from './creditsCrawl'

interface Props { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; reducedMotion: boolean }

export function GreetingOverlay({ state, dispatch, runtime, reducedMotion }: Props) {
  const first = useRef<HTMLParagraphElement>(null)
  const second = useRef<HTMLParagraphElement>(null)
  const section = useRef<HTMLElement>(null)
  const crawl = useRef<HTMLDivElement>(null)
  const crawlTween = useRef<ReturnType<typeof createCreditsCrawlTween> | null>(null)
  const geometry = useRef({ startY: 0, distance: 1 })
  const paused = useRef(false)
  const completed = useRef(false)
  const [crawlStarted, setCrawlStarted] = useState(false)
  const [crawlPaused, setCrawlPaused] = useState(false)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const prologue = config.scenes.prologue
  const frames = useMemo(() => getGreetingFrames(prologue), [prologue])
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === prologue.fontFamily)?.family ?? 'Great Vibes'

  const build = useCallback(() => {
    return createPrologueOverlayTimeline({ first: state.returnToEnding ? null : first.current, second: state.returnToEnding ? null : second.current, prompt: null }, frames, prologue, reducedMotion)
  }, [frames, prologue, reducedMotion, state.returnToEnding])
  useSceneTimeline(build, { runtime, reducedMotion })

  const renderProgress = useCallback((value: number) => {
    const element = crawl.current
    if (!element) return
    const { startY, distance } = geometry.current
    element.style.transform = `translate3d(-50%, ${startY - distance * value}px, 0)`
  }, [])

  const measureCrawl = useCallback(() => {
    const element = crawl.current
    const viewport = section.current
    if (!element || !viewport) return
    const viewportHeight = viewport.getBoundingClientRect().height
    const contentHeight = element.getBoundingClientRect().height
    geometry.current = { startY: viewportHeight + 24, distance: viewportHeight + contentHeight + 48 }
    crawlTween.current?.resize(getCreditsScrollDuration(contentHeight, viewportHeight))
    if (!crawlTween.current) renderProgress(0)
  }, [renderProgress])

  const startCrawl = useCallback((time: number) => {
    if (crawlTween.current || completed.current) return
    measureCrawl()
    const viewportHeight = section.current?.getBoundingClientRect().height ?? 0
    const contentHeight = crawl.current?.getBoundingClientRect().height ?? 0
    const startAt = state.returnToEnding ? 0 : frames.credits[0]
    const duration = getCreditsScrollDuration(contentHeight, viewportHeight)
    crawlTween.current = createCreditsCrawlTween({
      time,
      startAt,
      duration,
      playbackSpeed: state.speed,
      onProgress: renderProgress,
      onComplete: () => {
        if (completed.current) return
        completed.current = true
        dispatch({ type: 'greeting-complete' })
      },
    })
    setCrawlStarted(true)
  }, [dispatch, frames.credits, measureCrawl, renderProgress, state.returnToEnding, state.speed])

  useLayoutEffect(() => {
    const startAt = state.returnToEnding ? 0 : frames.credits[0]
    let started = false
    const check = (time: number) => {
      if (!started && time >= startAt) { started = true; startCrawl(time) }
    }
    check(state.elapsed)
    const unsubscribe = runtime.subscribeFrame(check)
    return unsubscribe
  }, [frames.credits, runtime, startCrawl, state.elapsed, state.returnToEnding])

  useLayoutEffect(() => {
    window.dispatchEvent(new Event('greeting-layout'))
  }, [frames, fontFamily, state.returnToEnding])

  useLayoutEffect(() => () => {
    crawlTween.current?.dispose()
    crawlTween.current = null
  }, [])

  useLayoutEffect(() => {
    if (!crawlStarted) return
    measureCrawl()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measureCrawl)
    if (section.current) observer?.observe(section.current)
    if (crawl.current) observer?.observe(crawl.current)
    window.addEventListener('resize', measureCrawl)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measureCrawl) }
  }, [crawlStarted, measureCrawl])

  useLayoutEffect(() => { crawlTween.current?.setSpeed(state.speed) }, [state.speed])
  useLayoutEffect(() => {
    const onVisibility = () => {
      if (document.hidden) crawlTween.current?.pause()
      else if (!paused.current) crawlTween.current?.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const toggleCrawl = () => {
    const nextPaused = !paused.current
    paused.current = nextPaused
    setCrawlPaused(nextPaused)
    if (nextPaused) crawlTween.current?.pause()
    else crawlTween.current?.resume()
  }

  const lineStyle = (top: string, size: string) => ({
    top, bottom: 'auto', fontFamily: `"${fontFamily}"`, fontSize: size,
    lineHeight: 1.22, textShadow: `0 1px 14px rgba(10, 8, 24, ${reducedMotion ? 0.72 : 0.58})`,
  })

  return <section ref={section} className="greeting-overlay prologue-overlay" aria-label="Поздравление">
    {!state.returnToEnding && <div className="prologue-phrases greeting-phrases" aria-live="polite">
      <p ref={first} data-greeting-line="first" aria-label="С днём рождения, Василиса!" style={lineStyle('24%', 'clamp(30px, 5.1vw, 66px)')}>С днём рождения, Василиса!</p>
      <p ref={second} data-greeting-line="second" aria-label="Пусть в твоей жизни всегда будет место для маленького чуда." style={lineStyle('42%', 'clamp(22px, 3.4vw, 43px)')}>Пусть в твоей жизни всегда будет место для маленького чуда.</p>
    </div>}
    <div className="credits-window" aria-hidden={!crawlStarted}>
      <div ref={crawl} className="credits-crawl" data-testid="credits-crawl">
        {GREETING_LETTER.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <p className="credits-attribution">Lily: “White lily” by Nmn9 · Blend Swap #74582 · CC BY 3.0 · modified for A Little Universe for You.</p>
      </div>
    </div>
    {crawlStarted && <div className="greeting-controls"><button type="button" data-testid="credits-pause" aria-pressed={crawlPaused} onClick={toggleCrawl}>{crawlPaused ? 'Продолжить письмо' : 'Пауза письма'}</button></div>}
  </section>
}
