import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import type { SceneProps } from '../engine/sceneTypes'
import { COPY, createHandwritingSchedule, getPrologueFrames } from '../engine/filmConfig'
import { useSceneTimeline } from '../engine/useSceneTimeline'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, subscribeConfig } from '../systems/scene-config/config'
import './prologue.css'

export interface PrologueOverlayTimelineTargets {
  first: HTMLParagraphElement | null
  firstGlyphs: readonly HTMLElement[]
  second: HTMLParagraphElement | null
  secondGlyphs: readonly HTMLElement[]
  prompt: HTMLParagraphElement | null
}

/** Builds the visible prologue frame so the shared runtime can scrub and replay it exactly. */
// eslint-disable-next-line react-refresh/only-export-components -- exported as the public timeline test seam.
export function createPrologueOverlayTimeline(
  targets: PrologueOverlayTimelineTargets,
  frames: ReturnType<typeof getPrologueFrames>,
  rhythm: number,
  reducedMotion: boolean,
) {
  const timeline = gsap.timeline({ paused: true })
  const reveal = (target: HTMLParagraphElement | null, glyphs: readonly HTMLElement[], text: string, timeWindow: readonly [number, number]) => {
    if (!target) return
    const schedule = createHandwritingSchedule(text, timeWindow[1] - timeWindow[0], rhythm)
    if (reducedMotion) {
      timeline.set(target, { opacity: 1 }, timeWindow[0])
      timeline.set(glyphs, { opacity: 1, clipPath: 'none', filter: 'none' }, timeWindow[0])
      return
    }
    timeline.set(target, { opacity: 1 }, timeWindow[0])
    schedule.forEach((step, index) => {
      const glyph = glyphs[index]
      if (!glyph) return
      timeline.fromTo(glyph,
        { opacity: 0, clipPath: 'inset(0 100% 0 0)', filter: 'blur(1.4px)' },
        { opacity: 1, clipPath: 'inset(0 -8% 0 0)', filter: 'blur(0px)', duration: step.duration, ease: 'sine.out' },
        timeWindow[0] + step.start,
      )
    })
  }

  reveal(targets.first, targets.firstGlyphs, COPY.prologueFirst, frames.first)
  reveal(targets.second, targets.secondGlyphs, COPY.prologueSecond, frames.second)
  timeline.to([targets.first, targets.second], {
    opacity: 0,
    duration: reducedMotion ? 0 : frames.dissolve[1] - frames.dissolve[0],
    ease: reducedMotion ? 'none' : 'sine.inOut',
  }, frames.dissolve[0])
  timeline.fromTo(targets.prompt,
    { opacity: 0, y: reducedMotion ? 0 : 5 },
    { opacity: 1, y: 0, duration: reducedMotion ? 0 : 0.8, ease: 'sine.out' },
    frames.prompt - (reducedMotion ? 0 : 0.8),
  )
  return timeline
}

export interface PrologueCopyLayoutInput {
  viewport: { width: number; height: number }
  lightBounds: { top: number; bottom: number }
  firstHeight: number
  secondHeight: number
  firstPositionY: number
  gap: number
}

export interface PrologueCopyLayout {
  firstTop: number
  secondTop: number
}

/** Positions measured text blocks around the existing light without moving that light. */
// eslint-disable-next-line react-refresh/only-export-components -- exported as the public responsive-layout test seam.
export function layoutPrologueCopyBlocks(input: PrologueCopyLayoutInput): PrologueCopyLayout {
  const height = Number.isFinite(input.viewport.height) ? Math.max(0, input.viewport.height) : 0
  const firstHeight = Number.isFinite(input.firstHeight) ? Math.max(0, input.firstHeight) : 0
  const secondHeight = Number.isFinite(input.secondHeight) ? Math.max(0, input.secondHeight) : 0
  const gap = Number.isFinite(input.gap) ? Math.max(0, input.gap) : 24
  const firstCenter = height * Math.min(100, Math.max(0, input.firstPositionY)) / 100
  const preferredFirstTop = firstCenter - firstHeight / 2
  const firstTop = Math.min(preferredFirstTop, input.lightBounds.top - gap - firstHeight)
  const preferredSecondTop = height * 0.61 - secondHeight / 2
  const secondTop = Math.max(preferredSecondTop, input.lightBounds.bottom + gap)
  return { firstTop, secondTop }
}

export function PrologueOverlay({ state, runtime, reducedMotion }: SceneProps) {
  const first = useRef<HTMLParagraphElement>(null)
  const second = useRef<HTMLParagraphElement>(null)
  const prompt = useRef<HTMLParagraphElement>(null)
  const [copyLayout, setCopyLayout] = useState<PrologueCopyLayout | null>(null)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const prologue = config.scenes.prologue
  const frames = useMemo(() => getPrologueFrames(prologue), [prologue])
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === prologue.fontFamily)?.family ?? 'Marck Script'
  const viewportFontSize = formatNumber(5.3 * prologue.fontSize / DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize)
  const phrasesStyle: CSSProperties = { inset: 0 }
  const copyStyle = (top: string, transform: CSSProperties['transform']): CSSProperties => ({
    top, bottom: 'auto', left: '7%', right: '7%', transform,
    fontFamily: `"${fontFamily}"`, fontSize: `clamp(16px, ${viewportFontSize}vw, ${prologue.fontSize}px)`,
    lineHeight: prologue.lineHeight, letterSpacing: 'normal',
    textShadow: `0 0 ${Math.max(2, prologue.glow * 14)}px rgba(255, 240, 232, ${Math.min(0.55, prologue.glow * 0.18)})`,
  })

  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>('.prologue-overlay')
    const light = document.querySelector<HTMLElement>('.persistent-light[data-phase="prologue"]')
    if (!overlay || !light || !first.current || !second.current) return

    const updateLayout = () => {
      const viewport = overlay.getBoundingClientRect()
      const point = light.getBoundingClientRect()
      const firstBlock = first.current?.getBoundingClientRect()
      const secondBlock = second.current?.getBoundingClientRect()
      if (!firstBlock || !secondBlock) return
      const next = layoutPrologueCopyBlocks({
        viewport: { width: viewport.width, height: viewport.height },
        lightBounds: { top: point.top - viewport.top, bottom: point.bottom - viewport.top },
        firstHeight: firstBlock.height,
        secondHeight: secondBlock.height,
        firstPositionY: prologue.positionY,
        gap: 24,
      })
      setCopyLayout((current) => current && Math.abs(current.firstTop - next.firstTop) < 0.5 && Math.abs(current.secondTop - next.secondTop) < 0.5 ? current : next)
    }

    updateLayout()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateLayout)
    observer?.observe(overlay)
    observer?.observe(first.current)
    observer?.observe(second.current)
    observer?.observe(light)
    window.addEventListener('resize', updateLayout)
    document.fonts?.addEventListener('loadingdone', updateLayout)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateLayout)
      document.fonts?.removeEventListener('loadingdone', updateLayout)
    }
  }, [prologue.fontFamily, prologue.fontSize, prologue.lineHeight, prologue.positionY])

  const renderGlyphs = (text: string) => Array.from(text).map((glyph, index) => (
    <span key={`${index}-${glyph}`} className="prologue-glyph" data-glyph={glyph} aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'pre' }}>{glyph}</span>
  ))
  const build = useCallback(() => createPrologueOverlayTimeline({
    first: first.current,
    firstGlyphs: Array.from(first.current?.querySelectorAll<HTMLElement>('.prologue-glyph') ?? []),
    second: second.current,
    secondGlyphs: Array.from(second.current?.querySelectorAll<HTMLElement>('.prologue-glyph') ?? []),
    prompt: prompt.current,
  }, frames, prologue.handwritingRhythm, reducedMotion), [frames, prologue.handwritingRhythm, reducedMotion])
  useSceneTimeline(build, { runtime })

  const firstVisible = state.elapsed >= frames.first[1] && state.elapsed < frames.dissolve[0]
  const secondVisible = state.elapsed >= frames.second[1] && state.elapsed < frames.dissolve[0]
  const waiting = state.mode === 'waiting'

  return <section className="prologue-overlay" aria-label="Пролог">
    <div className="prologue-phrases" aria-live="polite" style={phrasesStyle}>
      <p ref={first} data-prologue-line="first" aria-label={COPY.prologueFirst} aria-hidden={!firstVisible} style={copyStyle(copyLayout ? `${copyLayout.firstTop}px` : `${prologue.positionY}%`, copyLayout ? 'none' : 'translateY(-50%)')}>
        {renderGlyphs(COPY.prologueFirst)}
      </p>
      <p ref={second} data-prologue-line="second" aria-label={COPY.prologueSecond} aria-hidden={!secondVisible} style={copyStyle(copyLayout ? `${copyLayout.secondTop}px` : 'calc(50% + 56px)', 'none')}>
        {renderGlyphs(COPY.prologueSecond)}
      </p>
    </div>
    <p ref={prompt} className="prologue-prompt" aria-hidden={!waiting}>
      Прикоснись к свету
    </p>
  </section>
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(3)))
}
