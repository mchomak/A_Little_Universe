export type DesktopSource = 'camera' | 'microphone' | 'screen'
export type DesktopSourceStatus = 'idle' | 'starting' | 'recording' | 'saved' | 'error'
export type DesktopFinalizationStatus = 'idle' | 'pending' | 'finalizing' | 'complete' | 'partial' | 'error'
export interface DesktopFinalFile { status: 'saved' | 'partial' | 'error' | 'skipped'; path: string | null; bytes: number; durationMs?: number; error: string | null }
export interface DesktopRecoveryStatus { status: 'idle' | 'waiting' | 'paused' | 'recovering' | 'error'; pending: number; currentSessionId: string | null; error: string | null; failed: number; retryable: boolean }

export interface DesktopRecordingSnapshot {
  status: 'idle' | 'starting' | 'recording' | 'stopping' | 'saved' | 'error'
  sessionId: string | null
  folder: string | null
  startedAt: number | null
  durationMs: number
  freeBytes: number | null
  segmentCounts: Record<DesktopSource, number>
  sources: Record<DesktopSource, DesktopSourceStatus>
  errors: string[]
  finalizationStatus: DesktopFinalizationStatus
  finalizationFiles: Record<string, DesktopFinalFile>
  recovery: DesktopRecoveryStatus
}

interface DesktopRecordingStatus {
  directory: string
  elapsedMs: number
  freeBytes: number
  segmentCounts: Record<DesktopSource, number>
  errors: ({ message: string; source?: string } | string)[]
  finalization?: { status: DesktopFinalizationStatus; files: Record<string, DesktopFinalFile>; errors: string[] }
}

interface DesktopBridge {
  available: boolean
  createSession(): Promise<{ id: string; directory: string; startedAt: number }>
  openSegment(value: { sessionId: string; source: DesktopSource; sequence: number; mimeType: string; startedAt: number; timelineMs: number }): Promise<unknown>
  markSegmentStarted(value: { sessionId: string; source: DesktopSource; sequence: number; startedAt: number; timelineMs: number }): Promise<void>
  appendChunk(value: { sessionId: string; source: DesktopSource; sequence: number; bytes: ArrayBuffer; timelineMs: number }): Promise<void>
  closeSegment(value: { sessionId: string; source: DesktopSource; sequence: number; endedAt: number; error?: string }): Promise<void>
  reportError(value: { sessionId: string; source: DesktopSource; message: string }): Promise<void>
  finishSession(value: { sessionId: string }): Promise<unknown>
  getStatus(value: { sessionId: string }): Promise<DesktopRecordingStatus>
  openFolder(value: { sessionId: string }): Promise<unknown>
  getRecoveryStatus(): Promise<DesktopRecoveryStatus>
  retryRecovery(): Promise<DesktopRecoveryStatus>
  setFilmActive(active: boolean): Promise<void>
}

declare global { interface Window { desktopRecording?: DesktopBridge } }

interface SourceRun {
  source: DesktopSource
  stream: MediaStream
  mimeType: string
  recorder: MediaRecorder | null
  sequence: number
  startedAt: number
  pendingBytes: number
  queueOverflow: boolean
  recorderStopPending: boolean
  overflowTail: Blob | null
  overflowTailSequence: number | null
  overflowTailRejected: boolean
  queue: Promise<void>
  interval: ReturnType<typeof setInterval> | null
  error: string | null
  stopRequested: boolean
  segmentOpen: boolean
  transition: Promise<void> | null
  stopping: Promise<void> | null
  finalizing: Promise<void> | null
}

interface Environment {
  capture(source: DesktopSource): Promise<MediaStream>
  mimeFor(source: DesktopSource): string | null
  recorder(stream: MediaStream, source: DesktopSource, mimeType: string): MediaRecorder
  wallNow(): number
  monotonicNow(): number
  every(callback: () => void, delayMs: number): ReturnType<typeof setInterval>
  cancel(timer: ReturnType<typeof setInterval>): void
}

const SOURCES: DesktopSource[] = ['camera', 'microphone', 'screen']
const SOURCE_LABELS: Record<DesktopSource, string> = { camera: 'Камера', microphone: 'Микрофон', screen: 'Экран приложения' }
const SEGMENT_DURATION_MS = 60_000
const CHUNK_INTERVAL_MS = 1_000
const MAX_QUEUED_BYTES = 32 * 1024 * 1024

export const DISPLAY_CAPTURE_OPTIONS: DisplayMediaStreamOptions = {
  audio: false,
  video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 24 } },
}

function browserCapture(source: DesktopSource): Promise<MediaStream> {
  const devices = navigator.mediaDevices
  if (!devices) return Promise.reject(new Error('Медиазахват недоступен в этой версии приложения.'))
  if (source === 'camera') return devices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } })
  if (source === 'microphone') return devices.getUserMedia({ video: false, audio: { echoCancellation: true, noiseSuppression: true } })
  if (!devices.getDisplayMedia) return Promise.reject(new Error('Захват окна недоступен в этой версии приложения.'))
  return devices.getDisplayMedia(DISPLAY_CAPTURE_OPTIONS)
}

function mimeFor(source: DesktopSource): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = source === 'microphone'
    ? ['audio/webm;codecs=opus', 'audio/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null
}

function createBrowserEnvironment(): Environment {
  return {
    capture: browserCapture,
    mimeFor,
    recorder: (stream, source, mimeType) => new MediaRecorder(stream, {
      mimeType,
      ...(source === 'microphone' ? { audioBitsPerSecond: 128_000 } : { videoBitsPerSecond: source === 'camera' ? 2_000_000 : 4_000_000 }),
    }),
    wallNow: () => Date.now(), monotonicNow: () => performance.now(),
    every: (callback, delayMs) => setInterval(callback, delayMs), cancel: (timer) => clearInterval(timer),
  }
}

const initialSnapshot = (): DesktopRecordingSnapshot => ({
  status: 'idle', sessionId: null, folder: null, startedAt: null, durationMs: 0, freeBytes: null,
  segmentCounts: { camera: 0, microphone: 0, screen: 0 },
  sources: { camera: 'idle', microphone: 'idle', screen: 'idle' }, errors: [],
  finalizationStatus: 'idle', finalizationFiles: {},
  recovery: { status: 'idle', pending: 0, currentSessionId: null, error: null, failed: 0, retryable: false },
})

export class DesktopRecordingSession {
  private readonly bridge: DesktopBridge | undefined
  private readonly environment: Environment
  private listeners = new Set<() => void>()
  private snapshot = initialSnapshot()
  private runs = new Map<DesktopSource, SourceRun>()
  private pendingSources = new Set<DesktopSource>()
  private sessionMonotonicStart = 0
  private durationTimer: ReturnType<typeof setInterval> | null = null
  private startup: Promise<void> | null = null
  private stopping: Promise<void> | null = null
  private generation = 0
  private finalizedGeneration = -1
  private stopRequested = false

  constructor(options: { bridge?: DesktopBridge; environment?: Environment } = {}) {
    this.bridge = options.bridge ?? (typeof window === 'undefined' ? undefined : window.desktopRecording)
    this.environment = options.environment ?? createBrowserEnvironment()
  }

  get available() { return this.bridge?.available === true }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private publish(patch: Partial<DesktopRecordingSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((listener) => listener()) }
  private sourceStatus(source: DesktopSource, status: DesktopSourceStatus) { this.publish({ sources: { ...this.snapshot.sources, [source]: status } }) }

  private describeError(source: DesktopSource, error: unknown) {
    const isDomException = typeof DOMException !== 'undefined' && error instanceof DOMException
    const denied = isDomException && error.name === 'NotAllowedError'
    const setting = source === 'camera' ? 'Камеру' : source === 'microphone' ? 'Микрофон' : 'Запись экрана'
    const message = denied
      ? `${setting} не разрешена. В Системных настройках macOS откройте «Конфиденциальность и безопасность» и разрешите доступ приложению.`
      : isDomException && error.name === 'NotFoundError'
        ? `${setting} не обнаружена. Подключите устройство и повторите запуск.`
        : error instanceof Error ? error.message : String(error)
    return { message, display: `${SOURCE_LABELS[source]}: ${message}` }
  }

  private reportSourceError(source: DesktopSource, error: unknown, run?: SourceRun) {
    const { message, display } = this.describeError(source, error)
    if (run) run.error ??= message
    if (!this.snapshot.errors.includes(display)) this.publish({ errors: [...this.snapshot.errors, display] })
    this.sourceStatus(source, 'error')
    const sessionId = this.snapshot.sessionId
    if (this.bridge && sessionId) void this.bridge.reportError({ sessionId, source, message }).catch(() => undefined)
  }

  /** Must be called directly from the informed-consent click to retain getDisplayMedia's user activation. */
  start(): Promise<void> {
    if (!this.available || ['starting', 'recording', 'stopping'].includes(this.snapshot.status)) return Promise.resolve()
    if (this.stopping) return Promise.resolve()

    const generation = ++this.generation
    this.stopRequested = false
    this.runs.clear()
    this.pendingSources = new Set(SOURCES)
    this.publish(initialSnapshot())

    const wallStart = this.environment.wallNow()
    const monoStart = this.environment.monotonicNow()
    // Initiate all three capture calls synchronously in the consent gesture. In
    // particular, no disk or permission await precedes getDisplayMedia().
    const requests = Object.fromEntries(SOURCES.map((source) => {
      this.sourceStatus(source, 'starting')
      try { return [source, this.environment.capture(source)] }
      catch (error) { return [source, Promise.reject(error)] }
    })) as Record<DesktopSource, Promise<MediaStream>>
    this.publish({ status: 'starting', errors: [], startedAt: wallStart, durationMs: 0 })

    const startup = (async () => {
      let session: Awaited<ReturnType<DesktopBridge['createSession']>>
      try { session = await this.bridge!.createSession() }
      catch (error) {
        SOURCES.forEach((source) => { void requests[source].then((stream) => stream.getTracks().forEach((track) => track.stop()), () => undefined) })
        if (generation === this.generation) {
          this.pendingSources.clear()
          this.publish({ status: 'error', errors: [`disk: ${error instanceof Error ? error.message : String(error)}`] })
        }
        throw error
      }

      if (generation !== this.generation) {
        SOURCES.forEach((source) => { void requests[source].then((stream) => stream.getTracks().forEach((track) => track.stop()), () => undefined) })
        return
      }
      this.sessionMonotonicStart = monoStart
      this.publish({ sessionId: session.id, folder: session.directory, startedAt: session.startedAt })
      if (this.stopRequested) {
        SOURCES.forEach((source) => { void requests[source].then((stream) => stream.getTracks().forEach((track) => track.stop()), () => undefined) })
        this.pendingSources.clear()
        return
      }

      this.durationTimer = this.environment.every(() => {
        if (generation !== this.generation || this.stopRequested) return
        this.publish({ durationMs: Math.max(0, this.environment.monotonicNow() - this.sessionMonotonicStart) })
        void this.refreshStatus(generation)
      }, 1_000)

      SOURCES.forEach((source) => {
        void requests[source]
          .then((stream) => this.startSource(generation, source, stream), (error: unknown) => {
            if (this.isCurrent(generation) && !this.stopRequested) this.reportSourceError(source, error)
          })
          .finally(() => {
            if (!this.isCurrent(generation)) return
            this.pendingSources.delete(source)
            this.syncSessionStatus(generation)
            this.maybeFinishEmptySession(generation)
          })
      })
    })()
    this.startup = startup
    return startup.finally(() => { if (this.startup === startup) this.startup = null })
  }

  private isCurrent(generation: number) { return generation === this.generation }

  private async startSource(generation: number, source: DesktopSource, stream: MediaStream) {
    if (!this.isCurrent(generation) || this.stopRequested) {
      stream.getTracks().forEach((track) => track.stop())
      if (this.isCurrent(generation)) this.sourceStatus(source, 'idle')
      return
    }
    const mimeType = this.environment.mimeFor(source)
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop())
      this.reportSourceError(source, new Error('Запись этого источника в WebM не поддерживается.'))
      return
    }

    const run: SourceRun = {
      source, stream, mimeType, recorder: null, sequence: 0, startedAt: this.environment.wallNow(),
      pendingBytes: 0, queueOverflow: false, recorderStopPending: false, overflowTail: null,
      overflowTailSequence: null, overflowTailRejected: false, queue: Promise.resolve(), interval: null, error: null, stopRequested: false,
      segmentOpen: false, transition: null, stopping: null, finalizing: null,
    }
    this.runs.set(source, run)
    stream.getTracks().forEach((track) => track.addEventListener('ended', () => {
      void this.stopSource(run, 'Источник записи отключился.')
    }, { once: true }))
    const opening = this.openNextSegment(run, generation)
    run.transition = opening
    try { await opening }
    catch (error) { await this.stopSource(run, error) }
    finally { if (run.transition === opening) run.transition = null }

    if (run.stopRequested || this.stopRequested || !this.isCurrent(generation)) await this.stopSource(run)
    else this.syncSessionStatus(generation)
  }

  private async openNextSegment(run: SourceRun, generation = this.generation) {
    if (run.stopRequested || this.stopRequested || !this.runs.has(run.source) || !this.isCurrent(generation)) return
    const sequence = ++run.sequence
    const provisionalStart = this.environment.wallNow()
    const provisionalTimeline = Math.max(0, this.environment.monotonicNow() - this.sessionMonotonicStart)
    await this.bridge!.openSegment({ sessionId: this.snapshot.sessionId!, source: run.source, sequence, mimeType: run.mimeType.split(';')[0] ?? run.mimeType, startedAt: provisionalStart, timelineMs: provisionalTimeline })
    run.segmentOpen = true
    if (run.stopRequested || this.stopRequested || !this.isCurrent(generation)) return

    const recorder = this.environment.recorder(run.stream, run.source, run.mimeType)
    run.recorder = recorder
    recorder.addEventListener('error', () => {
      void this.stopSource(run, 'Медиарекордер сообщил об ошибке.')
    }, { once: true })
    let startedPersisted: Promise<void> = Promise.resolve()
    recorder.addEventListener('dataavailable', (event) => {
      if (!event.data.size) return
      if (run.queueOverflow) {
        if (run.recorderStopPending) this.rememberOverflowTail(run, sequence, event.data)
        return
      }
      const queueOverflow = run.pendingBytes + event.data.size > MAX_QUEUED_BYTES
      if (queueOverflow) {
        run.queueOverflow = true
        this.reportSourceError(run.source, 'Диск не успевает записывать данные. Источник остановлен; уже принятые данные сохраняются.', run)
        // If a stop is already in flight, this may be a queued dataavailable
        // event before the final one. Keep only the last bounded candidate
        // until the recorder's following `stop` event confirms event ordering.
        if (run.recorderStopPending) this.rememberOverflowTail(run, sequence, event.data)
        // Stop immediately; the latch rejects any further event data while the
        // accepted queue drains. One bounded tail candidate may be retained
        // during stop and the partial segment always remains marked as error.
        void this.stopSource(run)
        return
      }
      const timelineMs = Math.max(0, this.environment.monotonicNow() - this.sessionMonotonicStart)
      this.enqueueChunk(run, sequence, event.data, timelineMs, startedPersisted)
    })
    const startedAt = this.environment.wallNow()
    const timelineMs = Math.max(0, this.environment.monotonicNow() - this.sessionMonotonicStart)
    recorder.start(CHUNK_INTERVAL_MS)
    run.startedAt = startedAt
    startedPersisted = this.bridge!.markSegmentStarted({ sessionId: this.snapshot.sessionId!, source: run.source, sequence, startedAt, timelineMs })
    await startedPersisted
    this.sourceStatus(run.source, 'recording')
    if (run.interval) this.environment.cancel(run.interval)
    run.interval = this.environment.every(() => { void this.rotate(run) }, SEGMENT_DURATION_MS)
  }

  private async stopRecorder(run: SourceRun) {
    const recorder = run.recorder
    if (!recorder || recorder.state === 'inactive') return
    await new Promise<void>((resolve, reject) => {
      run.recorderStopPending = true
      recorder.addEventListener('stop', () => {
        run.recorderStopPending = false
        // W3C MediaRecorder fires the final dataavailable immediately before
        // stop. Only now is the last bounded candidate known to be the final
        // event, rather than an arbitrary chunk that happened during stop.
        this.flushOverflowTail(run)
        resolve()
      }, { once: true })
      recorder.addEventListener('error', () => reject(new Error('MediaRecorder failed to stop')), { once: true })
      try { recorder.stop() }
      catch (error) { run.recorderStopPending = false; reject(error) }
    })
  }

  private rememberOverflowTail(run: SourceRun, sequence: number, blob: Blob) {
    run.overflowTail = null
    run.overflowTailSequence = null
    run.overflowTailRejected = false
    if (run.pendingBytes + blob.size > MAX_QUEUED_BYTES) {
      run.overflowTailRejected = true
      return
    }
    run.overflowTail = blob
    run.overflowTailSequence = sequence
  }

  private flushOverflowTail(run: SourceRun) {
    const tail = run.overflowTail
    const sequence = run.overflowTailSequence
    run.overflowTail = null
    run.overflowTailSequence = null
    if (tail && sequence !== null) {
      if (run.pendingBytes + tail.size <= MAX_QUEUED_BYTES) this.enqueueChunk(run, sequence, tail, Math.max(0, this.environment.monotonicNow() - this.sessionMonotonicStart))
      else run.overflowTailRejected = true
    }
    if (run.overflowTailRejected) {
      const message = 'Финальный фрагмент превышает доступный предел очереди. Сегмент неполный и может не воспроизводиться.'
      this.reportSourceError(run.source, message, run)
      if (run.error && !run.error.includes(message)) run.error = `${run.error} ${message}`
      run.overflowTailRejected = false
    }
  }

  private enqueueChunk(run: SourceRun, sequence: number, blob: Blob, timelineMs: number, startedPersisted: Promise<void> = Promise.resolve()) {
    run.pendingBytes += blob.size
    run.queue = run.queue.then(async () => {
      await startedPersisted
      const bytes = await blob.arrayBuffer()
      await this.bridge!.appendChunk({ sessionId: this.snapshot.sessionId!, source: run.source, sequence, bytes, timelineMs })
    }).catch((error: unknown) => {
      this.reportSourceError(run.source, error, run)
      run.stopRequested = true
      queueMicrotask(() => { void this.stopSource(run) })
    }).finally(() => { run.pendingBytes -= blob.size })
  }

  private async closeOpenSegment(run: SourceRun) {
    if (!run.segmentOpen) return
    try {
      await this.bridge!.closeSegment({ sessionId: this.snapshot.sessionId!, source: run.source, sequence: run.sequence, endedAt: this.environment.wallNow(), ...(run.error ? { error: run.error } : {}) })
      run.segmentOpen = false
    } catch (error) {
      this.reportSourceError(run.source, error, run)
      run.segmentOpen = false
    }
  }

  private rotate(run: SourceRun): Promise<void> | undefined {
    if (!this.runs.has(run.source) || run.transition || run.stopRequested || this.stopRequested) return
    const generation = this.generation
    const transition = (async () => {
      try {
        await this.stopRecorder(run)
        await run.queue
        await this.closeOpenSegment(run)
        if (run.error || run.stopRequested || this.stopRequested || !this.isCurrent(generation)) {
          await this.finishSource(run)
          return
        }
        await this.openNextSegment(run, generation)
        if (run.error || run.stopRequested || this.stopRequested || !this.isCurrent(generation)) await this.finishSource(run)
      } catch (error) {
        this.reportSourceError(run.source, error, run)
        run.stopRequested = true
        try { await this.stopRecorder(run) } catch { /* Preserve the partial segment for later recovery. */ }
        await run.queue
        await this.closeOpenSegment(run)
        await this.finishSource(run)
      }
    })()
    run.transition = transition
    return transition.finally(() => { if (run.transition === transition) run.transition = null })
  }

  private stopSource(run: SourceRun, error?: unknown): Promise<void> {
    if (!this.runs.has(run.source)) return Promise.resolve()
    if (error !== undefined) this.reportSourceError(run.source, error, run)
    run.stopRequested = true
    if (run.stopping) return run.stopping
    const stopping = (async () => {
      const transition = run.transition
      if (transition) { try { await transition } catch { /* The finalizer below closes what remains. */ } }
      if (!this.runs.has(run.source)) return
      if (run.interval) { this.environment.cancel(run.interval); run.interval = null }
      try { await this.stopRecorder(run) } catch { /* A failed recorder still leaves earlier chunks on disk. */ }
      await run.queue
      await this.finishSource(run)
    })()
    run.stopping = stopping
    return stopping
  }

  private finishSource(run: SourceRun): Promise<void> {
    if (run.finalizing) return run.finalizing
    const finalizing = (async () => {
      if (run.interval) { this.environment.cancel(run.interval); run.interval = null }
      try { await this.stopRecorder(run) }
      catch (error) { this.reportSourceError(run.source, error, run) }
      await run.queue
      await this.closeOpenSegment(run)
      run.stream.getTracks().forEach((track) => track.stop())
      this.runs.delete(run.source)
      this.sourceStatus(run.source, run.error ? 'error' : 'saved')
      this.syncSessionStatus(this.generation)
      this.maybeFinishEmptySession(this.generation)
    })()
    run.finalizing = finalizing
    return finalizing
  }

  private syncSessionStatus(generation: number) {
    if (!this.isCurrent(generation) || this.stopRequested || this.snapshot.status === 'stopping') return
    if (this.runs.size > 0) this.publish({ status: 'recording' })
    else if (this.pendingSources.size > 0) this.publish({ status: 'starting' })
  }

  private maybeFinishEmptySession(generation: number) {
    if (this.isCurrent(generation) && !this.stopRequested && this.snapshot.sessionId && this.runs.size === 0 && this.pendingSources.size === 0) void this.stop()
  }

  private async refreshStatus(generation: number) {
    const sessionId = this.snapshot.sessionId
    if (!sessionId || !this.bridge) return
    try {
      const status = await this.bridge.getStatus({ sessionId })
      if (generation !== this.generation || sessionId !== this.snapshot.sessionId) return
      const finalization = status.finalization
      const diskErrors = status.errors.map((entry) => typeof entry === 'string' ? entry : `${entry.source ? `${entry.source}: ` : ''}${entry.message}`)
      const errors = [...new Set([...this.snapshot.errors, ...diskErrors, ...(finalization?.errors ?? [])])]
      this.publish({
        folder: status.directory, freeBytes: status.freeBytes, segmentCounts: status.segmentCounts,
        durationMs: status.elapsedMs,
        ...(finalization ? { finalizationStatus: finalization.status, finalizationFiles: finalization.files } : {}),
        errors,
      })
    } catch (error) {
      if (generation !== this.generation || sessionId !== this.snapshot.sessionId) return
      const message = `disk: ${error instanceof Error ? error.message : String(error)}`
      if (!this.snapshot.errors.includes(message)) this.publish({ errors: [...this.snapshot.errors, message] })
    }
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping
    if (this.finalizedGeneration === this.generation) return Promise.resolve()
    if (!this.snapshot.sessionId && !this.startup) return Promise.resolve()
    const generation = this.generation
    this.stopRequested = true
    this.publish({ status: 'stopping' })
    for (const source of this.pendingSources) {
      if (!this.runs.has(source)) this.sourceStatus(source, 'idle')
    }
    this.pendingSources.clear()
    if (this.durationTimer) { this.environment.cancel(this.durationTimer); this.durationTimer = null }

    const stopping = (async () => {
      if (this.startup) { try { await this.startup } catch { /* Startup failures are already surfaced by start(). */ } }
      if (!this.isCurrent(generation) || !this.snapshot.sessionId || !this.bridge) return
      await Promise.all([...this.runs.values()].map((run) => this.stopSource(run)))
      try {
        await this.bridge.finishSession({ sessionId: this.snapshot.sessionId })
        await this.refreshStatus(generation)
        this.publish({ status: this.snapshot.errors.length > 0 || ['partial', 'error'].includes(this.snapshot.finalizationStatus) ? 'error' : 'saved' })
      } catch (error) {
        const message = `disk: ${error instanceof Error ? error.message : String(error)}`
        this.publish({ status: 'error', errors: this.snapshot.errors.includes(message) ? this.snapshot.errors : [...this.snapshot.errors, message] })
      } finally {
        this.finalizedGeneration = generation
      }
    })()
    const settled = stopping.finally(() => { if (this.stopping === settled) this.stopping = null })
    this.stopping = settled
    return settled
  }

  async openFolder() {
    if (this.snapshot.sessionId) await this.bridge?.openFolder({ sessionId: this.snapshot.sessionId })
  }

  async refreshRecoveryStatus() {
    if (!this.bridge?.available) return
    try { this.publish({ recovery: await this.bridge.getRecoveryStatus() }) }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.publish({ recovery: { ...this.snapshot.recovery, status: 'error', error: message, retryable: false } })
    }
  }

  async setFilmActive(active: boolean) {
    if (this.bridge?.available) await this.bridge.setFilmActive(active)
  }

  async retryRecovery() {
    if (!this.bridge?.available) return
    try { this.publish({ recovery: await this.bridge.retryRecovery() }) }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.publish({ recovery: { ...this.snapshot.recovery, status: 'error', error: message } })
    }
  }
}
