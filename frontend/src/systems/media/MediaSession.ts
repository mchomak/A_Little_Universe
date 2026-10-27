import { IndexedRecordingStore, type RecordingStore } from './RecordingStore'

export interface MediaOptions { gaze: boolean; recording: boolean; upload?: boolean }
export type RecordingStatus = 'idle' | 'ready' | 'recording' | 'stopping' | 'saved' | 'error'
export interface RecordingInfo {
  id: string
  createdAt: number
  mime: string
  status: 'recording' | 'complete' | 'incomplete'
  chunks: number
  bytes: number
  error?: string
}
export interface MediaSnapshot {
  options: MediaOptions
  preparing: boolean
  cameraStatus: 'idle' | 'ready' | 'error'
  cameraMessage: string
  recordingStatus: RecordingStatus
  error: string | null
  sessions: RecordingInfo[]
  activeSessionId: string | null
  uploadAvailable: false
}
export interface MediaEnvironment {
  isSecureContext: boolean
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createStream: (tracks: MediaStreamTrack[]) => MediaStream
  Recorder?: typeof MediaRecorder
  lifecycle?: EventTarget
}

const live = (track: MediaStreamTrack) => track.readyState === 'live'
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop())
const browserEnvironment = (): MediaEnvironment => ({
  isSecureContext: globalThis.isSecureContext === true,
  ...(typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' ? { getUserMedia: (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints) } : {}),
  createStream: (tracks) => new MediaStream(tracks),
  ...(typeof MediaRecorder !== 'undefined' ? { Recorder: MediaRecorder } : {}),
  ...(typeof window !== 'undefined' ? { lifecycle: window } : {}),
})

interface RecordingRun {
  info: RecordingInfo
  recorder: MediaRecorder
  queue: Promise<void>
  pending: number
  pendingBytes: number
  failed: string | null
  storageFailed: boolean
  accepting: boolean
  stopped: Promise<void>
  resolveStopped: () => void
  finishing: Promise<void> | null
  removeListeners: () => void
}
const supportedMime = (Recorder: typeof MediaRecorder | undefined): string | undefined =>
  ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((mime) => Recorder?.isTypeSupported(mime))

/** One application-lifetime owner. prepare never records; only start may record. */
export class MediaSession {
  private readonly environment: MediaEnvironment
  private readonly store: RecordingStore
  private listeners = new Set<() => void>()
  private stream: MediaStream | null = null
  private trackListeners = new Map<MediaStreamTrack, () => void>()
  private generation = 0
  private disposed = false
  private starting = false
  private run: RecordingRun | null = null
  private snapshot: MediaSnapshot = {
    options: { gaze: false, recording: false, upload: false }, preparing: false,
    cameraStatus: 'idle', cameraMessage: '', recordingStatus: 'idle', error: null,
    sessions: [], activeSessionId: null, uploadAvailable: false,
  }

  constructor(config: { environment?: MediaEnvironment; store?: RecordingStore } = {}) {
    this.environment = config.environment ?? browserEnvironment()
    this.store = config.store ?? new IndexedRecordingStore()
    this.environment.lifecycle?.addEventListener('pagehide', this.onPageHide)
  }
  getSnapshot = (): MediaSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private publish(patch: Partial<MediaSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((listener) => listener()) }
  getVideoStream(): MediaStream | null { return this.stream }
  private onPageHide = () => {
    this.generation++
    if (this.run) this.fail(this.run, 'Страница была закрыта или скрыта браузером. Последние фрагменты могли не сохраниться; файл может быть неполным.')
    this.releaseTracks(this.stream?.getTracks() ?? [])
    this.stream = null
    this.publish({ preparing: false, cameraStatus: 'idle' })
  }
  private watchTrack(track: MediaStreamTrack) {
    const ended = () => {
      const message = track.kind === 'video' ? 'Камера отключена. Запись остановлена; последние фрагменты могут отсутствовать.' : 'Микрофон отключён. Запись остановлена; последние фрагменты могут отсутствовать.'
      if (track.kind === 'video') this.publish({ cameraStatus: 'error' })
      if (this.run) this.fail(this.run, message)
      else {
        this.generation++
        this.releaseTracks([track])
        this.releaseAfterRecording()
        this.publish({ preparing: false, recordingStatus: this.snapshot.options.recording ? 'error' : 'idle', error: message })
      }
    }
    track.addEventListener('ended', ended)
    this.trackListeners.set(track, () => track.removeEventListener('ended', ended))
  }
  private releaseTracks(tracks: MediaStreamTrack[]) {
    ;[...tracks].forEach((track) => { this.trackListeners.get(track)?.(); this.trackListeners.delete(track); track.stop(); this.stream?.removeTrack(track) })
  }

  setOptions(options: MediaOptions): void {
    if (this.disposed) return
    this.generation++
    this.publish({ options: { gaze: options.gaze, recording: options.recording, upload: false }, preparing: false, error: null })
    if (!options.recording) {
      void this.stop()
      this.releaseTracks(this.stream?.getAudioTracks() ?? [])
      if (!this.run) this.publish({ recordingStatus: 'idle' })
    }
    if (!options.recording && !options.gaze) {
      this.releaseTracks(this.stream?.getTracks() ?? []); this.stream = null
      this.publish({ cameraStatus: 'idle', cameraMessage: '' })
    }
  }

  async prepare(): Promise<boolean> {
    if (this.disposed) return false
    if (this.run || this.starting) return this.snapshot.recordingStatus === 'recording'
    const generation = ++this.generation
    const { options } = this.snapshot
    if (!options.gaze && !options.recording) return true
    this.publish({ preparing: true, error: null })
    try {
      if (!this.environment.isSecureContext || !this.environment.getUserMedia) throw new Error('Камера недоступна: нужен защищённый адрес и поддержка браузера. Фильм продолжится без неё.')
      const acquire = async (constraints: MediaStreamConstraints) => {
        const acquired = await this.environment.getUserMedia!(constraints)
        if (this.disposed || generation !== this.generation) { stopTracks(acquired); return false }
        if (!this.stream) this.stream = this.environment.createStream([])
        acquired.getTracks().forEach((track) => { this.stream!.addTrack(track); this.watchTrack(track) })
        return true
      }
      if (!this.stream?.getVideoTracks().some(live) && !await acquire({ video: { facingMode: { ideal: 'user' } }, audio: false })) return false
      const video = this.stream?.getVideoTracks().find(live)
      if (!video) throw new Error('Нет активного видеопотока. Фильм продолжится без камеры.')
      const facing = video.getSettings().facingMode
      if (facing && facing !== 'user') throw new Error('Фронтальная камера не найдена. Запись отключена; фильм продолжится.')
      this.publish({ cameraStatus: 'ready', cameraMessage: facing === 'user' ? 'Фронтальная камера готова. Трекер взгляда ещё не подключён.' : 'Видеопоток готов; браузер не сообщил, фронтальная ли камера. Трекер ещё не подключён.' })
      if (options.recording) {
        if (!this.stream?.getAudioTracks().some(live) && !await acquire({ video: false, audio: true })) return false
        if (!this.stream?.getAudioTracks().some(live)) throw new Error('Нет активного микрофона. Запись видео со звуком недоступна.')
        if (!this.stream.getVideoTracks().some(live)) throw new Error('Камера отключилась во время проверки. Запись недоступна; фильм продолжится.')
        if (!supportedMime(this.environment.Recorder)) throw new Error('Этот браузер не поддерживает подходящий формат записи. Фильм доступен без неё.')
        this.publish({ recordingStatus: 'ready' })
      }
      return true
    } catch (error) {
      if (generation === this.generation && !this.disposed) {
        this.releaseTracks(this.stream?.getTracks() ?? []); this.stream = null
        this.publish({ cameraStatus: 'error', recordingStatus: options.recording ? 'error' : 'idle', error: error instanceof Error && error.name !== 'NotAllowedError' ? error.message : 'Доступ к камере или микрофону не разрешён. Фильм продолжится без записи.' })
      }
      return false
    } finally {
      if (generation === this.generation && !this.disposed) this.publish({ preparing: false })
    }
  }
  private updateInfo(info: RecordingInfo) { this.publish({ sessions: [info, ...this.snapshot.sessions.filter((entry) => entry.id !== info.id)] }) }
  async start(): Promise<boolean> {
    if (this.disposed || this.starting || this.run || !this.snapshot.options.recording || this.snapshot.preparing || this.snapshot.recordingStatus !== 'ready') return false
    const Recorder = this.environment.Recorder
    const mime = supportedMime(Recorder)
    if (!Recorder || !mime || !this.stream?.getVideoTracks().some(live) || !this.stream.getAudioTracks().some(live)) {
      this.publish({ recordingStatus: 'error', error: 'Камера или микрофон больше недоступны. Запись не начата.' }); return false
    }
    this.starting = true
    const generation = this.generation
    const info: RecordingInfo = { id: crypto.randomUUID(), createdAt: Date.now(), mime, status: 'recording', chunks: 0, bytes: 0 }
    try {
      await this.store.create(info)
      if (this.disposed || generation !== this.generation || !this.snapshot.options.recording) { await this.store.delete(info.id); return false }
      const recorder = new Recorder(this.stream, { mimeType: mime, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 })
      let resolveStopped = () => {}
      const stopped = new Promise<void>((resolve) => { resolveStopped = resolve })
      const run: RecordingRun = { info, recorder, queue: Promise.resolve(), pending: 0, pendingBytes: 0, failed: null, storageFailed: false, accepting: true, stopped, resolveStopped, finishing: null, removeListeners: () => {} }
      const data = (event: BlobEvent) => {
        const blob = event.data
        if (!blob.size || !run.accepting) return
        if (run.pending >= 8 || run.pendingBytes + blob.size > 32 * 1024 * 1024) { run.accepting = false; this.fail(run, 'Хранилище не успевает сохранять фрагменты. Запись остановлена; доступны только подтверждённые части.'); return }
        run.pending++; run.pendingBytes += blob.size
        run.queue = run.queue.then(async () => {
          if (run.storageFailed) return
          try { run.info = await this.store.append(info.id, blob); this.updateInfo(run.info) }
          catch { run.storageFailed = true; run.accepting = false; this.fail(run, 'Не удалось сохранить фрагмент: возможно, закончилось место. Уже сохранённые части доступны для восстановления.') }
        }).finally(() => { run.pending--; run.pendingBytes -= blob.size })
      }
      const stop = () => { run.resolveStopped(); void this.stop() }
      const error = () => this.fail(run, 'Браузер прервал запись. Сохранённые фрагменты доступны для восстановления.')
      recorder.addEventListener('dataavailable', data)
      recorder.addEventListener('stop', stop)
      recorder.addEventListener('error', error)
      run.removeListeners = () => { recorder.removeEventListener('dataavailable', data); recorder.removeEventListener('stop', stop); recorder.removeEventListener('error', error) }
      this.run = run
      recorder.start(4000)
      this.updateInfo(info)
      this.publish({ recordingStatus: 'recording', activeSessionId: info.id, error: null })
      return true
    } catch {
      this.publish({ recordingStatus: 'error', error: 'Запись не начата: формат или локальное хранилище недоступны. Фильм продолжится.' })
      if (this.run) { this.run.failed = this.snapshot.error; this.run.resolveStopped(); await this.stop() }
      else { this.releaseAfterRecording() }
      return false
    } finally { this.starting = false }
  }
  private fail(run: RecordingRun, message: string) {
    if (!run.failed) { run.failed = message; this.publish({ error: message }); void this.stop() }
  }
  private releaseAfterRecording() {
    this.releaseTracks(this.stream?.getAudioTracks() ?? [])
    if (!this.snapshot.options.gaze) { this.releaseTracks(this.stream?.getTracks() ?? []); this.stream = null; this.publish({ cameraStatus: 'idle' }) }
  }
  async stop(): Promise<void> {
    const run = this.run
    if (!run) {
      this.generation++
      this.publish({ preparing: false })
      this.releaseAfterRecording()
      return
    }
    if (run.finishing) return run.finishing
    this.publish({ recordingStatus: 'stopping' })
    // Defer stop so repeated stop events all observe the same finalization promise.
    run.finishing = Promise.resolve().then(async () => {
      try { if (run.recorder.state !== 'inactive') run.recorder.stop(); else run.resolveStopped() }
      catch { run.failed ??= 'Не удалось корректно завершить запись. Последние фрагменты могут отсутствовать.'; run.resolveStopped() }
      await run.stopped
      await run.queue
      if (!run.info.chunks) run.failed ??= 'Браузер не сохранил ни одного фрагмента записи.'
      try { run.info = await this.store.finalize(run.info.id, run.failed ? 'incomplete' : 'complete', run.failed ?? undefined); this.updateInfo(run.info) }
      catch {
        run.failed ??= 'Не удалось подтвердить завершение в хранилище. Доступна неполная запись.'
        this.updateInfo({ ...run.info, status: 'incomplete', error: run.failed })
      }
      run.removeListeners()
      this.run = null
      this.releaseAfterRecording()
      this.publish({ activeSessionId: null, recordingStatus: run.failed ? 'error' : 'saved', error: run.failed })
    })
    return run.finishing
  }
  async restore(): Promise<void> {
    try {
      const sessions = await this.store.list()
      if (!this.disposed) this.publish({ sessions: sessions.map((info) => info.id === this.run?.info.id || info.status !== 'recording' ? info : { ...info, status: 'incomplete' }) })
    } catch { if (!this.disposed) this.publish({ error: 'Локальное хранилище недоступно. Прошлые записи сейчас нельзя проверить.' }) }
  }
  async export(id: string): Promise<{ blob: Blob; filename: string; incomplete: boolean }> {
    if (this.run?.info.id === id) await this.stop()
    const { info, chunks } = await this.store.read(id)
    if (!chunks.length) throw new Error('Нет сохранённых фрагментов для экспорта.')
    const extension = info.mime.includes('mp4') ? 'mp4' : 'webm'
    return { blob: new Blob(chunks, { type: info.mime }), filename: `reaction-${new Date(info.createdAt).toISOString().replaceAll(':', '-')}.${extension}`, incomplete: info.status !== 'complete' }
  }
  async delete(id: string): Promise<void> {
    if (this.run?.info.id === id) await this.stop()
    await this.store.delete(id)
    this.publish({ sessions: this.snapshot.sessions.filter((info) => info.id !== id) })
  }
  async dispose(): Promise<void> {
    this.disposed = true; this.generation++
    this.environment.lifecycle?.removeEventListener('pagehide', this.onPageHide)
    await this.stop()
    this.releaseTracks(this.stream?.getTracks() ?? []); this.stream = null; this.store.close(); this.listeners.clear()
  }
}
