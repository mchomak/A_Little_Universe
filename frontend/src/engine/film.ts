import { MEMORIES, SCENES, SCENE_ORDER } from './filmConfig'

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
}
export type FilmAction =
  | { type: 'start' | 'toggle-pause' | 'replay' | 'interact' | 'gallery-exit' | 'open-gallery' | 'open-reading' | 'close-reading' | 'finish' | 'dev-restart' | 'dev-skip' }
  | { type: 'gallery-step'; direction: -1 | 1 }
  | { type: 'gallery-focus'; index: number }
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

export function filmDuration(state: FilmState) {
  return SCENES[state.scene].duration + (state.scene === 'prologue' && state.mode === 'transitioning' ? 0.3 : 0)
}

function enter(state: FilmState, scene: SceneId): FilmState {
  return { ...state, scene, mode: SCENES[scene].entryMode, elapsed: 0, revision: state.revision + 1, reading: false }
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
      const duration = SCENES[state.scene].duration
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
      return { ...initialFilmState, mode: 'playing', revision: state.revision + 1 }
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
      if (state.scene === 'prologue') return { ...state, mode: 'transitioning', elapsed: 16, revision: state.revision + 1 }
      if (state.scene === 'bloom') return { ...state, elapsed: 0, mode: 'playing', revision: state.revision + 1 }
      return state
    case 'timeline-update':
      if ((state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || action.revision !== state.revision || !Number.isFinite(action.time)) return state
      return { ...state, elapsed: Math.max(0, Math.min(action.time, filmDuration(state))) }
    case 'timeline-complete': {
      if ((state.mode !== 'playing' && state.mode !== 'transitioning') || state.paused || state.reading || action.revision !== state.revision || state.elapsed < filmDuration(state)) return state
      if (state.scene === 'prologue' && state.mode === 'transitioning') return enter(state, 'growth')
      const next = { growth: 'bloom', bloom: 'identity', identity: 'gallery', eye: 'cosmos', cosmos: 'greeting' } as const
      if (state.scene in next) return enter(state, next[state.scene as keyof typeof next])
      return { ...state, mode: 'waiting', revision: state.scene === 'prologue' ? state.revision + 1 : state.revision }
    }
    case 'gallery-focus':
      return state.scene === 'gallery' && Number.isInteger(action.index) && action.index >= 0 && action.index < MEMORIES.length ? { ...state, galleryIndex: action.index } : state
    case 'gallery-step': {
      if (state.scene !== 'gallery' || (action.direction !== -1 && action.direction !== 1)) return state
      const index = state.galleryIndex + action.direction
      return index >= 0 && index < MEMORIES.length ? { ...state, galleryIndex: index } : state
    }
    case 'gallery-exit':
      if (state.scene === 'gallery' && state.returnToEnding) return { ...enter(state, 'ending'), returnToEnding: false }
      return state.scene === 'gallery' && state.galleryIndex === MEMORIES.length - 1 ? enter(state, 'eye') : state
    case 'finish':
      return state.scene === 'greeting' && state.mode === 'waiting' ? enter(state, 'ending') : state
  }
  return state
}
