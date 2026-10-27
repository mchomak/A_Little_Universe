import { expect, it, vi } from 'vitest'
import { MediaSession } from './MediaSession'

it('does not record without explicit current consent', async () => {
  const session = new MediaSession()
  expect(await session.start()).toBe(false)
})

function track(kind: 'audio' | 'video') {
  const value = new EventTarget() as MediaStreamTrack
  Object.assign(value, { kind, readyState: 'live', getSettings: () => ({ facingMode: 'user' }), stop: vi.fn(() => Object.assign(value, { readyState: 'ended' })) })
  return value
}

function stream(tracks: MediaStreamTrack[]): MediaStream {
  return { getTracks: () => tracks, getVideoTracks: () => tracks.filter((t) => t.kind === 'video'), getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'), addTrack: (t: MediaStreamTrack) => tracks.push(t), removeTrack: (t: MediaStreamTrack) => tracks.splice(tracks.indexOf(t), 1) } as unknown as MediaStream
}

class FakeRecorder extends EventTarget {
  static isTypeSupported = () => true
  static latest: FakeRecorder
  state = 'inactive'
  mimeType = 'video/webm;codecs=vp9,opus'
  timeslice = 0
  constructor() { super(); FakeRecorder.latest = this }
  start(timeslice: number) { this.timeslice = timeslice; this.state = 'recording' }
  chunk(text: string) { this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob([text]) })) }
  stop() { this.state = 'inactive'; this.chunk('end'); this.dispatchEvent(new Event('stop')) }
}
const Recorder = FakeRecorder as unknown as typeof MediaRecorder

class MemoryStore {
  entries = new Map<string, { info: import('./MediaSession').RecordingInfo; chunks: Blob[] }>()
  async create(info: import('./MediaSession').RecordingInfo) { this.entries.set(info.id, { info: { ...info }, chunks: [] }) }
  async append(id: string, blob: Blob) {
    const entry = this.entries.get(id)!
    entry.chunks.push(blob)
    entry.info = { ...entry.info, chunks: entry.info.chunks + 1, bytes: entry.info.bytes + blob.size }
    return { ...entry.info }
  }
  async finalize(id: string, status: 'complete' | 'incomplete', error?: string) {
    const entry = this.entries.get(id)!
    entry.info = { ...entry.info, status, ...(error ? { error } : {}) }
    return { ...entry.info }
  }
  async list() { return [...this.entries.values()].map((entry) => ({ ...entry.info })) }
  async read(id: string) { const entry = this.entries.get(id); if (!entry) throw new Error('missing'); return { info: { ...entry.info }, chunks: [...entry.chunks] } }
  async delete(id: string) { this.entries.delete(id) }
  close() {}
}

function recordingSession(store = new MemoryStore()) {
  const video = track('video'); const audio = track('audio')
  const session = new MediaSession({ store, environment: { isSecureContext: true, getUserMedia: async (constraints) => stream(constraints.video ? [video] : [audio]), createStream: stream, Recorder } })
  session.setOptions({ gaze: false, recording: true })
  return { session, store, video, audio }
}

it('prepares only on deliberate request and reuses front video when microphone consent is added', async () => {
  const video = track('video')
  const audio = track('audio')
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => stream(constraints.video ? [video] : [audio]))
  const session = new MediaSession({ environment: { isSecureContext: true, getUserMedia, createStream: stream, Recorder } })
  session.setOptions({ gaze: true, recording: false })
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(await session.prepare()).toBe(true)
  expect(getUserMedia.mock.calls[0]?.[0]).toEqual({ video: { facingMode: { ideal: 'user' } }, audio: false })
  session.setOptions({ gaze: true, recording: true })
  await session.prepare()
  expect(getUserMedia.mock.calls[1]?.[0]).toEqual({ video: false, audio: true })
  expect(session.getVideoStream()?.getVideoTracks()).toEqual([video])
  expect(session.getSnapshot().recordingStatus).not.toBe('recording')
  await session.dispose()
  expect(video.stop).toHaveBeenCalledOnce()
  expect(audio.stop).toHaveBeenCalledOnce()
})

it('commits ordered chunks and the final chunk before reporting saved and exports only durable data', async () => {
  const { session, store, video, audio } = recordingSession()
  await session.prepare()
  expect(await session.start()).toBe(true)
  expect(FakeRecorder.latest.timeslice).toBe(4000)
  FakeRecorder.latest.chunk('one'); FakeRecorder.latest.chunk('two')
  await session.stop()
  expect(session.getSnapshot().recordingStatus).toBe('saved')
  const saved = session.getSnapshot().sessions[0]!
  expect(saved.status).toBe('complete')
  expect(saved.chunks).toBe(3)
  const exported = await session.export(saved.id)
  expect(await exported.blob.text()).toBe('onetwoend')
  expect(exported.incomplete).toBe(false)
  expect((await store.list())[0]?.bytes).toBe(9)
  expect(video.stop).toHaveBeenCalledOnce(); expect(audio.stop).toHaveBeenCalledOnce()
  await session.delete(saved.id)
  expect(await store.list()).toEqual([])
  await session.dispose()
})

it('stops with an incomplete recovery when the camera is revoked during recording', async () => {
  const { session, video } = recordingSession()
  await session.prepare(); await session.start()
  FakeRecorder.latest.chunk('kept')
  Object.assign(video, { readyState: 'ended' }); video.dispatchEvent(new Event('ended'))
  await session.stop()
  expect(session.getSnapshot().recordingStatus).toBe('error')
  expect(session.getSnapshot().sessions[0]?.status).toBe('incomplete')
  expect(session.getSnapshot().error).toContain('Камера')
  await session.dispose()
})

it('marks pagehide as interrupted, releases devices and restores durable parts without restoring consent', async () => {
  const store = new MemoryStore(); const lifecycle = new EventTarget()
  const video = track('video'); const audio = track('audio')
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => stream(constraints.video ? [video] : [audio]))
  const session = new MediaSession({ store, environment: { isSecureContext: true, getUserMedia, createStream: stream, Recorder, lifecycle } })
  session.setOptions({ gaze: true, recording: true }); await session.prepare(); await session.start()
  FakeRecorder.latest.chunk('before')
  lifecycle.dispatchEvent(new Event('pagehide'))
  await session.stop()
  expect(session.getSnapshot().sessions[0]?.status).toBe('incomplete')
  expect(video.stop).toHaveBeenCalledOnce()
  const restored = new MediaSession({ store })
  await restored.restore()
  expect(restored.getSnapshot().options).toEqual({ gaze: false, recording: false, upload: false })
  expect(getUserMedia).toHaveBeenCalledTimes(2)
  const result = await restored.export(restored.getSnapshot().sessions[0]!.id)
  expect(result.incomplete).toBe(true)
  expect(await result.blob.text()).toContain('before')
  expect(await restored.start()).toBe(false)
  await session.dispose(); await restored.dispose()
})

it('cancels pending permission on stop and disposes a late grant without opening a microphone', async () => {
  const video = track('video')
  let grant: (value: MediaStream) => void = () => {}
  const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { grant = resolve }))
  const session = new MediaSession({ environment: { isSecureContext: true, getUserMedia, createStream: stream, Recorder } })
  session.setOptions({ gaze: false, recording: true })
  const pending = session.prepare()
  await session.stop()
  grant(stream([video]))
  expect(await pending).toBe(false)
  expect(video.stop).toHaveBeenCalledOnce()
  expect(getUserMedia).toHaveBeenCalledOnce()
  expect(session.getVideoStream()).toBeNull()
  expect(session.getSnapshot().preparing).toBe(false)
  await session.dispose()
})

it('preserves earlier committed data after quota failure and never reports the failed chunk saved', async () => {
  const { session, store } = recordingSession()
  const append = store.append.bind(store)
  store.append = vi.fn(async (id: string, blob: Blob) => {
    if ((await blob.text()) === 'lost') throw new DOMException('full', 'QuotaExceededError')
    return append(id, blob)
  })
  await session.prepare(); await session.start()
  FakeRecorder.latest.chunk('kept')
  await vi.waitFor(() => expect(session.getSnapshot().sessions[0]?.chunks).toBe(1))
  FakeRecorder.latest.chunk('lost')
  await vi.waitFor(() => expect(session.getSnapshot().recordingStatus).toBe('error'))
  const result = await session.export(session.getSnapshot().sessions[0]!.id)
  expect(result.incomplete).toBe(true)
  expect(await result.blob.text()).toBe('kept')
  expect(session.getSnapshot().error).toContain('место')
  await session.dispose()
})

it('does not claim ready if video ends while microphone permission is pending', async () => {
  const video = track('video'); const audio = track('audio')
  let grant: (value: MediaStream) => void = () => {}
  const getUserMedia = vi.fn((constraints: MediaStreamConstraints) => constraints.video ? Promise.resolve(stream([video])) : new Promise<MediaStream>((resolve) => { grant = resolve }))
  const session = new MediaSession({ environment: { isSecureContext: true, getUserMedia, createStream: stream, Recorder } })
  session.setOptions({ gaze: false, recording: true })
  const pending = session.prepare()
  await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
  Object.assign(video, { readyState: 'ended' }); video.dispatchEvent(new Event('ended'))
  grant(stream([audio]))
  expect(await pending).toBe(false)
  expect(session.getSnapshot().recordingStatus).toBe('error')
  expect(audio.stop).toHaveBeenCalledOnce()
  await session.dispose()
})

it('waits for durable finalization rather than announcing saved on a recorder stop event', async () => {
  const { session, store } = recordingSession()
  const finalize = store.finalize.bind(store)
  let commit: () => void = () => {}
  store.finalize = async (id, status, error) => {
    await new Promise<void>((resolve) => { commit = resolve })
    return finalize(id, status, error)
  }
  await session.prepare(); await session.start()
  const stopped = session.stop()
  await vi.waitFor(() => expect(session.getSnapshot().sessions[0]?.chunks).toBe(1))
  expect(session.getSnapshot().recordingStatus).toBe('stopping')
  commit(); await stopped
  expect(session.getSnapshot().recordingStatus).toBe('saved')
  await session.dispose()
})

it('denies microphone failure without blocking the app or leaving camera tracks behind', async () => {
  const video = track('video')
  const session = new MediaSession({ environment: { isSecureContext: true, getUserMedia: async (constraints) => {
    if (!constraints.video) throw new DOMException('denied', 'NotAllowedError')
    return stream([video])
  }, createStream: stream, Recorder } })
  session.setOptions({ gaze: true, recording: true, upload: true })
  expect(await session.prepare()).toBe(false)
  expect(await session.start()).toBe(false)
  expect(session.getSnapshot().uploadAvailable).toBe(false)
  expect(session.getSnapshot().options.upload).toBe(false)
  expect(session.getSnapshot().error).toContain('не разрешён')
  expect(video.stop).toHaveBeenCalledOnce()
  await session.dispose()
})

it('reports incomplete when the final metadata transaction cannot commit, while durable chunks remain exportable', async () => {
  const { session, store } = recordingSession()
  store.finalize = async () => { throw new DOMException('full', 'QuotaExceededError') }
  await session.prepare(); await session.start(); await session.stop()
  expect(session.getSnapshot().recordingStatus).toBe('error')
  expect(session.getSnapshot().sessions[0]?.status).toBe('incomplete')
  const result = await session.export(session.getSnapshot().sessions[0]!.id)
  expect(result.incomplete).toBe(true)
  expect(await result.blob.text()).toBe('end')
  await session.dispose()
})

it('releases unnecessary prepared devices on revocation while preserving only separately authorized live gaze video', async () => {
  for (const gaze of [false, true]) {
    for (const revoked of ['video', 'audio'] as const) {
      const { session, video, audio } = recordingSession()
      session.setOptions({ gaze, recording: true })
      expect(await session.prepare()).toBe(true)
      const lost = revoked === 'video' ? video : audio
      Object.assign(lost, { readyState: 'ended' }); lost.dispatchEvent(new Event('ended'))
      expect(audio.readyState).toBe('ended')
      expect(audio.stop).toHaveBeenCalledOnce()
      expect(session.getSnapshot().recordingStatus).toBe('error')
      expect(await session.start()).toBe(false)
      if (gaze && revoked === 'audio') {
        expect(video.readyState).toBe('live')
        expect(video.stop).not.toHaveBeenCalled()
        expect(session.getVideoStream()?.getVideoTracks()).toEqual([video])
      } else {
        expect(video.readyState).toBe('ended')
        expect(video.stop).toHaveBeenCalledOnce()
        expect(session.getVideoStream()?.getVideoTracks().some((track) => track.readyState === 'live') ?? false).toBe(false)
      }
      await session.dispose()
    }
  }
})
