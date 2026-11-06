const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { RecordingDiskStore } = require('./recording-store.cjs')
const { MediaFinalizer } = require('./media-finalizer.cjs')

test('stores chunks incrementally in independent source segments with shared timestamps', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-'))
  try {
    const store = new RecordingDiskStore(root, { now: () => new Date('2026-11-05T10:00:00.000Z') })
    const session = await store.createSession()
    const segment = await store.openSegment(session.id, 'camera', 1, 'video/webm', 1000)
    await store.appendChunk(session.id, 'camera', 1, Buffer.from('webm-init'))
    const onDiskBeforeClose = await fs.readFile(path.join(session.directory, 'camera', 'segment_0001.webm'), 'utf8')
    assert.equal(onDiskBeforeClose, 'webm-init')
    assert.equal((await store.getStatus(session.id)).segmentCounts.camera, 0)
    await store.appendChunk(session.id, 'camera', 1, Buffer.from('-webm-cluster'))
    await store.closeSegment(session.id, 'camera', 1, 61_000)
    assert.equal((await store.getStatus(session.id)).segmentCounts.camera, 1)
    assert.deepEqual(await fs.readFile(segment.path), Buffer.from('webm-init-webm-cluster'))
    const manifest = JSON.parse(await fs.readFile(path.join(session.directory, 'manifest.json'), 'utf8'))
    assert.equal(manifest.sources.camera.segments[0].startedAt, 1000)
    assert.equal(manifest.sources.camera.segments[0].endedAt, 61_000)
    assert.equal(manifest.sources.camera.segments[0].bytes, 22)
    assert.equal(manifest.sources.microphone.segments.length, 0)
    assert.match(await fs.readFile(path.join(session.directory, 'recording.log'), 'utf8'), /camera.*segment_0001/)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('allocates a new session directory when timestamps collide and rejects path injection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-'))
  try {
    const store = new RecordingDiskStore(root, { now: () => new Date('2026-11-05T10:00:00.000Z') })
    const first = await store.createSession()
    const second = await store.createSession()
    assert.notEqual(first.directory, second.directory)
    await assert.rejects(store.openSegment(first.id, '../outside', 1, 'video/webm', 0), /source/i)
    await assert.rejects(fs.access(path.join(root, 'outside')))
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('finishes only after active segments are closed and logs errors without removing files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    await store.openSegment(session.id, 'microphone', 1, 'audio/webm', 1000)
    await store.appendChunk(session.id, 'microphone', 1, Buffer.from('audio-data'))
    const status = await store.finishSession(session.id)
    const filepath = path.join(session.directory, 'microphone', 'segment_0001.webm')
    assert.equal(status.status, 'stopped')
    assert.equal((await fs.stat(filepath)).size, 10)
    const manifest = JSON.parse(await fs.readFile(path.join(session.directory, 'manifest.json'), 'utf8'))
    assert.equal(manifest.sources.microphone.segments[0].status, 'error')
    assert.equal(manifest.sources.microphone.segments[0].bytes, 10)
    assert.ok(manifest.endedAt)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('discards a failed startup session and removes its source segments and manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    const segment = await store.openSegment(session.id, 'screen', 1, 'video/webm', Date.now())
    await store.appendChunk(session.id, 'screen', 1, Buffer.from('partial-screen-bytes'))
    assert.equal(store.getSession(session.id).handles.size, 1)
    assert.equal((await fs.readFile(segment.path)).toString(), 'partial-screen-bytes')

    const result = await store.discardSession(session.id)

    assert.deepEqual(result, { sessionId: session.id, discarded: true })
    assert.equal(store.sessions.has(session.id), false)
    assert.deepEqual(await fs.readdir(root), [])
    await assert.rejects(fs.access(session.directory))
    assert.throws(() => store.getSession(session.id), /Unknown recording session/)
    await assert.rejects(store.discardSession(session.id), /Unknown recording session/)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('refuses to discard a session after it has been stopped', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    await store.finishSession(session.id)

    await assert.rejects(store.discardSession(session.id), /Only a registered active recording session/)
    assert.equal((await fs.stat(session.directory)).isDirectory(), true)
    assert.equal(store.sessions.has(session.id), true)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('reopens a crashed recording, preserves open segment bytes, and marks it for finalization', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-recovery-'))
  try {
    const started = new Date('2026-11-05T10:00:00.000Z')
    const firstStore = new RecordingDiskStore(root, { now: () => started })
    const session = await firstStore.createSession()
    const segment = await firstStore.openSegment(session.id, 'camera', 1, 'video/webm', started.getTime() + 250, 250)
    await firstStore.appendChunk(session.id, 'camera', 1, Buffer.from('durable-partial-webm'), 1_250)
    for (const handle of firstStore.getSession(session.id).handles.values()) await handle.close()

    const restartedAt = new Date('2026-11-08T10:00:07.000Z')
    const recoveredStore = new RecordingDiskStore(root, { now: () => restartedAt })
    const pending = await recoveredStore.recoverInterrupted()
    assert.deepEqual(pending, [session.id])
    assert.equal((await fs.readFile(segment.path)).toString(), 'durable-partial-webm')
    const recovered = await recoveredStore.getStatus(session.id)
    assert.equal(recovered.status, 'interrupted')
    assert.equal(recovered.finalization.status, 'pending')
    assert.equal(recovered.finalizationPending, true)

    const manifest = JSON.parse(await fs.readFile(path.join(session.directory, 'manifest.json'), 'utf8'))
    assert.equal(manifest.sources.camera.segments[0].status, 'interrupted')
    assert.equal(manifest.sources.camera.segments[0].endedAt, started.getTime() + 1_250)
    assert.equal(manifest.sources.camera.segments[0].durationMs, 1_000)
    assert.match(manifest.sources.camera.segments[0].error, /unexpected/i)
    assert.equal(manifest.durationMs, 1_250)
    assert.equal(manifest.endedAt, new Date(started.getTime() + 1_250).toISOString())
    assert.equal(manifest.recovery.detectedAt, restartedAt.toISOString())
    assert.equal(await fs.access(path.join(session.directory, 'manifest.json.tmp')).then(() => true, () => false), false)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('recovers a stopped session whose process crashed before finalization', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-recovery-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    await store.finishSession(session.id)

    const restarted = new RecordingDiskStore(root)
    assert.deepEqual(await restarted.recoverInterrupted(), [session.id])
    const status = await restarted.getStatus(session.id)
    assert.equal(status.status, 'stopped')
    assert.equal(status.finalizationPending, true)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('resets a finalization interrupted after Stop without changing the stopped session', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-finalize-recovery-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    await store.finishSession(session.id)
    const manifestPath = path.join(session.directory, 'manifest.json')
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    manifest.finalization = { status: 'finalizing', startedAt: new Date().toISOString(), endedAt: null, files: {}, errors: [] }
    await fs.writeFile(manifestPath, JSON.stringify(manifest))

    const restarted = new RecordingDiskStore(root)
    assert.deepEqual(await restarted.recoverInterrupted(), [session.id])
    const recovered = restarted.getSession(session.id).manifest
    assert.equal(recovered.status, 'stopped')
    assert.equal(recovered.finalization.status, 'pending')
    assert.match(recovered.finalization.errors.join(' '), /previous finalization was interrupted/i)
    assert.equal(JSON.parse(await fs.readFile(manifestPath, 'utf8')).finalization.status, 'pending')
    const retried = await new MediaFinalizer({ ffmpegPath: 'ffmpeg', platform: 'win32' }).finalizeSession(restarted.getSession(session.id))
    assert.notEqual(retried.status, 'finalizing')
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('rejects a registered session directory outside the store root without touching the target', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-root-'))
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-outside-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    const registeredSession = store.getSession(session.id)
    const registeredDirectory = registeredSession.directory
    const outsideDirectory = path.join(outsideRoot, session.id)
    await fs.mkdir(outsideDirectory)
    const sentinelPath = path.join(outsideDirectory, 'keep.txt')
    await fs.writeFile(sentinelPath, 'outside data')
    registeredSession.directory = outsideDirectory

    await assert.rejects(store.discardSession(session.id), /Unsafe recording session directory/)

    assert.equal(await fs.readFile(sentinelPath, 'utf8'), 'outside data')
    assert.equal((await fs.stat(registeredDirectory)).isDirectory(), true)
    assert.equal(store.sessions.get(session.id), registeredSession)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
    await fs.rm(outsideRoot, { recursive: true, force: true })
  }
})

test('rejects a registered session directory that is a symlink without touching its target', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-link-'))
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-target-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    const registeredSession = store.getSession(session.id)
    const targetSentinel = path.join(outsideRoot, 'keep.txt')
    await fs.writeFile(targetSentinel, 'symlink target data')
    await fs.rm(registeredSession.directory, { recursive: true, force: true })
    try {
      await fs.symlink(outsideRoot, registeredSession.directory, 'junction')
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS', 'EINVAL'].includes(error.code)) {
        t.skip(`Directory symlinks are unavailable: ${error.code}`)
        return
      }
      throw error
    }

    await assert.rejects(store.discardSession(session.id), /Unsafe recording session directory/)

    const linkStat = await fs.lstat(registeredSession.directory)
    assert.equal(linkStat.isSymbolicLink(), true)
    assert.equal(await fs.readFile(targetSentinel, 'utf8'), 'symlink target data')
    assert.equal(store.sessions.get(session.id), registeredSession)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
    await fs.rm(outsideRoot, { recursive: true, force: true })
  }
})


test('refuses to discard an active session after all sources completed startup', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alu-recordings-discard-complete-'))
  try {
    const store = new RecordingDiskStore(root)
    const session = await store.createSession()
    for (const [index, source] of ['camera', 'microphone', 'screen'].entries()) {
      const mimeType = source === 'microphone' ? 'audio/webm' : 'video/webm'
      await store.openSegment(session.id, source, 1, mimeType, 1000 + index, index)
    }
    assert.equal(store.getSession(session.id).handles.size, 3)
    assert.deepEqual([...store.getSession(session.id).startedSources], [])
    assert.throws(() => store.markStartupComplete(session.id), /before every required source is recording/)
    for (const [index, source] of ['camera', 'microphone', 'screen'].entries()) {
      await store.markSegmentStarted(session.id, source, 1, 1000 + index, index)
    }
    const marked = await store.markStartupComplete(session.id)
    for (const source of ['camera', 'microphone', 'screen']) await store.closeSegment(session.id, source, 1, 2000)

    assert.deepEqual(marked, { sessionId: session.id, startupComplete: true })
    assert.equal(store.getSession(session.id).startupComplete, true)
    await assert.rejects(store.discardSession(session.id), /incomplete startup/)
    assert.equal((await fs.stat(session.directory)).isDirectory(), true)
    assert.equal(store.sessions.has(session.id), true)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
