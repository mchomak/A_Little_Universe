import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import type { SceneProps } from '../engine/sceneTypes'
import { COPY, getPrologueCopy, getPrologueFrames } from '../engine/filmConfig'
import { useSceneTimeline } from '../engine/useSceneTimeline'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, subscribeConfig, type SceneComposerConfig } from '../systems/scene-config/config'
import './prologue.css'

export interface PrologueOverlayTimelineTargets {
  first: HTMLParagraphElement | null
  second: HTMLParagraphElement | null
  prompt: HTMLParagraphElement | null
}

/** Builds the visible prologue frame so the shared runtime can scrub and replay it exactly. */
// eslint-disable-next-line react-refresh/only-export-components -- exported as the public timeline test seam.
export function createPrologueOverlayTimeline(
  targets: PrologueOverlayTimelineTargets,
  frames: ReturnType<typeof getPrologueFrames>,
  settings: SceneComposerConfig['scenes']['prologue'],
  reducedMotion: boolean,
) {
  const timeline = gsap.timeline({ paused: true })
  const fractureFronts: { target: HTMLParagraphElement; start: number; duration: number }[] = []
  const reveal = (target: HTMLParagraphElement | null, timeWindow: readonly [number, number]) => {
    if (!target) return
    target.style.setProperty('--write-progress', '0%')
    target.style.setProperty('--fracture-progress', '0%')
    target.style.setProperty('--fracture-clip', 'none')
    timeline.set(target, { opacity: 0 }, 0)
    if (reducedMotion) {
      timeline.set(target, { opacity: 1 }, timeWindow[0])
      timeline.call(() => target.style.setProperty('--write-progress', '104%'), [], timeWindow[0])
      return
    }
    timeline.set(target, { opacity: 1 }, timeWindow[0])
    const write = { progress: 0 }
    timeline.fromTo(write, { progress: 0 }, {
      progress: 104,
      duration: timeWindow[1] - timeWindow[0],
      ease: 'sine.inOut',
      onUpdate: () => target.style.setProperty('--write-progress', `${write.progress}%`),
      immediateRender: false,
    }, timeWindow[0])
  }

  const fracture = (target: HTMLParagraphElement | null) => {
    if (!target) return
    if (reducedMotion) {
      timeline.to(target, { opacity: 0, duration: 0.7, ease: 'sine.inOut' }, frames.dissolve[0])
      return
    }
    const duration = Math.min(settings.fractureDuration, frames.dissolve[1] - frames.dissolve[0])
    fractureFronts.push({ target, start: frames.dissolve[0], duration })
    // DOM is the accessible fallback/layout guide. The GPU ink layer owns actual erosion.
    timeline.to(target, { opacity: 0, duration, ease: 'sine.inOut' }, frames.dissolve[0])
  }

  reveal(targets.first, frames.first)
  reveal(targets.second, frames.second)
  fracture(targets.first)
  fracture(targets.second)
  timeline.eventCallback('onUpdate', () => {
    const time = timeline.time()
    fractureFronts.forEach(({ target, start, duration }) => {
      const progress = time < start ? 0 : duration <= 0 ? 1 : Math.min(1, (time - start) / duration)
      target.style.setProperty('--fracture-progress', `${progress * 100}%`)
    })
  })

  if (targets.prompt) {
    const promptStart = frames.dissolve[1]
    targets.prompt.style.setProperty('--write-progress', '0%')
    targets.prompt.style.setProperty('--fracture-clip', 'none')
    timeline.set(targets.prompt, { opacity: 0 }, 0)
    timeline.to(targets.prompt, { opacity: 1, duration: reducedMotion ? 0.5 : 0.9, ease: 'sine.inOut' }, promptStart)
    if (reducedMotion) {
      timeline.call(() => targets.prompt?.style.setProperty('--write-progress', '104%'), [], promptStart)
    } else {
      const promptWrite = { progress: 0 }
      timeline.fromTo(promptWrite, { progress: 0 }, {
        progress: 104,
        duration: settings.promptHandwritingDuration,
        ease: 'sine.inOut',
        onUpdate: () => targets.prompt?.style.setProperty('--write-progress', `${promptWrite.progress}%`),
        immediateRender: false,
      }, promptStart)
    }
  }
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
  const copy = getPrologueCopy(prologue)
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === prologue.fontFamily)?.family ?? 'Marck Script'
  const promptFontFamily = ART_FONT_CATALOG.find((font) => font.id === 'marck-script')?.family ?? 'Marck Script'
  const viewportFontSize = formatNumber(5.3 * prologue.fontSize / DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize)
  const phrasesStyle: CSSProperties = { inset: 0 }
  const copyStyle = (top: string, transform: CSSProperties['transform'], scale = 1): CSSProperties => ({
    top, bottom: 'auto', left: '7%', right: '7%', transform,
    fontFamily: `"${fontFamily}"`, fontSize: `clamp(16px, ${formatNumber(Number(viewportFontSize) * scale)}vw, ${formatNumber(prologue.fontSize * scale)}px)`,
    lineHeight: prologue.lineHeight, letterSpacing: 'normal',
    textShadow: `0 0 ${Math.max(2, prologue.textGlow * 14)}px rgba(255, 240, 232, ${Math.min(0.55, prologue.textGlow * 0.18)})`,
    '--write-progress': '0%', '--fracture-progress': '0%', '--fracture-clip': 'none',
  } as CSSProperties)
  const promptStyle: CSSProperties = {
    fontFamily: `"${promptFontFamily}"`, fontSize: 'clamp(18px, 2.4vw, 32px)',
    textShadow: `0 0 ${Math.max(2, prologue.glow * 12)}px rgba(255, 240, 232, ${Math.min(0.5, prologue.glow * 0.16)})`,
    '--write-progress': '0%', '--fracture-clip': 'none',
    top: `calc(50% + ${Math.max(54, prologue.innerGlowRadius + prologue.textGap + 10)}px)`,
  } as CSSProperties
  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>('.prologue-overlay')
    if (!overlay || !first.current || !second.current) return

    const updateLayout = () => {
      const viewport = overlay.getBoundingClientRect()
      const firstBlock = first.current?.getBoundingClientRect()
      const secondBlock = second.current?.getBoundingClientRect()
      if (!firstBlock || !secondBlock) return
      const next = layoutPrologueCopyBlocks({
        viewport: { width: viewport.width, height: viewport.height },
        lightBounds: { top: viewport.height / 2 - prologue.innerGlowRadius, bottom: viewport.height / 2 + prologue.innerGlowRadius },
        firstHeight: firstBlock.height,
        secondHeight: secondBlock.height,
        firstPositionY: prologue.positionY,
        gap: prologue.textGap,
      })
      setCopyLayout((current) => current && Math.abs(current.firstTop - next.firstTop) < 0.5 && Math.abs(current.secondTop - next.secondTop) < 0.5 ? current : next)
    }

    updateLayout()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateLayout)
    observer?.observe(overlay)
    observer?.observe(first.current)
    observer?.observe(second.current)
    window.addEventListener('resize', updateLayout)
    document.fonts?.addEventListener('loadingdone', updateLayout)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateLayout)
      document.fonts?.removeEventListener('loadingdone', updateLayout)
    }
  }, [prologue.fontFamily, prologue.fontSize, prologue.secondFontScale, prologue.lineHeight, prologue.positionY, prologue.innerGlowRadius, prologue.textGap, copy.second])

  useLayoutEffect(() => { window.dispatchEvent(new Event('prologue-layout')) }, [copyLayout, prologue])

  const build = useCallback(() => createPrologueOverlayTimeline({
    first: first.current,
    second: second.current,
    prompt: prompt.current,
  }, frames, prologue, reducedMotion), [frames, prologue, reducedMotion])
  useSceneTimeline(build, { runtime })

  const firstVisible = state.elapsed >= frames.first[1] && state.elapsed < frames.dissolve[0]
  const secondVisible = state.elapsed >= frames.second[1] && state.elapsed < frames.dissolve[0]
  const waiting = state.mode === 'waiting'

  return <section className="prologue-overlay" aria-label="Пролог">
    <div className="prologue-phrases" aria-live="polite" style={phrasesStyle}>
      <p ref={first} data-prologue-line="first" aria-label={copy.first} aria-hidden={!firstVisible} style={copyStyle(copyLayout ? `${copyLayout.firstTop}px` : `${prologue.positionY}%`, copyLayout ? 'none' : 'translateY(-50%)')}>
        {copy.first}
      </p>
      <p ref={second} data-prologue-line="second" aria-label={copy.second} aria-hidden={!secondVisible} style={copyStyle(copyLayout ? `${copyLayout.secondTop}px` : 'calc(50% + 56px)', 'none', prologue.secondFontScale)}>
        {copy.second}
      </p>
    </div>
    <p ref={prompt} className="prologue-prompt" aria-label={COPY.seedPrompt} aria-hidden={!waiting} style={promptStyle}>
      {COPY.seedPrompt}
    </p>
  </section>
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(3)))
}
