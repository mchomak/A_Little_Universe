import { useSyncExternalStore } from 'react'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'

export type PersistentLightPhase = 'hidden' | 'ready' | 'prologue'

export interface PersistentLightProps {
  phase: PersistentLightPhase
  interactive?: boolean
  reducedMotion?: boolean
  onActivate?(): void
}

/** A single viewport anchored point that can pass from preparation into the prologue. */
export function PersistentLight({ phase, interactive = false, reducedMotion = false, onActivate }: PersistentLightProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const { glow, pulseAmplitude, pulseFrequency } = config.scenes.prologue
  const canActivate = phase === 'prologue' && interactive && Boolean(onActivate)
  const blur = glow * 7
  const amplitudeDown = formatNumber(Math.max(0.5, 1 - pulseAmplitude))
  const amplitudeUp = formatNumber(1 + pulseAmplitude)
  const pulseDuration = pulseFrequency > 0 ? `${formatNumber(1 / pulseFrequency)}s` : '0s'
  const glowDown = 1 - pulseAmplitude * 0.2
  const glowUp = 1 + pulseAmplitude * 0.2
  const glowRule = `.persistent-light[data-phase="prologue"]::before { background: radial-gradient(circle, rgba(255, 240, 232, ${formatNumber(glow * 0.3)}) 0, rgba(255, 240, 232, ${formatNumber(glow * 0.13)}) 24%, transparent 72%); }
    .persistent-light[data-phase="prologue"] .persistent-light-core { box-shadow: 0 0 ${formatNumber(blur)}px ${formatNumber(glow * 2)}px rgba(255, 240, 232, ${formatNumber(Math.min(1, glow * 0.55))}), 0 0 ${formatNumber(blur * 2.8)}px ${formatNumber(blur)}px rgba(255, 240, 232, ${formatNumber(glow * 0.2)}); }`
  const pulseRule = reducedMotion || pulseFrequency === 0
    ? '.persistent-light[data-phase="prologue"] .persistent-light-core { animation: none !important; }'
    : `.persistent-light[data-phase="prologue"] .persistent-light-core { animation: prologue-light-pulse ${pulseDuration} ease-in-out infinite !important; }
      @keyframes prologue-light-pulse {
        0%, 100% { transform: scale(${amplitudeDown}); box-shadow: 0 0 ${formatNumber(blur * glowDown)}px ${formatNumber(glow * 2 * glowDown)}px rgba(255, 240, 232, ${formatNumber(Math.min(1, glow * 0.55 * glowDown))}), 0 0 ${formatNumber(blur * 2.8 * glowDown)}px ${formatNumber(blur * glowDown)}px rgba(255, 240, 232, ${formatNumber(glow * 0.2 * glowDown)}); }
        50% { transform: scale(${amplitudeUp}); box-shadow: 0 0 ${formatNumber(blur * (1 + pulseAmplitude * 0.3) * glowUp)}px ${formatNumber(glow * 2 * (1 + pulseAmplitude * 0.25) * glowUp)}px rgba(255, 240, 232, ${formatNumber(Math.min(1, glow * 0.55 * (1 + pulseAmplitude * 0.2) * glowUp))}), 0 0 ${formatNumber(blur * 2.8 * (1 + pulseAmplitude * 0.3) * glowUp)}px ${formatNumber(blur * (1 + pulseAmplitude * 0.2) * glowUp)}px rgba(255, 240, 232, ${formatNumber(glow * 0.2 * (1 + pulseAmplitude * 0.4) * glowUp)}); }
      }`
  return <>
    {phase === 'prologue' && <style>{`${glowRule}\n${pulseRule}`}</style>}
    <button
      className={`persistent-light${reducedMotion ? ' persistent-light-reduced' : ''}`}
      type="button"
      data-phase={phase}
      data-interactive={canActivate}
      aria-label={canActivate ? 'Прикоснуться к свету' : undefined}
      aria-hidden={!canActivate}
      tabIndex={canActivate ? 0 : -1}
      disabled={!canActivate}
      onClick={canActivate ? onActivate : undefined}
    ><span className="persistent-light-core" aria-hidden="true" /></button>
  </>
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(3)))
}
