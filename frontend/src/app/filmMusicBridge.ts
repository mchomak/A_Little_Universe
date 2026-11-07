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
    director.syncFilmState(state)
  }
  return {
    syncFilmState,
    startAfterUnlock(unlock, state) {
      let unlocked: Promise<boolean>
      try { unlocked = unlock() } catch { unlocked = Promise.resolve(false) }
      return unlocked.catch(() => false).then((ready) => {
        if (ready) syncFilmState({
          ...state,
          scene: 'prologue',
          mode: 'playing',
          elapsed: 0,
          paused: false,
          reading: false,
          revision: state.revision + 1,
          returnToEnding: false,
        })
        return ready
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribeGallery()
      filmState = null
    },
  }
}
