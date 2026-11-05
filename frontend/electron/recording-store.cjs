const fs = require('node:fs/promises')
const path = require('node:path')

const SOURCES = ['camera', 'microphone', 'screen']
const MIME_TYPES = new Set(['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4'])

function localStamp(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

function safeSource(source) {
  if (!SOURCES.includes(source)) throw new Error('Invalid recording source')
  return source
}

function safeSequence(sequence) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999) throw new Error('Invalid segment number')
  return sequence
}

class RecordingDiskStore {
  constructor(root, { now = () => new Date() } = {}) {
    this.root = path.resolve(root)
    this.now = now
    this.sessions = new Map()
  }

  async createSession() {
    await fs.mkdir(this.root, { recursive: true })
    const created = this.now()
    const base = `session_${localStamp(created)}`
    let directory
    for (let suffix = 1; suffix < 10000; suffix++) {
      directory = path.join(this.root, suffix === 1 ? base : `${base}_${String(suffix).padStart(2, '0')}`)
      try { await fs.mkdir(directory) } catch (error) { if (error.code === 'EEXIST') continue; throw error }
      break
    }
    if (!directory) throw new Error('Could not allocate a unique recording session folder')
    for (const source of SOURCES) await fs.mkdir(path.join(directory, source))
    await fs.mkdir(path.join(directory, 'final'))
    const session = {
      id: path.basename(directory), directory, createdAt: created.getTime(),
      manifest: {
        schemaVersion: 1, sessionId: path.basename(directory), status: 'recording',
        startedAt: created.toISOString(), endedAt: null, durationMs: null,
        sources: Object.fromEntries(SOURCES.map((source) => [source, { status: 'pending', segments: [], errors: [] }])),
        errors: [],
      }, handles: new Map(), metadataQueue: Promise.resolve(),
    }
    this.sessions.set(session.id, session)
    await this.persist(session)
    await this.log(session, `session started ${session.manifest.startedAt}`)
    return { id: session.id, directory: session.directory, startedAt: session.createdAt }
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Unknown recording session')
    return session
  }

  async serialize(session, operation) {
    const result = session.metadataQueue.then(operation)
    session.metadataQueue = result.catch(() => undefined)
    return result
  }

  async persist(session) {
    return this.serialize(session, async () => {
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const handle = await fs.open(temporary, 'w')
      try { await handle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await handle.sync() }
      finally { await handle.close() }
      await fs.rename(temporary, target)
    })
  }

  async log(session, message) {
    const line = `${this.now().toISOString()} ${message}\n`
    const handle = await fs.open(path.join(session.directory, 'recording.log'), 'a')
    try { await handle.writeFile(line); await handle.sync() } finally { await handle.close() }
  }

  async openSegment(sessionId, sourceName, sequenceValue, mimeType, startedAt, timelineMs = 0) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const sequence = safeSequence(sequenceValue)
    if (!MIME_TYPES.has(mimeType) || !Number.isFinite(startedAt) || !Number.isFinite(timelineMs)) throw new Error('Invalid segment metadata')
    const fileName = `segment_${String(sequence).padStart(4, '0')}.webm`
    const filePath = path.join(session.directory, source, fileName)
    const handle = await fs.open(filePath, 'wx')
    const entry = { sequence, fileName, mimeType, startedAt, endedAt: null, timelineMs, bytes: 0, status: 'recording', error: null }
    session.handles.set(`${source}:${sequence}`, handle)
    await this.serialize(session, async () => {
      const record = session.manifest.sources[source]
      record.status = 'recording'
      record.segments.push(entry)
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const manifestHandle = await fs.open(temporary, 'w')
      try { await manifestHandle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await manifestHandle.sync() } finally { await manifestHandle.close() }
      await fs.rename(temporary, target)
    })
    await this.log(session, `${source} segment_${String(sequence).padStart(4, '0')} opened`)
    return { fileName, path: filePath, mimeType }
  }

  async appendChunk(sessionId, sourceName, sequenceValue, bytes) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const sequence = safeSequence(sequenceValue)
    if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Invalid recording chunk')
    const handle = session.handles.get(`${source}:${sequence}`)
    if (!handle) throw new Error('Recording segment is not open')
    await handle.writeFile(bytes)
    await handle.sync()
    await this.serialize(session, async () => {
      const entry = session.manifest.sources[source].segments.find((segment) => segment.sequence === sequence)
      if (!entry || entry.status !== 'recording') throw new Error('Recording segment is not accepting chunks')
      entry.bytes += bytes.byteLength
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const manifestHandle = await fs.open(temporary, 'w')
      try { await manifestHandle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await manifestHandle.sync() } finally { await manifestHandle.close() }
      await fs.rename(temporary, target)
    })
  }

  async closeSegment(sessionId, sourceName, sequenceValue, endedAt, errorMessage = null) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const sequence = safeSequence(sequenceValue)
    const key = `${source}:${sequence}`
    const handle = session.handles.get(key)
    if (handle) {
      await handle.sync()
      await handle.close()
      session.handles.delete(key)
    }
    await this.serialize(session, async () => {
      const record = session.manifest.sources[source]
      const entry = record.segments.find((segment) => segment.sequence === sequence)
      if (!entry || entry.status !== 'recording') return
      entry.endedAt = endedAt
      entry.status = errorMessage ? 'error' : 'saved'
      entry.error = errorMessage
      record.status = errorMessage ? 'error' : 'saved'
      if (errorMessage) { record.errors.push(errorMessage); session.manifest.errors.push({ source, message: errorMessage, at: this.now().toISOString() }) }
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const manifestHandle = await fs.open(temporary, 'w')
      try { await manifestHandle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await manifestHandle.sync() } finally { await manifestHandle.close() }
      await fs.rename(temporary, target)
    })
    await this.log(session, `${source} segment_${String(sequence).padStart(4, '0')} ${errorMessage ? `error: ${errorMessage}` : 'saved'}`)
  }

  async reportError(sessionId, sourceName, message) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const error = String(message).slice(0, 500)
    await this.serialize(session, async () => {
      session.manifest.sources[source].status = 'error'
      session.manifest.sources[source].errors.push(error)
      session.manifest.errors.push({ source, message: error, at: this.now().toISOString() })
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const handle = await fs.open(temporary, 'w')
      try { await handle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await handle.sync() } finally { await handle.close() }
      await fs.rename(temporary, target)
    })
    await this.log(session, `${source} error: ${error}`)
  }

  async finishSession(sessionId, status = 'stopped') {
    const session = this.getSession(sessionId)
    for (const [key] of session.handles) {
      const [source, sequence] = key.split(':')
      await this.closeSegment(sessionId, source, Number(sequence), this.now().getTime(), 'Segment closed during session shutdown')
    }
    await this.serialize(session, async () => {
      const endedAt = this.now()
      session.manifest.status = status
      session.manifest.endedAt = endedAt.toISOString()
      session.manifest.durationMs = Math.max(0, endedAt.getTime() - session.createdAt)
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const handle = await fs.open(temporary, 'w')
      try { await handle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await handle.sync() } finally { await handle.close() }
      await fs.rename(temporary, target)
    })
    await this.log(session, `session ${status}`)
    return this.getStatus(sessionId)
  }

  async getStatus(sessionId) {
    const session = this.getSession(sessionId)
    const space = await fs.statfs(this.root)
    return {
      sessionId, directory: session.directory, startedAt: session.createdAt,
      elapsedMs: Math.max(0, this.now().getTime() - session.createdAt),
      segmentCounts: Object.fromEntries(SOURCES.map((source) => [source, session.manifest.sources[source].segments.filter((segment) => segment.status !== 'recording').length])),
      freeBytes: Number(space.bavail) * Number(space.bsize), errors: [...session.manifest.errors], status: session.manifest.status,
    }
  }
}

module.exports = { RecordingDiskStore, SOURCES }
