import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { FilmState } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getPrologueLightPose } from '../scenes/prologue/lightPose'

export type PersistentLightPhase = 'hidden' | 'prologue' | 'growth'

export interface PersistentLightProps {
  phase: PersistentLightPhase
  interactive?: boolean
  reducedMotion?: boolean
  runtime?: FilmRuntime
  state?: FilmState
  onActivate?(): void
}

/** One viewport anchored light: cinematic awakening, then transfer into the seed. */
export function PersistentLight({ phase, interactive = false, reducedMotion = false, runtime, state, onActivate }: PersistentLightProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const settings = config.scenes.prologue
  const target = useRef<HTMLButtonElement>(null)
  const canActivate = phase === 'prologue' && interactive && Boolean(onActivate)
  const mode = state?.mode
  const touchDuration = state?.prologueTouchDuration
  useLayoutEffect(() => {
    const element = target.current
    if (!element || !runtime || !mode || (phase !== 'prologue' && phase !== 'growth')) return
    const draw = (presentation: number) => {
      const pose = getPrologueLightPose(runtime.time, presentation, mode, settings, reducedMotion, phase === 'growth', touchDuration)
      const style = element.style
      style.setProperty('--light-opacity', String(pose.opacity))
      style.setProperty('--light-gain', String(pose.gain))
      style.setProperty('--light-radius', String(pose.radius))
      style.setProperty('--light-pearl', String(pose.pearl))
      style.setProperty('--wave-opacity', String(pose.wave))
      style.setProperty('--wave-size', `${pose.waveRadius * 2}px`)
      const dust = element.querySelectorAll<HTMLElement>('.light-arrival-dust')
      dust.forEach((point, index) => {
        const angle = index * 2.39996 + .37
        const delay = index * .027
        const progress = Math.min(1, Math.max(0, (pose.touch - delay) / (1 - delay)))
        const radius = (20 + (index % 3) * 13) * Math.pow(1 - progress, 1.5)
        point.style.transform = `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius * .65}px)`
        point.style.opacity = reducedMotion || phase === 'growth' ? '0' : String(Math.sin(progress * Math.PI) * .58)
      })
    }
    draw(runtime.presentationTime)
    return runtime.subscribePresentation(draw)
  }, [phase, reducedMotion, runtime, settings, mode, touchDuration])
  const style = {
    '--inner-radius': `${settings.innerGlowRadius * 2}px`,
    '--outer-radius': `${settings.outerGlowRadius * 2}px`,
    '--halo-gain': Math.min(1.8, .65 + settings.glow * .65),
  } as CSSProperties
  return <button
    ref={target}
    className={`persistent-light${reducedMotion ? ' persistent-light-reduced' : ''}`}
    style={style}
    type="button"
    data-phase={phase}
    data-interactive={canActivate}
    aria-label={canActivate ? 'Прикоснуться к свету' : undefined}
    aria-hidden={!canActivate}
    tabIndex={canActivate ? 0 : -1}
    disabled={!canActivate}
    onClick={canActivate ? onActivate : undefined}
  >
    <span className="persistent-light-aura" aria-hidden="true" />
    <span className="persistent-light-inner" aria-hidden="true" />
    <span className="persistent-light-core" aria-hidden="true" />
    <span className="persistent-light-wave" aria-hidden="true" />
    {(phase === 'prologue' || phase === 'growth') && Array.from({ length: 9 }, (_, index) => <span key={index} className="light-arrival-dust" aria-hidden="true" />)}
  </button>
}
