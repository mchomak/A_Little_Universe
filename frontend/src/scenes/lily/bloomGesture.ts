import type { FilmAction, FilmState } from '../../engine/film'

/** Scene 03 starts its invitation after Scene 02's final vortex sparks fade. */
export function getBloomTextStartDelay(dissipationDuration: number, growthSettleDuration: number): number {
  const dissipation = Number.isFinite(dissipationDuration) ? Math.max(0, dissipationDuration) : 0
  const settle = Number.isFinite(growthSettleDuration) ? Math.max(0, growthSettleDuration) : 0
  return Math.max(0, dissipation - settle)
}

/** The bloom gate accepts one ordinary primary-button click or touch activation. */
export function isBloomPrimaryClick(button: number, isPrimary: boolean) {
  return button === 0 && isPrimary
}

export interface BloomPointerDown {
  button: number
  isPrimary: boolean
  stopPropagation(): void
}

/** Applies the bloom gate at the event boundary and dispatches only a ready, active click. */
export function handleBloomPointerDown(
  state: Pick<FilmState, 'scene' | 'mode' | 'paused' | 'reading'>,
  ready: boolean,
  event: BloomPointerDown,
  dispatch: (action: FilmAction) => void,
) {
  if (!isBloomPrimaryClick(event.button, event.isPrimary)) return false
  if (state.scene !== 'bloom' || state.mode !== 'waiting' || state.paused || state.reading) return false

  event.stopPropagation()
  if (!ready) return false

  dispatch({ type: 'interact' })
  return true
}

export function isBloomGestureReady(waitingElapsed: number, writingDuration: number) {
  return Number.isFinite(waitingElapsed) && Number.isFinite(writingDuration)
    && waitingElapsed >= Math.max(0, writingDuration)
}

export interface BloomTextClock {
  update(presentationTime: number, sceneTime: number): void
  setState(mode: 'waiting' | 'playing', revision: number): void
  time(): number
  waitingElapsed(): number
}

/** Maps the indefinite presentation clock onto the bloom-local effect clock. */
export function createBloomTextClock(presentationTime: number, initialMode: 'waiting' | 'playing', initialRevision: number): BloomTextClock {
  let mode = initialMode
  let revision = initialRevision
  let latestPresentation = Number.isFinite(presentationTime) ? presentationTime : 0
  let latestScene = 0
  let origin = latestPresentation
  let carriedWait = 0
  return {
    update(nextPresentation, sceneTime) {
      if (Number.isFinite(nextPresentation)) latestPresentation = nextPresentation
      if (Number.isFinite(sceneTime)) latestScene = sceneTime
    },
    setState(nextMode, nextRevision) {
      if (nextRevision !== revision && nextMode === 'waiting') {
        revision = nextRevision
        mode = nextMode
        origin = latestPresentation
        carriedWait = 0
      } else if (mode === 'waiting' && nextMode === 'playing') {
        carriedWait = Math.max(0, latestPresentation - origin)
        mode = nextMode
        revision = nextRevision
      } else {
        mode = nextMode
        revision = nextRevision
      }
    },
    time() {
      return mode === 'waiting' ? Math.max(0, latestPresentation - origin) : carriedWait + latestScene
    },
    waitingElapsed() {
      return mode === 'waiting' ? Math.max(0, latestPresentation - origin) : carriedWait
    },
  }
}
