import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { SceneProps } from '../engine/sceneTypes'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { createBloomTextClock, isBloomGestureReady } from '../scenes/lily/bloomGesture'
import './bloom.css'

// eslint-disable-next-line react-refresh/only-export-components -- shared content contract for the GPU matter layer.
export const BLOOM_COPY = [
  'Некоторые вещи',
  'становятся красивее,',
  'когда к ним прикасаешься',
  'Проведи пальцем по цветку',
] as const

function getReveal(time: number, duration: number) {
  const progress = Math.max(0, Math.min(1, time / Math.max(0.1, duration)))
  return progress * progress * (3 - 2 * progress)
}

export function BloomOverlay({ state, runtime, reducedMotion }: SceneProps) {
  const paragraph = useRef<HTMLParagraphElement>(null)
  const accessibleHint = useRef<HTMLSpanElement>(null)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const prologue = config.scenes.prologue
  const text = config.scenes.bloom
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === prologue.fontFamily)?.family ?? 'Great Vibes'
  const stateRef = useRef(state)
  const clock = useRef(createBloomTextClock(runtime.presentationTime, state.mode === 'waiting' ? 'waiting' : 'playing', state.revision))
  const fractureStart = useRef<number | null>(state.mode === 'waiting' ? null : 0)
  const previousMode = useRef(state.mode)

  useLayoutEffect(() => {
    clock.current.setState(state.mode === 'waiting' ? 'waiting' : 'playing', state.revision)
    if (previousMode.current === 'waiting' && state.mode === 'playing') fractureStart.current = clock.current.waitingElapsed()
    if (state.revision !== stateRef.current.revision && state.mode === 'waiting') fractureStart.current = null
    previousMode.current = state.mode
    stateRef.current = state
    clock.current.update(runtime.presentationTime, runtime.time)
  }, [runtime, state, state.revision])

  useLayoutEffect(() => {
    const draw = () => {
      const target = paragraph.current
      if (!target) return
      const time = clock.current.time()
      const write = reducedMotion ? 1 : getReveal(time, text.textWritingDuration)
      const start = fractureStart.current
      const dissolve = start === null ? 0 : reducedMotion ? getReveal(time - start, 0.7) : Math.max(0, Math.min(1, (time - start) / 2.6))
      target.style.setProperty('--write-progress', `${write * 104}%`)
      target.style.opacity = String(1 - dissolve)
      target.style.setProperty('--fracture-progress', `${dissolve * 100}%`)
      const ready = stateRef.current.mode === 'waiting' && isBloomGestureReady(clock.current.waitingElapsed(), text.textWritingDuration)
      target.setAttribute('aria-hidden', String(!ready))
      if (accessibleHint.current) accessibleHint.current.textContent = ready ? BLOOM_COPY[3] : ''
    }
    const updatePresentation = (time: number) => { clock.current.update(time, runtime.time); draw() }
    const updateScene = (time: number) => { clock.current.update(runtime.presentationTime, time); draw() }
    draw()
    const unsubscribePresentation = runtime.subscribePresentation(updatePresentation)
    const unsubscribeFrame = runtime.subscribeFrame(updateScene)
    return () => { unsubscribePresentation(); unsubscribeFrame() }
  }, [reducedMotion, runtime, text.textWritingDuration, state.revision])

  const style: CSSProperties = {
    left: `${text.textPositionX * 100}%`, top: `${text.textPositionY * 100}%`,
    fontFamily: `"${fontFamily}"`, fontSize: `clamp(26px, ${Math.max(2, text.textSize / 13)}vw, ${text.textSize}px)`,
    color: text.textColor, textShadow: '0 1px 8px rgba(10, 8, 12, 0.14)',
    '--write-progress': '0%',
  } as CSSProperties

  return <section className="bloom-overlay" aria-label="Приглашение раскрыть лилию" data-matter-ready="false">
    <p ref={paragraph} className="bloom-calligraphy" data-bloom-text="" aria-label={BLOOM_COPY.join(' ')} aria-live="polite" aria-hidden="true" style={style}>
      {BLOOM_COPY.map((line, index) => <span key={line} data-bloom-line="">{index > 0 && <br />}{line}</span>)}
    </p>
    <span ref={accessibleHint} className="bloom-accessible-hint" aria-live="polite" />
  </section>
}
