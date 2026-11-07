import { expect, it, vi } from 'vitest'
import { initialFilmState } from '../engine/film'
import { createFilmMusicBridge } from './filmMusicBridge'

it('starts Intro after the existing audio unlock initiated by the film start gesture', async () => {
  const director = {
    syncFilmState: vi.fn(),
    handleGalleryExit: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }
  const gallery = { snapshot: () => ({ phase: 'intro' as const }), subscribe: () => () => undefined }
  const bridge = createFilmMusicBridge(director, gallery)
  const unlock = vi.fn(() => Promise.resolve(true))
  const start = bridge.startAfterUnlock(unlock, initialFilmState)

  expect(unlock).toHaveBeenCalledOnce()
  expect(director.syncFilmState).not.toHaveBeenCalled()
  await expect(start).resolves.toBe(true)
  expect(director.syncFilmState).toHaveBeenCalledWith({
    ...initialFilmState,
    scene: 'prologue',
    mode: 'playing',
    elapsed: 0,
    revision: 1,
  })
})

it('forwards one gallery exit at a time with the return-to-ending flag', () => {
  const director = {
    syncFilmState: vi.fn(),
    handleGalleryExit: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }
  const listeners = new Set<() => void>()
  let phase: 'intro' | 'instruction' | 'explore' | 'exit' = 'intro'
  const gallery = {
    snapshot: () => ({ phase }),
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    setPhase(next: typeof phase) { phase = next; listeners.forEach((listener) => listener()) },
  }
  const bridge = createFilmMusicBridge(director, gallery)
  bridge.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring' })

  gallery.setPhase('exit')
  gallery.setPhase('exit')
  expect(director.handleGalleryExit).toHaveBeenCalledTimes(1)
  expect(director.handleGalleryExit).toHaveBeenLastCalledWith(false)

  bridge.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', returnToEnding: true })
  gallery.setPhase('explore')
  gallery.setPhase('exit')
  expect(director.handleGalleryExit).toHaveBeenCalledTimes(2)
  expect(director.handleGalleryExit).toHaveBeenLastCalledWith(true)
  bridge.dispose()
})

