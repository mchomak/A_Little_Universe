const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { RecordingDiskStore } = require('./recording-store.cjs')

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
