import { expect, it, vi } from 'vitest'
import { initialFilmState, type FilmState } from '../../engine/film'
import { MusicDirector } from './MusicDirector'

class FakeMediaElement extends EventTarget {
  src = ''
  preload = ''
  loop = false
  currentTime = 0
  duration = 240
  readyState = 1
  paused = true
  error: MediaError | null = null
  play = vi.fn(async () => { this.paused = false })
  pause = vi.fn(() => { this.paused = true })
  load = vi.fn()
  removeAttribute(name: string) { if (name === 'src') this.src = '' }
}

function directorHarness() {
  const media: FakeMediaElement[] = []
  const gains: GainNode[] = []
  const channels: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
  const scheduled: Array<{ callback: () => void; delayMs: number }> = []
  const setMusicVolume = vi.fn()
  const scheduler = {
    setTimeout: vi.fn((callback: () => void, delayMs: number) => {
      const task = { callback, delayMs }
      scheduled.push(task)
      return task
    }),
    clearTimeout: vi.fn((handle: unknown) => {
      const task = handle as { callback: () => void; delayMs: number }
      const index = scheduled.indexOf(task)
      if (index >= 0) scheduled.splice(index, 1)
    }),
    now: () => 0,
  }
  const director = new MusicDirector({
    createMusicChannel: () => {
      const parameter = {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        setValueCurveAtTime: vi.fn(),
      }
      const gain = { gain: parameter, context: { currentTime: 0 } } as unknown as GainNode
      const dispose = vi.fn()
      gains.push(gain)
      channels.push({ dispose })
      return { gain, dispose }
    },
    createMediaElement: () => {
      const element = new FakeMediaElement()
      media.push(element)
      return element as unknown as HTMLAudioElement
    },
    setMusicVolume,
    scheduler,
  })
  return { director, media, gains, channels, setMusicVolume, scheduler, scheduled }
}

function playingFilmState(scene: FilmState['scene'] = 'prologue'): FilmState {
  return { ...initialFilmState, scene, mode: 'playing', revision: 1 }
}

it('starts Intro at its configured offset and preserves the same playback through scenes 01–04', () => {
  const { director, media } = directorHarness()
  const scenes: FilmState['scene'][] = ['prologue', 'growth', 'bloom', 'identity']
  scenes.forEach((scene, revision) => director.syncFilmState({ ...playingFilmState(scene), revision }))

  expect(director.getSnapshot()).toMatchObject({ state: 'intro', currentTrack: { id: 'intro-in-the-pool' } })
  expect(media).toHaveLength(2)
  expect(media[0]).toMatchObject({ src: '/music/intro-in-the-pool.mp3', currentTime: 68, loop: false })
  expect(media[0]!.play).toHaveBeenCalledOnce()
  expect(media[1]!.src).toBe('/music/gallery-glass.mp3')
  director.dispose()
})

it('restarts Intro on replay using the same media slots', () => {
  const { director, media, gains } = directorHarness()
  const playing = playingFilmState()
  director.syncFilmState(playing)
  director.syncFilmState({ ...playing, elapsed: 42 })
  director.syncFilmState({ ...playing, elapsed: 0, revision: 2 })

  expect(media).toHaveLength(2)
  expect(media[0]!.play).toHaveBeenCalledTimes(2)
  expect(media[0]!.currentTime).toBe(68)
  expect(gains).toHaveLength(2)
  expect(director.getSnapshot().currentTrack?.id).toBe('intro-in-the-pool')
  director.dispose()
})

it('waits through initial ready state but starts Intro after a direct DEV jump into the intro group', () => {
  const { director, media } = directorHarness()
  director.syncFilmState(initialFilmState)
  expect(director.getSnapshot().state).toBe('silent')
  expect(media).toHaveLength(0)

  director.syncFilmState({ ...initialFilmState, scene: 'growth', mode: 'playing', revision: 1 })
  expect(director.getSnapshot()).toMatchObject({ state: 'intro', currentTrack: { id: 'intro-in-the-pool' } })
  expect(media).toHaveLength(2)
  director.dispose()
})

it('does not restart a finished Intro until replay explicitly resets the film', () => {
  const { director, media } = directorHarness()
  const playing = playingFilmState()
  director.syncFilmState(playing)
  media[0]!.dispatchEvent(new Event('ended'))
  expect(director.getSnapshot().state).toBe('silent')

  director.syncFilmState({ ...playing, scene: 'growth', elapsed: 12, revision: 2 })
  expect(media[0]!.play).toHaveBeenCalledOnce()
  expect(director.getSnapshot().state).toBe('silent')

  director.syncFilmState({ ...playing, elapsed: 0, revision: 3 })
  expect(media[0]!.play).toHaveBeenCalledTimes(2)
  expect(director.getSnapshot()).toMatchObject({ state: 'intro', currentTrack: { id: 'intro-in-the-pool' } })
  director.dispose()
})

it('applies master and group gains plus enabled pause settings without restarting the track', () => {
  const { director, media, gains, setMusicVolume } = directorHarness()
  director.syncFilmState(playingFilmState())
  director.setSettings({ volume: 0.35, introGain: 0.5 })
  expect(setMusicVolume).toHaveBeenLastCalledWith(0.35)
  const introGain = gains[0]!.gain.setValueAtTime as unknown as ReturnType<typeof vi.fn>
  expect(introGain.mock.calls.at(-1)?.[0]).toBeCloseTo(0.397)
  const playCount = media[0]!.play.mock.calls.length

  director.setSettings({ enabled: false })
  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: false, paused: true })
  director.setSettings({ enabled: true })
  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: true, paused: false, currentTrack: { id: 'intro-in-the-pool' } })
  expect(media[0]!.src).toBe('/music/intro-in-the-pool.mp3')
  expect(media[0]!.play.mock.calls.length).toBe(playCount + 1)
  director.dispose()
})

it('preserves disabled pause state across same-group sync and resumes the current track when re-enabled', () => {
  const { director, media } = directorHarness()
  const playing = playingFilmState()
  director.syncFilmState(playing)
  director.setSettings({ enabled: false })
  director.syncFilmState({ ...playing, elapsed: 18, revision: 2 })

  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: false, paused: true, currentTrack: { id: 'intro-in-the-pool' } })
  expect(media[0]!.play).toHaveBeenCalledOnce()
  director.setSettings({ enabled: true })

  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: true, paused: false, currentTrack: { id: 'intro-in-the-pool' } })
  expect(media[0]!.play).toHaveBeenCalledTimes(2)
  expect(media).toHaveLength(2)
  director.dispose()
})

it('preserves disabled pause state when resume is requested and resumes once when re-enabled', () => {
  const { director, media } = directorHarness()
  director.syncFilmState(playingFilmState())
  director.setSettings({ enabled: false })
  director.resume()

  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: false, paused: true })
  expect(media[0]!.play).toHaveBeenCalledOnce()
  director.setSettings({ enabled: true })

  expect(director.getSnapshot()).toMatchObject({ state: 'intro', enabled: true, paused: false, currentTrack: { id: 'intro-in-the-pool' } })
  expect(media[0]!.play).toHaveBeenCalledTimes(2)
  expect(media).toHaveLength(2)
  director.dispose()
})

it('crossfades Intro into Glass with the eight-second equal-power profile and prepares Nuvole after the fade', () => {
  const { director, media, gains, scheduler, scheduled } = directorHarness()
  director.syncFilmState(playingFilmState())
  director.syncFilmState({ ...playingFilmState('gallery'), mode: 'exploring', revision: 2 })

  expect(director.getSnapshot()).toMatchObject({ state: 'gallery', currentTrack: { id: 'gallery-glass' } })
  expect(director.getSnapshot().nextTrack?.id).toBe('gallery-nuvole-bianche')
  expect(media[1]!.play).toHaveBeenCalledOnce()
  expect(scheduler.setTimeout).toHaveBeenCalledWith(expect.any(Function), 8000)
  expect(gains[0]!.gain.setValueCurveAtTime).toHaveBeenCalledOnce()
  expect(gains[1]!.gain.setValueCurveAtTime).toHaveBeenCalledOnce()
  const curveSpy = gains[1]!.gain.setValueCurveAtTime as unknown as ReturnType<typeof vi.fn>
  const incomingCurve = curveSpy.mock.calls[0]![0] as Float32Array
  const outgoingCurveSpy = gains[0]!.gain.setValueCurveAtTime as unknown as ReturnType<typeof vi.fn>
  const outgoingCurve = outgoingCurveSpy.mock.calls[0]![0] as Float32Array
  expect(incomingCurve[0]).toBe(0)
  expect(incomingCurve.at(-1)).toBeCloseTo(1)
  expect(incomingCurve[32]).toBeCloseTo(Math.sin(Math.PI / 4))
  expect(outgoingCurve[32]).toBeCloseTo(0.794 * Math.cos(Math.PI / 4))
  scheduled[0]!.callback()
  expect(director.getSnapshot().nextTrack?.id).toBe('gallery-nuvole-bianche')
  expect(media[0]!.src).toBe('/music/gallery-nuvole-bianche.mp3')
  director.dispose()
})

it('publishes media time updates while a crossfade is active', () => {
  const { director, media } = directorHarness()
  const listener = vi.fn()
  director.subscribe(listener)
  director.syncFilmState(playingFilmState())
  director.syncFilmState({ ...playingFilmState('gallery'), mode: 'exploring', revision: 2 })
  const glass = media.find((candidate) => candidate.src === '/music/gallery-glass.mp3')!
  glass.currentTime = 12.5
  glass.dispatchEvent(new Event('timeupdate'))

  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ currentTrack: expect.objectContaining({ id: 'gallery-glass' }), currentTime: 12.5 }))
  director.dispose()
})

it('plays the gallery tracks in order, loops after La femme d’argent, and ignores photo focus changes', () => {
  const { director, media, scheduler, scheduled } = directorHarness()
  const state: FilmState = { ...initialFilmState, scene: 'gallery', mode: 'exploring', revision: 3 }
  director.syncFilmState(state)
  expect(director.getSnapshot().currentTrack?.id).toBe('gallery-glass')
  const playCounts = media.map((element) => element.play.mock.calls.length)
  director.syncFilmState({ ...state, galleryIndex: 9, revision: 4 })
  expect(director.getSnapshot().currentTrack?.id).toBe('gallery-glass')
  expect(media.map((element) => element.play.mock.calls.length)).toEqual(playCounts)

  const transitions = [
    ['gallery-nuvole-bianche', 7000],
    ['gallery-tres-notas', 7000],
    ['gallery-je-te-laisserai-des-mots', 7000],
    ['gallery-la-femme-dargent', 7000],
    ['gallery-glass', 8000],
  ] as const
  for (const [nextId, fadeDuration] of transitions) {
    const current = director.getSnapshot().currentTrack!
    const element = media.find((candidate) => candidate.src === current.url)!
    element.currentTime = element.duration - 0.5
    element.dispatchEvent(new Event('timeupdate'))
    expect(director.getSnapshot().currentTrack?.id).toBe(nextId)
    expect(scheduler.setTimeout.mock.calls.at(-1)?.[1]).toBe(fadeDuration)
    scheduled.shift()!.callback()
    expect(director.getSnapshot().currentTrack?.id).toBe(nextId)
  }
  expect(media).toHaveLength(2)
  expect(director.getSnapshot().nextTrack?.id).toBe('gallery-nuvole-bianche')
  director.dispose()
})

it('starts Outro on gallery exit, preserves it across final scenes, and never restarts it after it ends', () => {
  const { director, media, scheduled, scheduler } = directorHarness()
  director.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', revision: 1 })
  director.handleGalleryExit(false)

  expect(director.getSnapshot()).toMatchObject({ state: 'outro', currentTrack: { id: 'final-m83-outro' } })
  expect(scheduler.setTimeout.mock.calls.at(-1)?.[1]).toBe(10000)
  scheduled.shift()!.callback()
  const outroElement = media.find((candidate) => candidate.src === '/music/final-m83-outro.mp3')!
  expect(outroElement.currentTime).toBe(0)
  const playCount = outroElement.play.mock.calls.length
  director.syncFilmState({ ...initialFilmState, scene: 'cosmos', mode: 'exploring', revision: 2 })
  director.syncFilmState({ ...initialFilmState, scene: 'greeting', mode: 'playing', revision: 3 })
  director.syncFilmState({ ...initialFilmState, scene: 'ending', mode: 'ended', revision: 4 })
  expect(outroElement.play).toHaveBeenCalledTimes(playCount)
  outroElement.dispatchEvent(new Event('ended'))
  expect(director.getSnapshot().state).toBe('ended')
  director.handleGalleryExit(false)
  director.syncFilmState({ ...initialFilmState, scene: 'ending', mode: 'ended', revision: 5 })
  expect(outroElement.play).toHaveBeenCalledTimes(playCount)
  director.dispose()
})

it('does not launch Outro again when returning from an ending gallery', () => {
  const { director, media } = directorHarness()
  director.syncFilmState({ ...initialFilmState, scene: 'cosmos', mode: 'exploring', revision: 1 })
  const firstOutro = media.find((candidate) => candidate.src === '/music/final-m83-outro.mp3')!
  const playCount = firstOutro.play.mock.calls.length
  director.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', returnToEnding: true, revision: 2 })
  director.handleGalleryExit(true)
  director.syncFilmState({ ...initialFilmState, scene: 'ending', mode: 'ended', revision: 3 })
  expect(director.getSnapshot()).toMatchObject({ state: 'gallery', currentTrack: { id: 'gallery-glass' } })
  expect(firstOutro.play).toHaveBeenCalledTimes(playCount)
  director.dispose()
})

it('cancels the existing fade before a manual next-track preview', () => {
  const { director, media, gains, scheduler, scheduled } = directorHarness()
  director.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', revision: 1 })
  const glass = media.find((candidate) => candidate.src === '/music/gallery-glass.mp3')!
  glass.currentTime = glass.duration - 1
  glass.dispatchEvent(new Event('timeupdate'))
  expect(director.getSnapshot().currentTrack?.id).toBe('gallery-nuvole-bianche')
  expect(scheduled).toHaveLength(1)

  expect(director.previewNext()).toBe(true)
  expect(director.getSnapshot().currentTrack?.id).toBe('gallery-tres-notas')
  expect(scheduler.clearTimeout).toHaveBeenCalledOnce()
  expect(scheduled).toHaveLength(1)
  expect(scheduler.setTimeout).toHaveBeenCalledTimes(2)
  expect(gains[0]!.gain.cancelScheduledValues).toHaveBeenCalled()
  expect(gains[1]!.gain.cancelScheduledValues).toHaveBeenCalled()
  director.dispose()
})

it('skips a gallery track that reports a media error and keeps the diagnostic in its snapshot', () => {
  const { director, media } = directorHarness()
  director.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', revision: 1 })
  const glass = media.find((candidate) => candidate.src === '/music/gallery-glass.mp3')!
  glass.error = { code: 2, message: '404 Not Found' } as MediaError
  glass.dispatchEvent(new Event('error'))

  expect(director.getSnapshot()).toMatchObject({
    state: 'gallery', currentTrack: { id: 'gallery-nuvole-bianche' },
    error: expect.stringContaining('404 Not Found'),
  })
  expect(media.some((candidate) => candidate.src === '/music/gallery-tres-notas.mp3')).toBe(true)
  director.dispose()
})

it('treats autoplay rejection as a recoverable Intro error and does not retry on scene sync', async () => {
  const { director, media } = directorHarness()
  const state = playingFilmState()
  director.syncFilmState(state)
  media[0]!.play.mockRejectedValueOnce(new Error('autoplay blocked'))
  director.pause()
  director.resume()
  await Promise.resolve()
  await Promise.resolve()
  const playCount = media[0]!.play.mock.calls.length

  director.syncFilmState({ ...state, scene: 'growth', elapsed: 12, revision: 2 })
  expect(director.getSnapshot()).toMatchObject({ state: 'silent', error: 'autoplay blocked' })
  expect(media[0]!.play).toHaveBeenCalledTimes(playCount)
  director.dispose()
})

it('ignores an asynchronous play rejection from an Intro slot after the slot is reused', async () => {
  const { director, media, scheduled } = directorHarness()
  const playing = playingFilmState()
  director.syncFilmState(playing)
  let rejectPlay: (error: Error) => void = () => undefined
  media[0]!.play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectPlay = reject }))
  director.pause()
  director.resume()
  director.syncFilmState({ ...playing, scene: 'gallery', mode: 'exploring', revision: 2 })
  scheduled[0]!.callback()
  rejectPlay(new Error('stale Intro playback failure'))
  await Promise.resolve()
  await Promise.resolve()

  expect(director.getSnapshot()).toMatchObject({
    state: 'gallery', currentTrack: { id: 'gallery-glass' }, nextTrack: { id: 'gallery-nuvole-bianche' }, error: null,
  })
  director.dispose()
})

it('keeps a current crossfade when the outgoing slot reports a late playback rejection', async () => {
  const { director, media, scheduled } = directorHarness()
  const playing = playingFilmState()
  director.syncFilmState(playing)
  let rejectPlay: (error: Error) => void = () => undefined
  media[0]!.play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectPlay = reject }))
  director.pause()
  director.resume()
  director.syncFilmState({ ...playing, scene: 'gallery', mode: 'exploring', revision: 2 })
  expect(scheduled).toHaveLength(1)

  rejectPlay(new Error('outgoing Intro ended'))
  await Promise.resolve()
  await Promise.resolve()
  expect(scheduled).toHaveLength(1)
  expect(director.getSnapshot()).toMatchObject({ state: 'gallery', currentTrack: { id: 'gallery-glass' } })
  director.dispose()
})

it('disposes both media channels and clears a pending crossfade timer', () => {
  const { director, media, channels, scheduler } = directorHarness()
  director.syncFilmState({ ...initialFilmState, scene: 'gallery', mode: 'exploring', revision: 1 })
  const glass = media.find((candidate) => candidate.src === '/music/gallery-glass.mp3')!
  glass.currentTime = glass.duration - 1
  glass.dispatchEvent(new Event('timeupdate'))
  expect(scheduler.setTimeout).toHaveBeenCalledOnce()
  director.dispose()

  expect(scheduler.clearTimeout).toHaveBeenCalledOnce()
  expect(channels.map((channel) => channel.dispose.mock.calls.length)).toEqual([1, 1])
  expect(media.every((element) => element.paused && element.src === '')).toBe(true)
})
