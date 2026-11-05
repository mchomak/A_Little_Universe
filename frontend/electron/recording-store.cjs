const fs = require('node:fs/promises')
const path = require('node:path')

const SOURCES = ['camera', 'microphone', 'screen']
const MIME_TYPES = new Set(['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4'])
const SESSION_DIRECTORY = /^session_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:_\d{2,4})?$/

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
        finalization: { status: 'pending', startedAt: null, endedAt: null, files: {}, errors: [] },
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
      const previousTemporary = await fs.lstat(temporary).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error))
      if (previousTemporary && (!previousTemporary.isFile() || previousTemporary.isSymbolicLink())) throw new Error('Unsafe manifest temporary path')
      const handle = await fs.open(temporary, 'w')
      try { await handle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await handle.sync() }
      finally { await handle.close() }
      await fs.rename(temporary, target)
      try {
        const directory = await fs.open(session.directory, 'r')
        try { await directory.sync() } finally { await directory.close() }
      } catch { /* Some Windows filesystems do not allow directory fsync. */ }
    })
  }

  async recoverInterrupted() {
    await fs.mkdir(this.root, { recursive: true })
    const entries = await fs.readdir(this.root, { withFileTypes: true })
    const pending = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !SESSION_DIRECTORY.test(entry.name) || this.sessions.has(entry.name)) continue
      const directory = path.join(this.root, entry.name)
      const directoryStat = await fs.lstat(directory)
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) continue
      let manifest
      let manifestFromTemporary = false
      for (const fileName of ['manifest.json', 'manifest.json.tmp']) {
        try {
          const manifestPath = path.join(directory, fileName)
          const manifestStat = await fs.lstat(manifestPath)
          if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) continue
          const candidate = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
          if (candidate?.schemaVersion !== 1 || candidate.sessionId !== entry.name || !candidate.sources) continue
          manifest = candidate
          manifestFromTemporary = fileName.endsWith('.tmp')
          break
        } catch { /* Keep damaged session files for manual recovery. */ }
      }
      if (!manifest) continue
      for (const source of SOURCES) {
        if (!manifest.sources[source] || !Array.isArray(manifest.sources[source].segments)) {
          manifest.sources[source] = { status: 'error', segments: [], errors: ['The source manifest was missing or malformed.'] }
        }
        manifest.sources[source].errors ??= []
      }
      manifest.errors ??= []
      manifest.finalization ??= { status: 'pending', startedAt: null, endedAt: null, files: {}, errors: [] }
      const now = this.now()
      const nowIso = now.toISOString()
      const startedAt = Date.parse(manifest.startedAt)
      const wasActive = ['recording', 'stopping', 'finalizing'].includes(manifest.status)
      const wasRecording = ['recording', 'stopping'].includes(manifest.status)
      const finalizationWasActive = manifest.finalization.status === 'finalizing'
      if (wasActive || finalizationWasActive) {
        if (manifest.status === 'recording' || manifest.status === 'stopping') {
          for (const source of SOURCES) {
            const record = manifest.sources[source]
            for (const segment of record.segments) {
              if (segment.status !== 'recording') continue
              segment.originalStatus = 'recording'
              segment.status = 'interrupted'
              const durableEnd = Number.isFinite(segment.durableTimelineMs)
                ? Math.max(segment.timelineMs ?? 0, segment.durableTimelineMs)
                : Number.isFinite(segment.timelineMs) ? segment.timelineMs : 0
              segment.durationMs = Math.max(0, durableEnd - (segment.timelineMs ?? 0))
              segment.endedAt = (Number.isFinite(segment.startedAt) ? segment.startedAt : startedAt) + segment.durationMs
              segment.error = 'Recording was interrupted by an unexpected application shutdown.'
            }
            if (record.segments.some((segment) => segment.status === 'interrupted')) record.status = 'interrupted'
          }
          manifest.status = 'interrupted'
        }
        if (finalizationWasActive || manifest.status === 'finalizing') {
          if (manifest.status === 'finalizing') manifest.status = 'interrupted'
          manifest.finalization = { status: 'pending', startedAt: null, endedAt: null, files: {}, errors: ['The previous finalization was interrupted; saved source segments will be checked again.'] }
        }
        const recoveredTimelineEnd = Math.max(0, ...SOURCES.flatMap((source) => manifest.sources[source].segments.map((segment) => {
          if (Number.isFinite(segment.durableTimelineMs)) return segment.durableTimelineMs
          return Math.max(0, Number(segment.timelineMs) || 0) + Math.max(0, Number(segment.durationMs) || 0)
        })))
        manifest.durationMs = Math.max(Number(manifest.durationMs) || 0, recoveredTimelineEnd)
        if (wasRecording && Number.isFinite(startedAt)) manifest.endedAt = new Date(startedAt + manifest.durationMs).toISOString()
        else manifest.endedAt ??= nowIso
        manifest.recovery = { detectedAt: nowIso, reason: 'An unfinished recording session was found on application startup.', durableTimelineVersion: 1 }
      }
      const session = {
        id: entry.name, directory,
        createdAt: Number.isFinite(startedAt) ? startedAt : now.getTime(),
        manifest, handles: new Map(), metadataQueue: Promise.resolve(),
      }
      this.sessions.set(session.id, session)
      if (manifestFromTemporary || wasActive || finalizationWasActive) {
        await this.persist(session)
        await this.log(session, wasActive ? 'interrupted session recovered after application restart'
          : finalizationWasActive ? 'interrupted finalization reset for retry after application restart'
            : 'recovered atomic manifest temporary file')
      }
      if (!['complete', 'partial'].includes(manifest.finalization.status)) pending.push(session.id)
    }
    return pending.sort((left, right) => this.sessions.get(left).createdAt - this.sessions.get(right).createdAt)
  }

  async log(session, message) {
    const line = `${this.now().toISOString()} ${message}\n`
    const logPath = path.join(session.directory, 'recording.log')
    const existing = await fs.lstat(logPath).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error))
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('Unsafe recording log path')
    const handle = await fs.open(logPath, 'a')
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

  async markSegmentStarted(sessionId, sourceName, sequenceValue, startedAt, timelineMs) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const sequence = safeSequence(sequenceValue)
    if (!Number.isFinite(startedAt) || !Number.isFinite(timelineMs) || timelineMs < 0) throw new Error('Invalid segment start metadata')
    await this.serialize(session, async () => {
      const entry = session.manifest.sources[source].segments.find((segment) => segment.sequence === sequence)
      if (!entry || entry.status !== 'recording') throw new Error('Recording segment is not open')
      entry.startedAt = startedAt
      entry.timelineMs = timelineMs
      const target = path.join(session.directory, 'manifest.json')
      const temporary = `${target}.tmp`
      const manifestHandle = await fs.open(temporary, 'w')
      try { await manifestHandle.writeFile(`${JSON.stringify(session.manifest, null, 2)}\n`); await manifestHandle.sync() } finally { await manifestHandle.close() }
      await fs.rename(temporary, target)
    })
  }

  async appendChunk(sessionId, sourceName, sequenceValue, bytes, timelineMs = null) {
    const session = this.getSession(sessionId)
    const source = safeSource(sourceName)
    const sequence = safeSequence(sequenceValue)
    if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Invalid recording chunk')
    const handle = session.handles.get(`${source}:${sequence}`)
    if (!handle) throw new Error('Recording segment is not open')
    if (timelineMs !== null && (!Number.isFinite(timelineMs) || timelineMs < 0)) throw new Error('Invalid recording chunk timestamp')
    const observedTimelineMs = timelineMs ?? Math.max(0, this.now().getTime() - session.createdAt)
    await handle.writeFile(bytes)
    await handle.sync()
    await this.serialize(session, async () => {
      const entry = session.manifest.sources[source].segments.find((segment) => segment.sequence === sequence)
      if (!entry || entry.status !== 'recording') throw new Error('Recording segment is not accepting chunks')
      entry.bytes += bytes.byteLength
      entry.durableTimelineMs = Math.max(entry.durableTimelineMs ?? entry.timelineMs ?? 0, observedTimelineMs)
      entry.durationMs = Math.max(0, entry.durableTimelineMs - (entry.timelineMs ?? 0))
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
    const manifest = session.manifest
    const finalization = manifest.finalization ?? { status: 'pending', files: {}, errors: [] }
    return {
      sessionId, directory: session.directory, startedAt: session.createdAt,
      elapsedMs: manifest.durationMs ?? Math.max(0, this.now().getTime() - session.createdAt),
      segmentCounts: Object.fromEntries(SOURCES.map((source) => [source, session.manifest.sources[source].segments.filter((segment) => segment.status !== 'recording').length])),
      freeBytes: Number(space.bavail) * Number(space.bsize),
      errors: [...(manifest.errors ?? []), ...(finalization.errors ?? []).map((message) => ({ message }))],
      status: manifest.status,
      finalization: { status: finalization.status, files: finalization.files ?? {}, errors: finalization.errors ?? [] },
      finalizationPending: !['complete', 'partial'].includes(finalization.status),
    }
  }
}

module.exports = { RecordingDiskStore, SOURCES }
