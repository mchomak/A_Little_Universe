const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const { spawn } = require('node:child_process')
const { MediaFinalizer } = require('./media-finalizer.cjs')

test('aborting a finalizer process kills ffmpeg and returns an AbortError', async () => {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  let killed = false
  child.kill = () => {
    killed = true
    setImmediate(() => child.emit('close', null, 'SIGTERM'))
    return true
  }
  const controller = new AbortController()
  const finalizer = new MediaFinalizer({ spawnProcess: () => child, timeoutMs: 50 })
  const pending = finalizer.run('fake-ffmpeg', [], 'fixture', controller.signal)
  controller.abort()
  await assert.rejects(pending, (error) => error.name === 'AbortError')
  assert.equal(killed, true)
})

test('waits for close after a child error during cancellation before settling the process operation', async () => {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => {
    setImmediate(() => child.emit('error', new Error('kill request acknowledged')))
    return true
  }
  const controller = new AbortController()
  const finalizer = new MediaFinalizer({ spawnProcess: () => child, timeoutMs: 1_000 })
  const settled = { value: false }
  const result = finalizer.run('fake-ffmpeg', [], 'fixture', controller.signal).then(
    () => { settled.value = true; return null },
    (error) => { settled.value = true; return error },
  )
  await new Promise((resolve) => setImmediate(() => { child.emit('spawn'); resolve() }))
  controller.abort()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(settled.value, false, 'an error event does not prove the FFmpeg process has closed')

  child.emit('close', null, 'SIGTERM')
  const error = await result
  assert.equal(error?.name, 'AbortError')
})

test('returns a spawn failure directly when no child process was created', async () => {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => true
  const spawnError = new Error('ffmpeg executable not found')
  const finalizer = new MediaFinalizer({ spawnProcess: () => child, timeoutMs: 1_000 })
  const result = finalizer.run('missing-ffmpeg', [], 'fixture').then(
    () => null,
    (error) => error,
  )
  setImmediate(() => child.emit('error', spawnError))
  assert.equal(await result, spawnError)
})
const { RecordingDiskStore } = require('./recording-store.cjs')

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe'

function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolve(stdout + stderr) : reject(new Error(`${binary} failed (${code}): ${stderr}`)))
  })
}

async function canRun(binary) {
  try { await run(binary, ['-version']); return true } catch { return false }
}

async function durationOf(file) {
  const value = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file])
  return Number(value.trim())
}

async function regionSignalStats(file, timeSeconds, x, y) {
  const output = await run(ffmpeg, [
    '-hide_banner', '-ss', String(timeSeconds), '-i', file, '-vf',
    `crop=80:80:${x}:${y},signalstats,metadata=print:file=-`, '-frames:v', '1', '-f', 'null', '-',
  ])
  const value = (key) => {
    const match = output.match(new RegExp(`lavfi\\.signalstats\\.${key}=([0-9.]+)`))
    assert.ok(match, `missing ${key} frame statistic in ${output}`)
    return Number(match[1])
  }
  return { y: value('YAVG'), u: value('UAVG'), v: value('VAVG') }
}

async function createFixture({ cameraSegments = [], screenSegments = [], microphoneSegments = [], durationMs = 4_000 } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-finalizer-'))
  const sources = { camera: [], screen: [], microphone: [] }
  const allSegments = [
    ...cameraSegments.map((segment) => ({ source: 'camera', ...segment })),
    ...screenSegments.map((segment) => ({ source: 'screen', ...segment })),
    ...microphoneSegments.map((segment) => ({ source: 'microphone', ...segment })),
  ]
  for (const source of Object.keys(sources)) await fs.mkdir(path.join(directory, source))
  await fs.mkdir(path.join(directory, 'final'))

  for (const segment of allSegments) {
    const sequence = sources[segment.source].length + 1
    const fileName = `segment_${String(sequence).padStart(4, '0')}.webm`
    const filePath = path.join(directory, segment.source, fileName)
    const fixtureName = segment.source === 'microphone' ? `audio-${segment.frequency ?? 400}.webm` : `video-${segment.color ?? 'red'}.webm`
    await fs.copyFile(path.join(__dirname, 'test-fixtures', fixtureName), filePath)
    await run(ffmpeg, ['-hide_banner', '-v', 'error', '-xerror', '-i', filePath, '-map', segment.source === 'microphone' ? '0:a:0' : '0:v:0', '-f', 'null', '-'])
    sources[segment.source].push({
      sequence, fileName, mimeType: segment.source === 'microphone' ? 'audio/webm' : 'video/webm',
      startedAt: Date.parse('2026-11-05T10:00:00.000Z') + segment.timelineMs,
      endedAt: Date.parse('2026-11-05T10:00:00.000Z') + segment.timelineMs + (segment.durationSeconds ?? (segment.source === 'microphone' ? 0.5 : 0.6)) * 1000,
      timelineMs: segment.timelineMs, bytes: (await fs.stat(filePath)).size, status: 'saved', error: null,
    })
  }
  const start = Date.parse('2026-11-05T10:00:00.000Z')
  return {
    directory,
    session: {
      id: 'session_test', directory,
      manifest: {
        schemaVersion: 1, sessionId: 'session_test', status: 'stopped',
        startedAt: new Date(start).toISOString(), endedAt: new Date(start + durationMs).toISOString(), durationMs,
        sources: Object.fromEntries(Object.entries(sources).map(([source, segments]) => [source, { status: segments.length ? 'saved' : 'error', segments, errors: [] }])),
        errors: [],
      },
    },
  }
}

async function fingerprintFiles(directory, manifest) {
  const hashes = new Map()
  for (const [source, record] of Object.entries(manifest.sources)) {
    for (const segment of record.segments) {
      const file = path.join(directory, source, segment.fileName)
      hashes.set(file, crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'))
    }
  }
  return hashes
}

test('decodes every original segment and assembles final tracks with recorded offsets and gaps', { timeout: 120_000 }, async (t) => {
  if (!(await canRun(ffmpeg)) || !(await canRun(ffprobe))) return t.skip('real ffmpeg and ffprobe are required for media integration tests')
  const fixture = await createFixture({
    screenSegments: [{ timelineMs: 0, color: 'red' }, { timelineMs: 1_600, color: 'blue' }],
    cameraSegments: [{ timelineMs: 700, color: 'green' }],
    microphoneSegments: [{ timelineMs: 0, durationSeconds: 0.5, frequency: 400 }, { timelineMs: 1_500, durationSeconds: 0.5, frequency: 800 }],
    durationMs: 3_200,
  })
  try {
    const originals = await fingerprintFiles(fixture.directory, fixture.session.manifest)
    const finalizer = new MediaFinalizer({ ffmpegPath: ffmpeg, platform: 'win32' })
    const result = await finalizer.finalizeSession(fixture.session)

    assert.equal(result.status, 'complete')
    for (const source of ['screen', 'camera', 'microphone']) {
      assert.ok(fixture.session.manifest.sources[source].segments.every((segment) => segment.validation?.status === 'valid'))
    }
    assert.equal(fixture.session.manifest.finalization.files.screen.status, 'saved')
    assert.equal(fixture.session.manifest.finalization.files.camera.status, 'saved')
    assert.equal(fixture.session.manifest.finalization.files.microphone.status, 'saved')
    assert.equal(fixture.session.manifest.finalization.files.combined.status, 'saved')

    const finalDirectory = path.join(fixture.directory, 'final')
    const screenDuration = await durationOf(path.join(finalDirectory, 'screen_full.mp4'))
    const cameraDuration = await durationOf(path.join(finalDirectory, 'camera_full.mp4'))
    const microphoneDuration = await durationOf(path.join(finalDirectory, 'microphone_full.m4a'))
    const combinedDuration = await durationOf(path.join(finalDirectory, 'combined.mp4'))
    for (const duration of [screenDuration, cameraDuration, microphoneDuration, combinedDuration]) {
      assert.ok(duration >= 3.1 && duration <= 3.4, `expected preserved 3.2s session timeline, got ${duration}s`)
    }

    const combinedPath = path.join(finalDirectory, 'combined.mp4')
    const redScreen = await regionSignalStats(combinedPath, 0.2, 200, 200)
    assert.ok(redScreen.v > redScreen.u + 80, `screen at 0.2s should be red, got ${JSON.stringify(redScreen)}`)
    const cameraTrack = await regionSignalStats(path.join(finalDirectory, 'camera_full.mp4'), 0.8, 640, 360)
    assert.ok(cameraTrack.y > 60 && cameraTrack.u < 110 && cameraTrack.v < 110, `camera source at 0.8s should be green, got ${JSON.stringify(cameraTrack)}`)
    const greenCamera = await regionSignalStats(combinedPath, 0.8, 1_500, 850)
    assert.ok(greenCamera.y > 60 && greenCamera.u < 110 && greenCamera.v < 110, `camera PiP at 0.8s should be green, got ${JSON.stringify(greenCamera)}`)

    const silence = await run(ffmpeg, ['-hide_banner', '-i', path.join(finalDirectory, 'microphone_full.m4a'), '-af', 'silencedetect=noise=-35dB:d=0.2', '-f', 'null', '-'])
    assert.match(silence, /silence_start: 0\.4[0-9]*/)
    assert.match(silence, /silence_end: 1\.50[0-9]*/)

    for (const [file, hash] of originals) {
      assert.equal(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'), hash, `original was changed: ${file}`)
    }
  } finally { await fs.rm(fixture.directory, { recursive: true, force: true }) }
})

test('bounds FFmpeg input fan-in while assembling many camera and microphone segments in timeline order', { timeout: 120_000 }, async (t) => {
  if (!(await canRun(ffmpeg)) || !(await canRun(ffprobe))) return t.skip('real ffmpeg and ffprobe are required for media integration tests')
  const fixture = await createFixture({
    cameraSegments: Array.from({ length: 9 }, (_, index) => ({ timelineMs: index * 700, color: 'green' })),
    microphoneSegments: Array.from({ length: 9 }, (_, index) => ({ timelineMs: index * 700, durationSeconds: 0.5, frequency: 400 })),
    durationMs: 6_200,
  })
  try {
    const originals = await fingerprintFiles(fixture.directory, fixture.session.manifest)
    const inputCounts = []
    const finalizer = new MediaFinalizer({
      ffmpegPath: ffmpeg,
      platform: 'win32',
      spawnProcess: (binary, args, options) => {
        if (binary === ffmpeg) inputCounts.push(args.filter((argument) => argument === '-i').length)
        return spawn(binary, args, options)
      },
    })
    await finalizer.finalizeSession(fixture.session)
    assert.equal(fixture.session.manifest.finalization.files.camera.status, 'saved')
    assert.equal(fixture.session.manifest.finalization.files.microphone.status, 'saved')
    assert.ok(inputCounts.length > 0)
    assert.ok(Math.max(...inputCounts) <= 8, `FFmpeg input fan-in exceeded 8: ${inputCounts.join(', ')}`)
    const outputDuration = await durationOf(path.join(fixture.directory, 'final', 'camera_full.mp4'))
    assert.ok(outputDuration >= 6.05 && outputDuration <= 6.4, `expected 6.2s timeline, got ${outputDuration}s`)
    const audioDuration = await durationOf(path.join(fixture.directory, 'final', 'microphone_full.m4a'))
    assert.ok(audioDuration >= 6.05 && audioDuration <= 6.4, `expected 6.2s audio timeline, got ${audioDuration}s`)
    const silence = await run(ffmpeg, ['-hide_banner', '-i', path.join(fixture.directory, 'final', 'microphone_full.m4a'), '-af', 'silencedetect=noise=-35dB:d=0.15', '-f', 'null', '-'])
    assert.match(silence, /silence_start: 3\.29[0-9]*/)
    assert.match(silence, /silence_end: 3\.50[0-9]*/)
    for (const [file, hash] of originals) {
      assert.equal(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'), hash, `original was changed: ${file}`)
    }
  } finally { await fs.rm(fixture.directory, { recursive: true, force: true }) }
})

test('uses decoded media duration for legacy interrupted manifests with an untrusted restart timestamp', { timeout: 120_000 }, async (t) => {
  if (!(await canRun(ffmpeg)) || !(await canRun(ffprobe))) return t.skip('real ffmpeg and ffprobe are required for media integration tests')
  const dayMs = 24 * 60 * 60 * 1_000
  const fixture = await createFixture({ cameraSegments: [{ timelineMs: 0 }], durationMs: 3 * dayMs })
  try {
    const segment = fixture.session.manifest.sources.camera.segments[0]
    segment.status = 'interrupted'
    segment.endedAt = segment.startedAt + 3 * dayMs
    delete segment.durationMs
    delete segment.durableTimelineMs
    fixture.session.manifest.status = 'interrupted'
    fixture.session.manifest.endedAt = new Date(segment.endedAt).toISOString()
    fixture.session.manifest.recovery = { detectedAt: fixture.session.manifest.endedAt, reason: 'Legacy recovery metadata without a durable chunk boundary.' }

    const finalizer = new MediaFinalizer({ ffmpegPath: ffmpeg, platform: 'win32' })
    await finalizer.finalizeSession(fixture.session)
    const output = path.join(fixture.directory, 'final', 'camera_full.mp4')
    const duration = await durationOf(output)
    assert.ok(duration >= 0.5 && duration <= 0.9, `legacy restart gap must not extend output: ${duration}s`)
  } finally { await fs.rm(fixture.directory, { recursive: true, force: true }) }
})

test('retains corrupt source segments, leaves timeline holes, and refuses a false combined output', { timeout: 120_000 }, async (t) => {
  if (!(await canRun(ffmpeg)) || !(await canRun(ffprobe))) return t.skip('real ffmpeg and ffprobe are required for media integration tests')
  const fixture = await createFixture({
    screenSegments: [{ timelineMs: 0 }, { timelineMs: 1_500, color: 'blue' }],
    cameraSegments: [{ timelineMs: 0 }],
    microphoneSegments: [{ timelineMs: 0, durationSeconds: 0.5 }],
    durationMs: 3_000,
  })
  try {
    const corruptPath = path.join(fixture.directory, 'screen', fixture.session.manifest.sources.screen.segments[1].fileName)
    await fs.writeFile(corruptPath, Buffer.from('intentionally not a media container'))
    const corruptedHash = crypto.createHash('sha256').update(await fs.readFile(corruptPath)).digest('hex')
    const finalizer = new MediaFinalizer({ ffmpegPath: ffmpeg, platform: 'win32' })
    const result = await finalizer.finalizeSession(fixture.session)

    assert.equal(result.status, 'partial')
    const corruptRecord = fixture.session.manifest.sources.screen.segments[1]
    assert.equal(corruptRecord.validation.status, 'error')
    assert.equal(fixture.session.manifest.finalization.files.screen.status, 'partial')
    assert.equal(fixture.session.manifest.finalization.files.combined.status, 'skipped')
    assert.match(fixture.session.manifest.finalization.files.combined.error, /incomplete|invalid|decode/i)
    assert.equal(crypto.createHash('sha256').update(await fs.readFile(corruptPath)).digest('hex'), corruptedHash)

    const screenDuration = await durationOf(path.join(fixture.directory, 'final', 'screen_full.mp4'))
    assert.ok(screenDuration >= 2.9 && screenDuration <= 3.2, `missing source segment must not compress session time: ${screenDuration}s`)
    await run(ffmpeg, ['-v', 'error', '-xerror', '-i', path.join(fixture.directory, 'final', 'screen_full.mp4'), '-map', '0:v:0', '-f', 'null', '-'])
  } finally { await fs.rm(fixture.directory, { recursive: true, force: true }) }
})

test('enforces contained segment paths and keeps finalization retryable after a command failure', async (t) => {
  if (!(await canRun(ffmpeg))) return t.skip('real ffmpeg is required for media integration tests')
  const fixture = await createFixture({ screenSegments: [{ timelineMs: 0 }], durationMs: 1_000 })
  try {
    const segment = fixture.session.manifest.sources.screen.segments[0]
    const outside = path.join(fixture.directory, 'outside.webm')
    await fs.writeFile(outside, Buffer.from('must not be read'))
    segment.fileName = '../outside.webm'
    const finalizer = new MediaFinalizer({ ffmpegPath: ffmpeg, platform: 'win32' })
    const first = await finalizer.finalizeSession(fixture.session)
    assert.equal(first.status, 'error')
    assert.equal(segment.validation.status, 'error')
    assert.equal(await fs.readFile(outside, 'utf8'), 'must not be read')
    assert.equal(fixture.session.manifest.finalization.status, 'error')
  } finally { await fs.rm(fixture.directory, { recursive: true, force: true }) }
})

test('recovers a crash-marked segment and finalizes verified bytes without deleting the original', { timeout: 120_000 }, async (t) => {
  if (!(await canRun(ffmpeg)) || !(await canRun(ffprobe))) return t.skip('real ffmpeg and ffprobe are required for crash-recovery integration tests')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-crash-recovery-'))
  try {
    const original = await fs.readFile(path.join(__dirname, 'test-fixtures', 'video-green.webm'))
    const originalHash = crypto.createHash('sha256').update(original).digest('hex')
    const recordingRoot = path.join(directory, 'recordings')
    const start = new Date('2026-11-05T10:00:00.000Z')
    const crashedStore = new RecordingDiskStore(recordingRoot, { now: () => start })
    const session = await crashedStore.createSession()
    const opened = await crashedStore.openSegment(session.id, 'camera', 1, 'video/webm', start.getTime(), 0)
    await crashedStore.appendChunk(session.id, 'camera', 1, original, 800)
    for (const handle of crashedStore.getSession(session.id).handles.values()) await handle.close()

    const restartTime = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1_000)
    const restartedStore = new RecordingDiskStore(recordingRoot, { now: () => restartTime })
    assert.deepEqual(await restartedStore.recoverInterrupted(), [session.id])
    const recoveredSession = restartedStore.getSession(session.id)
    assert.equal(recoveredSession.manifest.durationMs, 800, 'the durable capture timeline bounds crash recovery regardless of restart time')
    const finalizer = new MediaFinalizer({ ffmpegPath: ffmpeg, ffprobePath: ffprobe, platform: 'win32' })
    const result = await finalizer.finalizeSession(recoveredSession, {
      persist: () => restartedStore.persist(recoveredSession),
      log: (message) => restartedStore.log(recoveredSession, message),
    })

    assert.equal(result.status, 'error', 'unavailable screen and microphone remain visible as errors')
    assert.equal(recoveredSession.manifest.sources.camera.segments[0].validation.status, 'valid')
    assert.equal(recoveredSession.manifest.sources.camera.segments[0].status, 'saved')
    assert.equal(recoveredSession.manifest.sources.camera.segments[0].recoveredFrom, 'interrupted')
    assert.equal(recoveredSession.manifest.finalization.files.camera.status, 'saved')
    const recoveredOutput = path.join(session.directory, 'final', 'camera_full.mp4')
    const recoveredDuration = await durationOf(recoveredOutput)
    assert.ok(recoveredDuration >= 0.7 && recoveredDuration <= 1.0, `3-day restart gap must not extend output: ${recoveredDuration}s`)
    await run(ffmpeg, ['-hide_banner', '-v', 'error', '-xerror', '-i', recoveredOutput, '-map', '0:v:0', '-f', 'null', '-'])
    assert.equal(crypto.createHash('sha256').update(await fs.readFile(opened.path)).digest('hex'), originalHash)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
