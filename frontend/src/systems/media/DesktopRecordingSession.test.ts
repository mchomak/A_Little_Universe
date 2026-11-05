import { describe, expect, it, vi } from 'vitest'
import { DesktopRecordingSession, DISPLAY_CAPTURE_OPTIONS, type DesktopSource } from './DesktopRecordingSession'

class Track extends EventTarget {
  readyState: MediaStreamTrackState = 'live'
  stopCount = 0
  stop() { this.readyState = 'ended'; this.stopCount += 1 }
}

class Recorder extends EventTarget {
  state: RecordingState = 'inactive'
  starts: number[] = []
  stopChunkSize: number | undefined
  stopPrelude: { value: string; size: number } | undefined
  constructor(readonly stream: MediaStream) { super() }
  start(slice?: number) { this.state = 'recording'; this.starts.push(slice ?? 0) }
  emitChunk(value = 'chunk', reportedSize?: number) {
    const data = new Event('dataavailable') as BlobEvent
    const blob = new Blob([value])
    if (reportedSize !== undefined) Object.defineProperty(blob, 'size', { value: reportedSize })
    Object.defineProperty(data, 'data', { value: blob })
    this.dispatchEvent(data)
  }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    if (this.stopPrelude) this.emitChunk(this.stopPrelude.value, this.stopPrelude.size)
    this.emitChunk('segment', this.stopChunkSize)
    this.dispatchEvent(new Event('stop'))
  }
}

function makeStream() {
  const track = new Track()
  return { stream: { getTracks: () => [track as unknown as MediaStreamTrack], getVideoTracks: () => [track as unknown as MediaStreamTrack], track } as unknown as MediaStream, track }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(options: {
  capture?: (source: DesktopSource) => Promise<MediaStream>
  openSegment?: (value: unknown) => Promise<unknown>
  markSegmentStarted?: (value: { source: DesktopSource; timelineMs: number }) => Promise<void>
  appendChunk?: (value: { bytes: ArrayBuffer; timelineMs: number }) => Promise<void>
  closeSegment?: (value: { source: DesktopSource; sequence: number }) => Promise<void>
  wallNow?: () => number
  monotonicNow?: () => number
} = {}) {
  const recorders: Recorder[] = []
  const timers: { callback: () => void; delay: number }[] = []
  const openSegment = vi.fn(options.openSegment ?? (async () => undefined))
  const markSegmentStarted = vi.fn(options.markSegmentStarted ?? (async () => undefined))
  const appendChunk = vi.fn(options.appendChunk ?? (async () => undefined))
  const closeSegment = vi.fn(options.closeSegment ?? (async () => undefined))
  const finishSession = vi.fn(async () => undefined)
  const bridge = {
    available: true,
    createSession: async () => ({ id: 'session-test', directory: 'Movies/session-test', startedAt: 1000 }),
    openSegment, markSegmentStarted, appendChunk, closeSegment, reportError: vi.fn(async () => undefined), finishSession,
    getRecoveryStatus: async () => ({ status: 'idle' as const, pending: 0, currentSessionId: null, error: null, failed: 0, retryable: false }),
    retryRecovery: async () => ({ status: 'idle' as const, pending: 0, currentSessionId: null, error: null, failed: 0, retryable: false }),
    setFilmActive: async () => undefined,
    getStatus: async () => ({ directory: 'Movies/session-test', elapsedMs: 1000, freeBytes: 1000, segmentCounts: { camera: 1, microphone: 1, screen: 1 }, errors: [] }),
    openFolder: async () => undefined,
  }
  const session = new DesktopRecordingSession({
    bridge,
    environment: {
      capture: options.capture ?? (async () => makeStream().stream),
      mimeFor: (source) => source === 'microphone' ? 'audio/webm' : 'video/webm',
      recorder: (input) => { const recorder = new Recorder(input); recorders.push(recorder); return recorder as unknown as MediaRecorder },
      wallNow: options.wallNow ?? (() => 1000), monotonicNow: options.monotonicNow ?? (() => 0),
      every: (callback, delay) => { timers.push({ callback, delay }); return timers.length as unknown as ReturnType<typeof setInterval> },
      cancel: () => undefined,
    },
  })
  return { session, bridge, recorders, timers, openSegment, markSegmentStarted, appendChunk, closeSegment, finishSession }
}

describe('DesktopRecordingSession', () => {
  it('persists each recorder start offset after its own delayed segment-open IPC', async () => {
    let monotonic = 0
    const gates = { camera: deferred<void>(), microphone: deferred<void>(), screen: deferred<void>() }
    const h = harness({
      monotonicNow: () => monotonic,
      wallNow: () => 1_000 + monotonic,
      openSegment: async (value) => {
        const source = (value as { source: DesktopSource }).source
        await gates[source].promise
      },
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.openSegment).toHaveBeenCalledTimes(3))

    monotonic = 120
    gates.camera.resolve()
    await vi.waitFor(() => expect(h.markSegmentStarted).toHaveBeenCalledWith(expect.objectContaining({ source: 'camera', timelineMs: 120 })))
    monotonic = 470
    gates.microphone.resolve()
    await vi.waitFor(() => expect(h.markSegmentStarted).toHaveBeenCalledWith(expect.objectContaining({ source: 'microphone', timelineMs: 470 })))
    monotonic = 920
    gates.screen.resolve()
    await vi.waitFor(() => expect(h.markSegmentStarted).toHaveBeenCalledWith(expect.objectContaining({ source: 'screen', timelineMs: 920 })))

    expect(h.openSegment.mock.calls.map(([value]) => (value as { timelineMs: number }).timelineMs)).toEqual([0, 0, 0])
    expect(h.markSegmentStarted.mock.calls.map(([value]) => value.timelineMs).sort((a, b) => a - b)).toEqual([120, 470, 920])
    await h.session.stop()
  })

  it('starts each resolved source without waiting for the other permission prompts', async () => {
    const requests = { camera: deferred<MediaStream>(), microphone: deferred<MediaStream>(), screen: deferred<MediaStream>() }
    const capture = vi.fn((source: DesktopSource) => requests[source].promise)
    const h = harness({ capture })

    expect(capture).not.toHaveBeenCalled()
    const start = h.session.start()
    await start
    expect(capture).toHaveBeenCalledTimes(3)

    const camera = makeStream()
    requests.camera.resolve(camera.stream)
    await vi.waitFor(() => expect(h.recorders).toHaveLength(1))
    expect(h.session.getSnapshot().sources.camera).toBe('recording')
    expect(h.session.getSnapshot().sources.microphone).toBe('starting')
    expect(h.session.getSnapshot().sources.screen).toBe('starting')

    await h.session.stop()
    requests.microphone.resolve(makeStream().stream)
    requests.screen.resolve(makeStream().stream)
    await vi.waitFor(() => {
      expect(h.session.getSnapshot().sources.microphone).toBe('idle')
      expect(h.session.getSnapshot().sources.screen).toBe('idle')
    })
    expect(h.recorders).toHaveLength(1)
  })

  it('stops tracks that resolve after Stop & Save and never opens late segments', async () => {
    const requests = { camera: deferred<MediaStream>(), microphone: deferred<MediaStream>(), screen: deferred<MediaStream>() }
    const h = harness({ capture: (source) => requests[source].promise })
    await h.session.start()
    await h.session.stop()

    const late = [makeStream(), makeStream(), makeStream()]
    requests.camera.resolve(late[0]!.stream)
    requests.microphone.resolve(late[1]!.stream)
    requests.screen.resolve(late[2]!.stream)
    await vi.waitFor(() => expect(late.every(({ track }) => track.stopCount === 1)).toBe(true))

    expect(h.openSegment).not.toHaveBeenCalled()
    expect(h.recorders).toHaveLength(0)
    expect(h.finishSession).toHaveBeenCalledOnce()
    expect(h.session.getSnapshot().status).toBe('saved')
  })

  it('publishes partial finalization results and errors after Stop & Save', async () => {
    const h = harness()
    h.bridge.getStatus = async () => ({
      directory: 'Movies/session-test', elapsedMs: 3200, freeBytes: 900, segmentCounts: { camera: 1, microphone: 1, screen: 1 }, errors: [],
      finalization: {
        status: 'partial',
        files: { screen: { status: 'partial', path: 'final/screen_full.mp4', bytes: 200, error: 'A screen segment was damaged.' } },
        errors: ['A screen segment was damaged.'],
      },
    })
    await h.session.start()
    await h.session.stop()

    expect(h.session.getSnapshot().status).toBe('error')
    expect(h.session.getSnapshot().finalizationStatus).toBe('partial')
    expect(h.session.getSnapshot().finalizationFiles.screen?.path).toBe('final/screen_full.mp4')
    expect(h.session.getSnapshot().errors).toContain('A screen segment was damaged.')
  })

  it('drains queued chunks and appends the final dataavailable chunk before closing on Stop & Save', async () => {
    const appendGate = deferred<void>()
    const appended: string[] = []
    let closedAfter: string[] = []
    const h = harness({
      capture: async (source) => source === 'camera' ? makeStream().stream : Promise.reject(new Error('unavailable')),
      appendChunk: async ({ bytes }: { bytes: ArrayBuffer }) => {
        const value = new TextDecoder().decode(bytes)
        if (value === 'queued-before-stop') await appendGate.promise
        appended.push(value)
      },
      closeSegment: async ({ source }: { source: DesktopSource }) => {
        if (source === 'camera') closedAfter = [...appended]
      },
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.recorders).toHaveLength(1))
    const camera = h.recorders[0]!
    camera.emitChunk('queued-before-stop')
    await vi.waitFor(() => expect(h.appendChunk).toHaveBeenCalledOnce())

    let stopCompleted = false
    const stopping = h.session.stop().then(() => { stopCompleted = true })
    await Promise.resolve()
    expect(stopCompleted).toBe(false)
    appendGate.resolve()
    await stopping

    expect(appended).toEqual(['queued-before-stop', 'segment'])
    expect(closedAfter).toEqual(['queued-before-stop', 'segment'])
  })

  it('latches queue overflow and rejects later chunks while a disk append is blocked', async () => {
    const appendGate = deferred<void>()
    const appended: string[] = []
    let closedWithError: string | undefined
    const h = harness({
      capture: async (source) => source === 'camera' ? makeStream().stream : Promise.reject(new Error('unavailable')),
      appendChunk: async ({ bytes }: { bytes: ArrayBuffer }) => {
        const value = new TextDecoder().decode(bytes)
        if (value === 'accepted') await appendGate.promise
        appended.push(value)
      },
      closeSegment: async ({ source, error }: { source: DesktopSource; error?: string }) => {
        if (source === 'camera') closedWithError = error
      },
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.recorders).toHaveLength(1))
    const camera = h.recorders[0]!
    camera.stopChunkSize = 12 * 1024 * 1024
    camera.stopPrelude = { value: 'queued-during-stop', size: 1024 * 1024 }

    camera.emitChunk('accepted', 20 * 1024 * 1024)
    await vi.waitFor(() => expect(h.appendChunk).toHaveBeenCalledOnce())
    camera.emitChunk('over-limit', 20 * 1024 * 1024)

    await vi.waitFor(() => expect(camera.state).toBe('inactive'))
    expect(h.session.getSnapshot().sources.camera).toBe('error')
    for (let index = 0; index < 100; index += 1) camera.emitChunk('late-after-overflow', 1)
    expect(h.appendChunk).toHaveBeenCalledOnce()

    appendGate.resolve()
    await h.session.stop()

    expect(appended).toEqual(['accepted', 'segment'])
    expect(closedWithError).toContain('Диск не успевает записывать данные')
    expect(h.session.getSnapshot().sources.camera).toBe('error')
    expect(h.session.getSnapshot().errors.join(' ')).toContain('Диск не успевает записывать данные')
  })

  it('rejects an overflow-stop final chunk that cannot fit under the queue cap', async () => {
    const appendGate = deferred<void>()
    const appended: string[] = []
    let closedWithError: string | undefined
    const h = harness({
      capture: async (source) => source === 'camera' ? makeStream().stream : Promise.reject(new Error('unavailable')),
      appendChunk: async ({ bytes }: { bytes: ArrayBuffer }) => {
        const value = new TextDecoder().decode(bytes)
        if (value === 'accepted') await appendGate.promise
        appended.push(value)
      },
      closeSegment: async ({ source, error }: { source: DesktopSource; error?: string }) => {
        if (source === 'camera') closedWithError = error
      },
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.recorders).toHaveLength(1))
    const camera = h.recorders[0]!
    camera.stopChunkSize = 12 * 1024 * 1024 + 1

    camera.emitChunk('accepted', 20 * 1024 * 1024)
    await vi.waitFor(() => expect(h.appendChunk).toHaveBeenCalledOnce())
    camera.emitChunk('over-limit', 20 * 1024 * 1024)
    await vi.waitFor(() => expect(camera.state).toBe('inactive'))
    appendGate.resolve()
    await h.session.stop()

    expect(appended).toEqual(['accepted'])
    expect(closedWithError).toContain('Финальный фрагмент превышает доступный предел')
    expect(h.session.getSnapshot().sources.camera).toBe('error')
    expect(h.session.getSnapshot().errors.join(' ')).toContain('Сегмент неполный')
  })

  it('does not deadlock when a new segment cannot be opened during rotation', async () => {
    const openSegment = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk full'))
    const h = harness({
      openSegment,
      capture: async (source) => source === 'camera' ? makeStream().stream : Promise.reject(new Error('unavailable')),
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.session.getSnapshot().sources.camera).toBe('recording'))

    h.timers.find((timer) => timer.delay === 60_000)!.callback()
    await vi.waitFor(() => expect(h.session.getSnapshot().sources.camera).toBe('error'))
    await h.session.stop()

    expect(openSegment).toHaveBeenCalledTimes(2)
    expect(h.finishSession).toHaveBeenCalledOnce()
    expect(h.session.getSnapshot().errors.join(' ')).toContain('disk full')
  })

  it('immediately stops only a source whose incremental disk write fails', async () => {
    const h = harness({
      appendChunk: async () => { throw new Error('write failed') },
      capture: async (source) => source === 'microphone' ? Promise.reject(new Error('unavailable')) : makeStream().stream,
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.recorders).toHaveLength(2))
    const camera = h.recorders[0]!
    camera.emitChunk()
    await vi.waitFor(() => expect(h.session.getSnapshot().sources.camera).toBe('error'))

    expect(h.session.getSnapshot().sources.screen).toBe('recording')
    expect(camera.state).toBe('inactive')
    await h.session.stop()
    expect(h.session.getSnapshot().errors.join(' ')).toContain('write failed')
  })

  it('preserves source error status when closing the segment fails', async () => {
    const h = harness({
      closeSegment: async ({ source }) => { if (source === 'camera') throw new Error('close failed') },
    })
    await h.session.start()
    await vi.waitFor(() => expect(h.recorders).toHaveLength(3))
    await h.session.stop()

    expect(h.session.getSnapshot().sources.camera).toBe('error')
    expect(h.session.getSnapshot().sources.microphone).toBe('saved')
    expect(h.session.getSnapshot().sources.screen).toBe('saved')
    expect(h.session.getSnapshot().status).toBe('error')
    expect(h.session.getSnapshot().errors.join(' ')).toContain('close failed')
  })

  it('uses hard upper bounds for app-window capture dimensions and frame rate', () => {
    expect(DISPLAY_CAPTURE_OPTIONS.video).toEqual({
      width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 24 },
    })
  })
})
