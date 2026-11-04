import { getPrologueTouchDuration, getSceneDuration, MEMORIES, SCENES, SCENE_ORDER, TIMING } from './filmConfig'

export type SceneId = 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery' | 'eye' | 'cosmos' | 'greeting' | 'ending'
export type Quality = 'standard' | 'low'
export interface FilmState {
  scene: SceneId
  mode: 'ready' | 'playing' | 'transitioning' | 'waiting' | 'exploring' | 'ended'
  elapsed: number
  paused: boolean
  speed: number
  revision: number
  galleryIndex: number
  reading: boolean
  quality: Quality
  /** Revisited gallery/letter closes back to the final screen. */
  returnToEnding: boolean
  /** Frozen at the deliberate touch; live tuning cannot move an in-flight endpoint. */
  prologueTouchDuration?: number
  /** Raised when current Scene 04 geometry needs additional time to finish its photo reveal. */
  identityDuration?: number | undefined
  /** Keeps Scene 04's clock advancing in short endpoint increments while replacement geometry is pending. */
  identityPreparationPending?: boolean | undefined
}
export type FilmAction =
  | { type: 'start' | 'toggle-pause' | 'replay' | 'replay-letter' | 'greeting-complete' | 'interact' | 'gallery-exit' | 'open-gallery' | 'open-reading' | 'close-reading' | 'finish' | 'dev-restart' | 'dev-skip' }
  | { type: 'gallery-finish' }
  | { type: 'gallery-step'; direction: -1 | 1 }
  | { type: 'gallery-focus'; index: number }
  | { type: 'extend-identity-duration'; duration: number; time: number; revision: number }
  | { type: 'set-identity-duration'; duration: number; time: number; revision: number }
  | { type: 'set-identity-preparation-pending'; pending: boolean; time: number; revision: number }
  | { type: 'timeline-update'; time: number; revision: number }
  | { type: 'timeline-complete'; revision: number }
  | { type: 'dev-jump'; scene: SceneId }
  | { type: 'dev-seek'; time: number }
  | { type: 'set-speed'; speed: number }
  | { type: 'set-quality'; quality: Quality }

export const initialFilmState: FilmState = {
  scene: 'prologue', mode: 'ready', elapsed: 0, paused: false, speed: 1,
  revision: 0, galleryIndex: 0, reading: false, quality: 'standard', returnToEnding: false,
}

const IDENTITY_PENDING_EXTENSION_SECONDS = 5

export function filmDuration(state: FilmState, config?: Parameters<typeof getSceneDuration>[1]) {
  const configuredDuration = getSceneDuration(state.scene, config)
  const sceneDuration = state.scene === 'identity' && Number.isFinite(state.identityDuration)
    ? Math.max(configuredDuration, state.identityDuration!) : configuredDuration
  return sceneDuration + (state.scene === 'prologue' && state.mode === 'transitioning'
    ? state.prologueTouchDuration ?? (config ? getPrologueTouchDuration(config.scenes.prologue) : getPrologueTouchDuration()) : 0)
}

function enter(state: FilmState, scene: SceneId): FilmState {
  return { ...state, scene, mode: SCENES[scene].entryMode, elapsed: 0, revision: state.revision + 1,
    reading: false, identityDuration: undefined, identityPreparationPending: undefined }
}

export function filmReducer(state: FilmState, action: FilmAction, allowDev = false): FilmState {
  if (action.type.startsWith('dev-') && !allowDev) return state
  switch (action.type) {
    case 'dev-jump':
      return Object.hasOwn(SCENES, action.scene) ? { ...enter(state, action.scene), paused: false, galleryIndex: 0, returnToEnding: false } : state
    case 'dev-restart':
      return { ...enter(state, state.scene), paused: false, galleryIndex: 0, returnToEnding: false }
    case 'dev-skip': {
      const next = SCENE_ORDER[SCENE_ORDER.indexOf(state.scene) + 1]
      return next ? { ...enter(state, next), paused: false, returnToEnding: false } : state
    }
    case 'dev-seek': {
      if (!Number.isFinite(action.time)) return state
      const duration = filmDuration(state)
      const closedBud = state.scene === 'bloom' && state.mode === 'waiting'
      const elapsed = closedBud ? 0 : Math.max(0, Math.min(action.time, duration))
      const resumeTimed = !closedBud && duration > 0 && (state.mode === 'waiting' || state.mode === 'ready')
      return { ...state, elapsed, mode: resumeTimed || state.mode === 'transitioning' ? 'playing' : state.mode, revision: state.revision + 1 }
    }
    case 'set-speed':
      return Number.isFinite(action.speed) && action.speed >= 0.25 && action.speed <= 4 ? { ...state, speed: action.speed } : state
    case 'set-quality':
      return action.quality === 'low' || action.quality === 'standard' ? { ...state, quality: action.quality } : state
    case 'toggle-pause':
      return { ...state, paused: !state.paused }
    case 'replay':
      return { ...initialFilmState, mode: 'playing', speed: state.speed, quality: state.quality, revision: state.revision + 1 }
    case 'replay-letter':
      if (state.scene !== 'ending') return state
      return { ...enter(state, 'greeting'), mode: 'playing', elapsed: 0, paused: false, returnToEnding: true }
    case 'greeting-complete':
      return state.scene === 'greeting' && !state.paused && !state.reading
        ? { ...enter(state, 'ending'), returnToEnding: false }
        : state
    case 'open-reading':
      if (state.scene === 'ending') return { ...enter(state, 'greeting'), reading: true, returnToEnding: true }
      return state.scene === 'greeting' ? { ...state, reading: true } : state
    case 'close-reading':
      if (!state.reading) return state
      return state.returnToEnding ? { ...enter(state, 'ending'), returnToEnding: false } : { ...state, reading: false }
    case 'open-gallery':
      return state.scene === 'ending' ? { ...enter(state, 'gallery'), galleryIndex: 0, returnToEnding: true } : state
    case 'start':
      return state.mode === 'ready' ? enter(state, 'prologue') : state
    case 'interact':
      if (state.mode !== 'waiting' || state.paused || state.reading) return state
      if (state.scene === 'prologue') return { ...state, mode: 'transitioning', elapsed: TIMING.prologue.duration,
        prologueTouchDuration: getPrologueTouchDuration(), revision: state.revision + 1 }
      if (state.scene === 'bloom') return { ...state, elapsed: 0, mode: 'playing', revision: state.revision + 1 }
      return state
    case 'timeline-update':
      if ((state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || action.revision !== state.revision || !Number.isFinite(action.time)) return state
      {
        const duration = filmDuration(state)
        const elapsed = Math.max(0, Math.min(action.time, duration))
        if (state.scene === 'identity' && state.identityPreparationPending
          && duration - elapsed <= 1) {
          return extendPendingIdentityEndpoint(state, elapsed)
        }
        return { ...state, elapsed }
      }
    case 'timeline-complete': {
      if ((state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || action.revision !== state.revision || state.elapsed < filmDuration(state)) return state
      if (state.scene === 'identity' && state.identityPreparationPending) {
        return extendPendingIdentityEndpoint(state, state.elapsed)
      }
      if (state.scene === 'prologue' && state.mode === 'transitioning') return enter(state, 'growth')
      const next = { growth: 'bloom', bloom: 'identity', identity: 'gallery', eye: 'cosmos', cosmos: 'greeting' } as const
      if (state.scene in next) return enter(state, next[state.scene as keyof typeof next])
      return { ...state, mode: 'waiting', revision: state.scene === 'prologue' ? state.revision + 1 : state.revision }
    }
    case 'gallery-focus':
      return state.scene === 'gallery' && Number.isInteger(action.index) && action.index >= 0 && action.index < MEMORIES.length ? { ...state, galleryIndex: action.index } : state
    case 'extend-identity-duration': {
      if (state.scene !== 'identity' || action.revision !== state.revision
        || !Number.isFinite(action.duration) || !Number.isFinite(action.time)) return state
      const duration = Math.max(filmDuration(state), action.duration)
      if (duration <= filmDuration(state)) return state
      return { ...state, identityDuration: duration, elapsed: Math.min(duration, Math.max(0, action.time)), revision: state.revision + 1 }
    }
    case 'set-identity-duration': {
      if (state.scene !== 'identity' || action.revision !== state.revision
        || !Number.isFinite(action.duration) || !Number.isFinite(action.time)) return state
      const duration = Math.max(getSceneDuration('identity'), action.duration)
      if (duration === filmDuration(state) && !state.identityPreparationPending) return state
      return {
        ...state,
        identityDuration: duration,
        identityPreparationPending: false,
        elapsed: Math.min(duration, Math.max(0, action.time)),
        revision: state.revision + 1,
      }
    }
    case 'set-identity-preparation-pending': {
      if (state.scene !== 'identity' || action.revision !== state.revision || !Number.isFinite(action.time)) return state
      if (Boolean(state.identityPreparationPending) === action.pending) return state
      return {
        ...state,
        identityPreparationPending: action.pending,
        elapsed: Math.min(filmDuration(state), Math.max(0, action.time)),
        revision: state.revision + 1,
      }
    }
    case 'gallery-step': {
      if (state.scene !== 'gallery' || (action.direction !== -1 && action.direction !== 1)) return state
      const index = state.galleryIndex + action.direction
      return index >= 0 && index < MEMORIES.length ? { ...state, galleryIndex: index } : state
    }
    case 'gallery-finish':
      if (state.scene !== 'gallery') return state
      return state.returnToEnding ? { ...enter(state, 'ending'), returnToEnding: false } : enter(state, 'eye')
    case 'gallery-exit':
      if (state.scene === 'gallery' && state.returnToEnding) return { ...enter(state, 'ending'), returnToEnding: false }
      return state.scene === 'gallery' && state.galleryIndex === MEMORIES.length - 1 ? enter(state, 'eye') : state
    case 'finish':
      return state.scene === 'greeting' && state.mode === 'waiting' ? { ...enter(state, 'ending'), returnToEnding: false } : state
  }
  return state
}

function extendPendingIdentityEndpoint(state: FilmState, elapsed: number): FilmState {
  const duration = Math.max(filmDuration(state), elapsed + IDENTITY_PENDING_EXTENSION_SECONDS)
  return { ...state, identityDuration: duration, elapsed, revision: state.revision + 1 }
}
