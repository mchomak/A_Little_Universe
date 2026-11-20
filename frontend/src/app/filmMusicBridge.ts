import type { FilmState } from '../engine/film'
import { gallerySnapshot, subscribeGallery, type GallerySnapshot } from '../scenes/gallery/controller'
import type { MusicDirector } from '../systems/audio/MusicDirector'

type GalleryPhaseSource = Pick<GallerySnapshot, 'phase'>
interface GalleryEventSource {
  snapshot(): GalleryPhaseSource
  subscribe(listener: () => void): () => void
}
type FilmMusicDirector = Pick<MusicDirector, 'syncFilmState' | 'handleGalleryExit'>
const liveGallery: GalleryEventSource = { snapshot: gallerySnapshot, subscribe: subscribeGallery }

export interface FilmMusicBridge {
  syncFilmState(state: FilmState): void
  startAfterUnlock(unlock: () => Promise<boolean>, state: FilmState): Promise<boolean>
  dispose(): void
}

/** Keeps music attached to the app film lifecycle and the gallery's existing exit event. */
export function createFilmMusicBridge(director: FilmMusicDirector, gallery: GalleryEventSource = liveGallery): FilmMusicBridge {
  let disposed = false
  let filmState: FilmState | null = null
  let galleryPhase = gallery.snapshot().phase
  let introTimer: ReturnType<typeof setTimeout> | null = null
  let pendingIntroState: FilmState | null = null
  let introArmed = false
  const cancelIntro = () => {
    if (introTimer !== null) clearTimeout(introTimer)
    introTimer = null
    pendingIntroState = null
    introArmed = false
  }
  const onGalleryChange = () => {
    if (disposed) return
    const nextPhase = gallery.snapshot().phase
    if (nextPhase === 'exit' && galleryPhase !== 'exit') {
      director.handleGalleryExit(filmState?.scene === 'gallery' && filmState.returnToEnding)
    }
    galleryPhase = nextPhase
  }
  const unsubscribeGallery = gallery.subscribe(onGalleryChange)
  const syncFilmState = (state: FilmState) => {
    if (disposed) return
    filmState = state
    if (introArmed && state.scene === 'prologue' && state.mode !== 'ready') {
      introArmed = false
      pendingIntroState = state
      introTimer = setTimeout(() => {
        const nextState = pendingIntroState
        introTimer = null
        pendingIntroState = null
        if (nextState && !disposed) syncFilmState(nextState)
      }, 5000)
      return
    }
    if (introArmed && state.mode === 'ready') return
    if (introArmed) cancelIntro()
    if (introTimer !== null) {
      if (state.scene === 'prologue' && state.mode === 'ready') return
      if (state.scene === 'prologue') { pendingIntroState = state; return }
      cancelIntro()
    }
    director.syncFilmState(state)
  }
  return {
    syncFilmState,
    startAfterUnlock(unlock) {
      let unlocked: Promise<boolean>
      try { unlocked = unlock() } catch { unlocked = Promise.resolve(false) }
      return unlocked.catch(() => false).then((ready) => {
        if (ready && !disposed) {
          cancelIntro()
          introArmed = true
        }
        return ready
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelIntro()
      unsubscribeGallery()
      filmState = null
    },
  }
}
