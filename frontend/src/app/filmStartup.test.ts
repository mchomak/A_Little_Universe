import { expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { LilyParticlePreparationManager, createLilyParticleGeometrySetup, prepareLilyParticleGeometryForStart } from '../scenes/lily/lilyParticlePreparation'
import type { LilySurfaceSource } from '../scenes/lily/particleSource'
import type { LilyGeometryWorkerSuccess } from '../scenes/lily/lilyGeometryWorkerClient'
import { MediaSession, type RecordingInfo } from '../systems/media/MediaSession'
import type { RecordingStore } from '../systems/media/RecordingStore'
import { openGift } from './openGift'
import { awaitFilmStartup, startPreparedFilm } from './filmStartup'

it('keeps gift-opening failures distinct from particle-preparation failures', async () => {
  const audioFailure = new Error('Audio unavailable')
  const workerFailure = new Error('Worker unavailable')

  await expect(awaitFilmStartup(Promise.reject(audioFailure), Promise.resolve()))
    .rejects.toMatchObject({ source: 'gift', reason: audioFailure })
  await expect(awaitFilmStartup(Promise.resolve(), Promise.reject(workerFailure)))
    .rejects.toMatchObject({ source: 'particles', reason: workerFailure })
})

it('waits for the current scene 04 geometry before mounting the film', async () => {
  const workers: Array<{ resolve(result: LilyGeometryWorkerSuccess): void }> = []
  const manager = createPreparationManager((attempt) => {
    if (attempt === 1) return Promise.resolve({ ok: true, attributes: { position: { array: new Float32Array([1]), itemSize: 1 } } })
    return new Promise<LilyGeometryWorkerSuccess>((resolve) => { workers.push({ resolve }) })
  })
  const previousInput = preparationInput(1280)
  const previous = await manager.prepare(previousInput)
  const previousGeometry = previous.geometry
  const currentInput = preparationInput(1281)
  const currentSetup = createLilyParticleGeometrySetup({ ...currentInput, bloomClipDuration: 16 })
  const events: string[] = []
  const mountFilm = vi.fn(() => { events.push('film-mounted') })
  const start = startPreparedFilm({
    startGift: () => openGift({
      audio: { unlock: async () => { events.push('audio-unlocked'); return true } },
      media: {
        getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'ready' }),
        start: async () => { events.push('recording-started'); return true },
      },
      onStart: () => undefined,
    }),
    prepareParticles: () => prepareLilyParticleGeometryForStart(manager, () => currentInput, () => true),
    stopRecording: async () => { events.push('recording-stopped') },
    isCurrent: () => true,
    onReady: mountFilm,
  })

  await vi.waitFor(() => expect(workers).toHaveLength(1))
  expect(previous.status).toBe('ready')
  expect(previous.key).not.toBe(currentSetup.key)
  expect(previousGeometry?.attributes.position?.array[0]).toBe(1)
  expect(manager.getSnapshot()).toEqual({ status: 'preparing', key: currentSetup.key })
  expect(events).toEqual(['audio-unlocked', 'recording-started'])
  expect(mountFilm).not.toHaveBeenCalled()

  const currentGeometry: LilyGeometryWorkerSuccess = { ok: true, attributes: { position: { array: new Float32Array([2]), itemSize: 1 } } }
  workers[0]!.resolve(currentGeometry)
  await start

  expect(manager.getForKey(currentSetup.key)?.geometry).toBe(currentGeometry)
  expect(mountFilm).toHaveBeenCalledOnce()
  expect(events).toEqual(['audio-unlocked', 'recording-started', 'film-mounted'])
})

it('stops an already-started recording when current scene 04 geometry fails', async () => {
  const workers: Array<{ reject(reason: Error): void }> = []
  const manager = createPreparationManager(() => {
    return new Promise<LilyGeometryWorkerSuccess>((_resolve, reject) => { workers.push({ reject }) })
  })
  const events: string[] = []
  const mountFilm = vi.fn(() => { events.push('film-mounted') })
  const media = await createRecordingMedia()
  const stopRecording = vi.fn(() => media.stop())
  const start = startPreparedFilm({
    startGift: () => openGift({
      audio: { unlock: async () => { events.push('audio-unlocked'); return true } },
      media,
      onStart: () => undefined,
    }),
    prepareParticles: () => prepareLilyParticleGeometryForStart(manager, () => preparationInput(1280), () => true),
    stopRecording,
    isCurrent: () => true,
    onReady: mountFilm,
  })

  await vi.waitFor(() => expect(StartupTestRecorder.latest?.state).toBe('recording'))
  const recorder = StartupTestRecorder.latest!
  const stopRecorder = vi.spyOn(recorder, 'stop')
  expect(media.getSnapshot()).toMatchObject({ recordingStatus: 'recording', activeSessionId: expect.any(String) })
  await vi.waitFor(() => expect(workers).toHaveLength(1))
  const failure = new Error('Worker unavailable')
  workers[0]!.reject(failure)

  await expect(start).rejects.toMatchObject({ source: 'particles', reason: failure })
  expect(stopRecording).toHaveBeenCalledOnce()
  expect(media.getSnapshot()).toMatchObject({ recordingStatus: 'error', activeSessionId: null })
  expect(stopRecorder).toHaveBeenCalledOnce()
  expect(recorder.state).toBe('inactive')
  expect(mountFilm).not.toHaveBeenCalled()
  expect(events).toEqual(['audio-unlocked'])
  await media.dispose()
})

function preparationInput(width: number) {
  return {
    config: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG,
      scenes: {
        ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 },
      },
    },
    width,
    height: 640,
    reducedMotion: false,
  }
}

function createPreparationManager(createGeometry: (attempt: number) => Promise<LilyGeometryWorkerSuccess>) {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
    sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
    sample: () => [0, 0, 0],
  }
  let attempt = 0
  return new LilyParticlePreparationManager({
    loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
    captureSource: async () => ({ source, bloomClipDuration: 16 }),
    createWorker: () => {
      attempt++
      return { promise: createGeometry(attempt), cancel: vi.fn() }
    },
  })
}

async function createRecordingMedia() {
  const tracks = [createTrack('video'), createTrack('audio')]
  const store = new StartupMemoryStore()
  const session = new MediaSession({
    store,
    environment: {
      isSecureContext: true,
      getUserMedia: async (constraints) => createStream(tracks.filter((track) => constraints.video ? track.kind === 'video' : track.kind === 'audio')),
      createStream,
      Recorder: StartupTestRecorder as unknown as typeof MediaRecorder,
    },
  })
  session.setOptions({ gaze: false, recording: true })
  expect(await session.prepare()).toBe(true)
  return session
}

function createTrack(kind: 'audio' | 'video') {
  const value = new EventTarget() as MediaStreamTrack
  Object.assign(value, {
    kind,
    readyState: 'live',
    getSettings: () => ({ facingMode: 'user' }),
    stop: () => Object.assign(value, { readyState: 'ended' }),
  })
  return value
}

function createStream(initialTracks: MediaStreamTrack[]): MediaStream {
  const tracks = [...initialTracks]
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
    addTrack: (track: MediaStreamTrack) => tracks.push(track),
    removeTrack: (track: MediaStreamTrack) => tracks.splice(tracks.indexOf(track), 1),
  } as unknown as MediaStream
}

class StartupTestRecorder extends EventTarget {
  static latest: StartupTestRecorder
  static isTypeSupported = () => true
  state = 'inactive'
  mimeType = 'video/webm;codecs=vp9,opus'

  constructor() {
    super()
    StartupTestRecorder.latest = this
  }

  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.dispatchEvent(new Event('stop')) }
}

class StartupMemoryStore implements RecordingStore {
  private readonly entries = new Map<string, RecordingInfo>()
  async create(info: RecordingInfo) { this.entries.set(info.id, { ...info }) }
  async append(id: string, blob: Blob) {
    const info = this.entries.get(id)!
    const next = { ...info, chunks: info.chunks + 1, bytes: info.bytes + blob.size }
    this.entries.set(id, next)
    return next
  }
  async finalize(id: string, status: 'complete' | 'incomplete', error?: string) {
    const next = { ...this.entries.get(id)!, status, ...(error ? { error } : {}) }
    this.entries.set(id, next)
    return next
  }
  async list() { return [...this.entries.values()] }
  async read(id: string) { return { info: this.entries.get(id)!, chunks: [] } }
  async delete(id: string) { this.entries.delete(id) }
  close() {}
}
