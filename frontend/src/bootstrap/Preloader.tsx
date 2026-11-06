import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { AssetManager, PreparationProgress, PreparationResult } from '../systems/assets/AssetManager'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { PhoneBackground } from '../components/PhoneBackground'
import { runPreloaderAttempt } from './preloaderFlow'
import './preload.css'

interface PreloaderProps {
  manager: AssetManager
  onReady: (result: PreparationResult) => void
}

interface PreloaderRecoveryProps {
  result: PreparationResult
  onRetry: () => void
  onReload: () => void
}

/** Retry affordances stay on the same lightweight loading surface after a failure. */
export function PreloaderRecovery({ result, onRetry, onReload }: PreloaderRecoveryProps) {
  return <div className="preloader-recovery">
    <p>Кажется, что-то задержалось. Давай попробуем ещё раз.</p>
    {result.recovery !== 'reload' && <button type="button" onClick={onRetry}>Попробовать ещё раз</button>}
    <button type="button" onClick={onReload}>Начать заново</button>
  </div>
}

/** Reusable for development reruns; it owns no film clock or media permissions. */
export function Preloader({ manager, onReady }: PreloaderProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(0)
  const collapseRef = useRef(false)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const visual = config.scenes.preload
  const visualRef = useRef(visual)
  const [progress, setProgress] = useState<PreparationProgress>({ phase: 'modules', completed: 0, total: 1, message: 'Создаём кое-что особенное…' })
  const [result, setResult] = useState<PreparationResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { visualRef.current = visual }, [visual])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let secondFrame = 0
    const prepare = () => {
      void runPreloaderAttempt({
        manager,
        onProgress: (value) => {
          if (cancelled) return
          progressRef.current = value.completed / value.total
          collapseRef.current = value.phase === 'ready'
          setProgress(value)
        },
        onResult: (value) => {
          setResult(value)
          collapseRef.current = value.ready
        },
        onReady,
        isCurrent: () => !cancelled,
        scheduleReady: (callback, delay) => { timer = setTimeout(callback, delay) },
      })
    }
    // Guarantee a painted lightweight frame before starting the heavy module graph.
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(prepare) })
    return () => { cancelled = true; clearTimeout(timer); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame) }
  }, [manager, onReady, attempt])

  useEffect(() => {
    const surface = canvas.current
    const context = surface?.getContext('2d')
    if (!surface || !context) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let collapse = 0
    let previous = 0
    const draw = (time: number) => {
      const delta = Math.min((time - previous) / 1000, 0.05)
      previous = time
      const width = surface.clientWidth
      const height = surface.clientHeight
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr)) {
        surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr)
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      const settings = visualRef.current
      if (reduced) collapse = collapseRef.current ? 1 : 0
      else collapse = Math.min(1, collapse + (collapseRef.current
        ? settings.collapseDuration === 0 ? 1 : delta / settings.collapseDuration
        : -delta * 3))
      collapse = Math.max(0, collapse)
      // The fixed set of particles packs closer as mandatory work actually
      // completes; the separate ready collapse begins only after cache checking.
      const preparation = Math.max(0, Math.min(1, progressRef.current))
      const radius = Math.min(width * 0.29, height * 0.34, 135) * (1 - preparation * 0.3) * (1 - collapse) ** 2
      const rotation = reduced ? 0 : time * 0.00011 * settings.movementSpeed
      for (let i = 0; i < settings.particleCount; i++) {
        const angle = i * 2.399963 + rotation * (0.4 + i % 7 / 9)
        const spread = Math.sqrt((i + 0.5) / settings.particleCount)
        const x = width / 2 + Math.cos(angle) * radius * spread
        const y = height / 2 + Math.sin(angle) * radius * spread * (0.62 + (i % 5) / 15)
        const alpha = (0.25 + (i % 9) / 13) * (0.55 + progressRef.current * 0.45) * (1 - collapse * 0.97)
        const size = 0.6 + (i % 7) / 8
        const color = i % 4 === 0 ? '185,164,232' : i % 3 === 0 ? '244,205,217' : '255,240,232'
        const glow = context.createRadialGradient(x, y, 0, x, y, size * 5)
        glow.addColorStop(0, `rgba(${color},${alpha})`)
        glow.addColorStop(0.2, `rgba(${color},${alpha * 0.38})`)
        glow.addColorStop(1, `rgba(${color},0)`)
        context.fillStyle = glow
        context.beginPath(); context.arc(x, y, size * 5, 0, Math.PI * 2); context.fill()
      }
      if (collapse > 0) {
        const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, 24)
        glow.addColorStop(0, `rgba(255,240,232,${collapse})`)
        glow.addColorStop(0.12, `rgba(255,240,232,${collapse * 0.65})`)
        glow.addColorStop(1, 'rgba(185,164,232,0)')
        context.fillStyle = glow; context.fillRect(width / 2 - 24, height / 2 - 24, 48, 48)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  const retry = () => { setResult(null); collapseRef.current = false; setAttempt((value) => value + 1) }
  const measured = progress.phase === 'assets' || progress.phase === 'portrait' || progress.phase === 'ready'
  return <main className="preloader" data-phase={progress.phase} aria-label="Подготовка подарка">
    <PhoneBackground />
    <canvas className="preloader-particles" ref={canvas} style={{ '--preload-glow': visual.glow } as CSSProperties} aria-hidden="true" />
    <div className="preloader-copy">
      <p role="status" aria-live="polite">{progress.message}</p>
      <progress aria-label="Подготовка подарка" max={progress.total} value={measured ? progress.completed : undefined} />
      {result && !result.ready && <PreloaderRecovery result={result} onRetry={retry} onReload={() => location.reload()} />}
    </div>
  </main>
}
