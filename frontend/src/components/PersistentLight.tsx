export type PersistentLightPhase = 'hidden' | 'ready' | 'prologue'

export interface PersistentLightProps {
  phase: PersistentLightPhase
  interactive?: boolean
  reducedMotion?: boolean
  onActivate?(): void
}

/** A single viewport anchored point that can pass from preparation into the prologue. */
export function PersistentLight({ phase, interactive = false, reducedMotion = false, onActivate }: PersistentLightProps) {
  const canActivate = phase === 'prologue' && interactive && Boolean(onActivate)
  return <button
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
}
