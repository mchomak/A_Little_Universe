const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const SOURCES = ['camera', 'microphone', 'screen']
const SOURCE_TYPE = { camera: 'video', microphone: 'audio', screen: 'video' }
const SEGMENT_NAME = /^segment_\d{4,5}\.webm$/
const DEFAULT_TIMEOUT_MS = 6 * 60 * 60 * 1000
const MAX_FFMPEG_INPUTS = 8

function resolveFfmpegPath({ ffmpegPath, env = process.env, isPackaged = false, resourcesPath = process.resourcesPath, platform = process.platform } = {}) {
  if (ffmpegPath) return ffmpegPath
  if (isPackaged) return path.join(resourcesPath, 'ffmpeg', platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (env.FFMPEG_PATH) return env.FFMPEG_PATH
  return platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

function resolveFfprobePath({ ffprobePath, env = process.env, isPackaged = false, resourcesPath = process.resourcesPath, platform = process.platform } = {}) {
  if (ffprobePath) return ffprobePath
  if (isPackaged) return path.join(resourcesPath, 'ffmpeg', platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
  if (env.FFPROBE_PATH) return env.FFPROBE_PATH
  return platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
}

function messageOf(error) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000)
}

function cancellationError(signal) {
  const reason = signal?.reason
  const error = new Error(reason instanceof Error ? reason.message : 'Media finalization was paused because the film or recording became active.', reason instanceof Error ? { cause: reason } : undefined)
  error.name = 'AbortError'
  return error
}

function seconds(milliseconds) {
  return (Math.max(0, milliseconds) / 1000).toFixed(3)
}

function isWithin(directory, candidate) {
  const relative = path.relative(directory, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function sourceHasLoss(record) {
  if (!record || !Array.isArray(record.segments)) return true
  if (record.status === 'error' || (record.errors?.length ?? 0) > 0) return true
  const ordered = [...record.segments].sort((left, right) => left.sequence - right.sequence)
  if (ordered.some((segment) => segment.status === 'error' || segment.validation?.status !== 'valid')) return true
  return ordered.some((segment, index) => segment.sequence !== index + 1)
}

class MediaFinalizer {
  constructor({ ffmpegPath, ffprobePath, isPackaged = false, resourcesPath = process.resourcesPath, spawnProcess = spawn, platform = process.platform, timeoutMs = DEFAULT_TIMEOUT_MS, now = () => new Date() } = {}) {
    this.ffmpegPath = resolveFfmpegPath({ ffmpegPath, isPackaged, resourcesPath, platform })
    this.ffprobePath = resolveFfprobePath({ ffprobePath, isPackaged, resourcesPath, platform })
    this.spawnProcess = spawnProcess
    this.platform = platform
    this.timeoutMs = timeoutMs
    this.now = now
  }

  async run(binary, args, label, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(cancellationError(signal))
      let settled = false
      let stderr = ''
      let stdout = ''
      let timedOut = false
      let abortRequested = false
      let spawned = false
      let processError = null
      let child
      let timer
      const onAbort = () => {
        abortRequested = true
        try { child?.kill() } catch { /* Closing the child below settles the cancellation. */ }
      }
      const finish = (error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      }
      timer = setTimeout(() => {
        timedOut = true
        child?.kill()
      }, this.timeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        const prefix = binary === this.ffprobePath ? [] : ['-hide_banner', '-nostdin']
        child = this.spawnProcess(binary, [...prefix, ...args], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        finish(error)
        return
      }
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12_000) })
      child.stderr?.setEncoding('utf8')
      child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12_000) })
      child.once('spawn', () => { spawned = true })
      child.once('error', (error) => {
        processError = error
        // A spawn error means no FFmpeg process exists; post-spawn errors must
        // wait for close so recovery cannot start while the child is alive.
        if (!spawned) finish(abortRequested ? cancellationError(signal) : error)
      })
      child.once('close', (code, closeSignal) => {
        if (abortRequested) return finish(cancellationError(signal))
        if (timedOut) return finish(new Error(`${label} timed out after ${this.timeoutMs} ms`))
        if (processError) return finish(processError)
        if (code === 0) finish()
        else finish(new Error(`${label} failed${code === null ? ` (${closeSignal ?? 'terminated'})` : ` (exit ${code})`}${stderr.trim() ? `: ${stderr.trim()}` : ''}`))
      })
      if (signal?.aborted) onAbort()
    })
  }

  async validateFile(filePath, source, fallbackDurationMs = null, signal) {
    const stream = source === 'audio' || SOURCE_TYPE[source] === 'audio' ? 'a' : 'v'
    await this.run(this.ffmpegPath, [
      '-v', 'error', '-xerror', '-err_detect', 'explode', '-threads', '1', '-i', filePath,
      '-map', `0:${stream}:0`, '-f', 'null', '-',
    ], `Decoding ${path.basename(filePath)}`, signal)
    const probe = await this.run(this.ffprobePath, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ], `Probing ${path.basename(filePath)}`, signal)
    const durationMs = Number(probe.stdout) * 1000
    if (Number.isFinite(durationMs) && durationMs > 0) return { durationMs, estimated: false }
    if (Number.isFinite(fallbackDurationMs) && fallbackDurationMs > 0) return { durationMs: fallbackDurationMs, estimated: true }
    throw new Error(`Could not read the duration of ${path.basename(filePath)}`)
  }

  async segmentPath(sessionDirectory, source, segment) {
    if (!SOURCES.includes(source) || typeof segment.fileName !== 'string' || !SEGMENT_NAME.test(segment.fileName)) {
      throw new Error('Unsafe recording segment path')
    }
    const sourceDirectory = path.join(sessionDirectory, source)
    const sourceStat = await fs.lstat(sourceDirectory)
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error('Recording source path is not a local directory')
    const filePath = path.resolve(sourceDirectory, segment.fileName)
    if (!isWithin(sourceDirectory, filePath)) throw new Error('Recording segment escaped its session folder')
    const stat = await fs.lstat(filePath)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error('Recording segment is empty or is not a regular local file')
    return filePath
  }

  async inputSegments(session, source, persist, log, signal) {
    const record = session.manifest.sources?.[source]
    if (!record || !Array.isArray(record.segments)) return []
    const valid = []
    for (const segment of [...record.segments].sort((left, right) => left.timelineMs - right.timelineMs || left.sequence - right.sequence)) {
      segment.validation = { status: 'checking', checkedAt: this.now().toISOString(), error: null }
      try {
        if (!Number.isFinite(segment.timelineMs) || segment.timelineMs < 0) throw new Error('Invalid segment timeline offset')
        const filePath = await this.segmentPath(session.directory, source, segment)
        const manifestDurationMs = segment.status === 'interrupted'
          ? Number.isFinite(segment.durableTimelineMs) && Number.isFinite(segment.durationMs) ? Math.max(0, segment.durationMs) : null
          : Number.isFinite(segment.durationMs) ? Math.max(0, segment.durationMs)
            : Number.isFinite(segment.endedAt) ? Math.max(0, segment.endedAt - segment.startedAt) : null
        const { durationMs: decodedDurationMs, estimated: durationEstimated } = await this.validateFile(filePath, source, manifestDurationMs, signal)
        segment.validation = { status: 'valid', checkedAt: this.now().toISOString(), decodedDurationMs, durationEstimated, error: null }
        if (segment.status === 'interrupted') {
          segment.recoveredFrom = 'interrupted'
          segment.status = 'saved'
          segment.error = null
        }
        valid.push({ ...segment, decodedDurationMs, durationEstimated, filePath })
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw cancellationError(signal)
        const message = messageOf(error)
        segment.validation = { status: 'error', checkedAt: this.now().toISOString(), error: message }
        segment.error ??= message
        record.errors ??= []
        const sourceError = `segment_${String(segment.sequence).padStart(4, '0')}: ${message}`
        if (!record.errors.includes(sourceError)) record.errors.push(sourceError)
        session.manifest.errors ??= []
        if (!session.manifest.errors.some((entry) => entry.source === source && entry.segment === segment.sequence && entry.message === message)) {
          session.manifest.errors.push({ source, segment: segment.sequence, message, at: this.now().toISOString() })
        }
        await log(`${source} segment_${String(segment.sequence).padStart(4, '0')} decode failed: ${message}`)
      }
      await persist()
    }
    return valid
  }

  sessionDurationMs(manifest) {
    if (manifest.status === 'interrupted' && manifest.recovery?.durableTimelineVersion !== 1) return 0
    if (Number.isFinite(manifest.durationMs) && manifest.durationMs > 0) return manifest.durationMs
    const startedAt = Date.parse(manifest.startedAt)
    const endedAt = Date.parse(manifest.endedAt ?? this.now().toISOString())
    return Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : 0
  }

  videoEncoderArgs(bitrate) {
    if (this.platform === 'darwin') return ['-c:v', 'h264_videotoolbox', '-b:v', bitrate, '-allow_sw', '1']
    return ['-c:v', 'mpeg4', '-q:v', '4']
  }

  makeVideoGraph(segments, width, height, durationMs, inputStart = 0) {
    const duration = seconds(durationMs)
    const graph = [`color=c=black:s=${width}x${height}:r=24:d=${duration}[base0]`]
    let previous = 'base0'
    segments.forEach((segment, index) => {
      const inputIndex = inputStart + index
      const clip = `clip${inputStart}_${index}`
      const next = `layer${inputStart}_${index}`
      graph.push(`[${inputIndex}:v:0]setpts=PTS-STARTPTS+${seconds(segment.timelineMs)}/TB,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=24,format=yuv420p[${clip}]`)
      graph.push(`[${previous}][${clip}]overlay=x=0:y=0:shortest=0:eof_action=pass:repeatlast=0[${next}]`)
      previous = next
    })
    return { graph, output: previous, inputCount: segments.length }
  }

  makeAudioGraph(segments, durationMs, inputStart = 0) {
    const graph = []
    const labels = segments.map((segment, index) => {
      const inputIndex = inputStart + index
      const label = `audio${inputStart}_${index}`
      graph.push(`[${inputIndex}:a:0]asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round(segment.timelineMs)}:all=1[${label}]`)
      return `[${label}]`
    })
    graph.push(`${labels.join('')}amix=inputs=${segments.length}:duration=longest:dropout_transition=0,apad=pad_dur=${seconds(durationMs)},atrim=duration=${seconds(durationMs)},asetpts=PTS-STARTPTS[aout]`)
    return graph
  }

  async writeOutput(session, name, extension, args, streamType, durationMs, persist, log, signal) {
    const finalDirectory = path.join(session.directory, 'final')
    await fs.mkdir(finalDirectory, { recursive: true })
    const finalDirectoryStat = await fs.lstat(finalDirectory)
    if (!finalDirectoryStat.isDirectory() || finalDirectoryStat.isSymbolicLink()) throw new Error('Final recording path is not a local directory')
    const filePath = path.join(finalDirectory, `${name}.${extension}`)
    const relativePath = path.join('final', `${name}.${extension}`)
    const existing = await fs.lstat(filePath).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error))
    if (existing) {
      if (!existing.isFile() || existing.isSymbolicLink()) throw new Error(`Refusing to replace non-file output ${relativePath}`)
      try {
        const { durationMs: actualDurationMs } = await this.validateFile(filePath, streamType, null, signal)
        if (Math.abs(actualDurationMs - durationMs) > 250) throw new Error(`Expected ${seconds(durationMs)} seconds, decoded ${seconds(actualDurationMs)} seconds`)
        return { status: 'saved', path: relativePath, bytes: existing.size, durationMs: actualDurationMs, reused: true, error: null }
      } catch (error) {
        throw new Error(`Existing output is not decodable; preserved it: ${messageOf(error)}`, { cause: error })
      }
    }
    const temporary = path.join(finalDirectory, `.${name}.partial.${extension}`)
    try {
      const previousTemporary = await fs.lstat(temporary).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error))
      if (previousTemporary && (!previousTemporary.isFile() || previousTemporary.isSymbolicLink())) throw new Error('Refusing to replace an unsafe temporary output path')
      await this.run(this.ffmpegPath, [...args, '-y', '-movflags', '+faststart', '-f', extension === 'm4a' ? 'ipod' : 'mp4', temporary], `Building ${relativePath}`, signal)
      const { durationMs: actualDurationMs } = await this.validateFile(temporary, streamType, null, signal)
      if (Math.abs(actualDurationMs - durationMs) > 250) throw new Error(`Expected ${seconds(durationMs)} seconds, decoded ${seconds(actualDurationMs)} seconds`)
      const temporaryStat = await fs.lstat(temporary)
      if (!temporaryStat.isFile() || temporaryStat.size === 0) throw new Error(`FFmpeg produced an empty ${relativePath}`)
      const outputHandle = await fs.open(temporary, 'r+')
      try { await outputHandle.sync() } finally { await outputHandle.close() }
      try { await fs.link(temporary, filePath) }
      catch (error) {
        if (error.code !== 'EEXIST') throw error
        throw new Error(`Output already exists; refusing to overwrite ${relativePath}`, { cause: error })
      }
      await fs.unlink(temporary)
      try {
        const directory = await fs.open(finalDirectory, 'r')
        try { await directory.sync() } finally { await directory.close() }
      } catch { /* Some filesystems do not expose directory fsync. */ }
      await log(`final output saved ${relativePath} (${temporaryStat.size} bytes)`)
      return { status: 'saved', path: relativePath, bytes: temporaryStat.size, durationMs: actualDurationMs, reused: false, error: null }
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw cancellationError(signal)
      const message = messageOf(error)
      await log(`final output failed ${relativePath}: ${message}`)
      await persist()
      throw new Error(`${message}${await fs.access(temporary).then(() => `; partial output kept at ${path.basename(temporary)}`).catch(() => '')}`, { cause: error })
    }
  }

  async createWorkDirectory(session) {
    const finalDirectory = path.join(session.directory, 'final')
    await fs.mkdir(finalDirectory, { recursive: true })
    const stat = await fs.lstat(finalDirectory)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Final recording path is not a local directory')
    return fs.mkdtemp(path.join(finalDirectory, '.alu-finalize-'))
  }

  async renderVideoBatch(segments, width, height, startMs, endMs, outputPath, bitrate, signal) {
    const localSegments = segments.map((segment) => ({ ...segment, timelineMs: Math.max(0, segment.timelineMs - startMs) }))
    const durationMs = Math.max(1, endMs - startMs)
    const inputArgs = segments.flatMap((segment) => ['-i', segment.filePath])
    const { graph, output } = this.makeVideoGraph(localSegments, width, height, durationMs)
    await this.run(this.ffmpegPath, [
      ...inputArgs, '-filter_complex', graph.join(';'), '-map', `[${output}]`,
      ...this.videoEncoderArgs(bitrate), '-threads', '2', '-pix_fmt', 'yuv420p', '-t', seconds(durationMs),
      '-y', '-f', 'mp4', outputPath,
    ], `Rendering bounded video batch ${path.basename(outputPath)}`, signal)
    return { path: outputPath, durationMs }
  }

  async concatenateVideoParts(parts, workDirectory, bitrate, signal) {
    let current = parts
    let level = 0
    while (current.length > 1) {
      const next = []
      for (let offset = 0; offset < current.length; offset += MAX_FFMPEG_INPUTS) {
        const batch = current.slice(offset, offset + MAX_FFMPEG_INPUTS)
        if (batch.length === 1) { next.push(batch[0]); continue }
        const filterParts = batch.map((_, index) => `[${index}:v:0]setpts=PTS-STARTPTS[v${index}]`)
        filterParts.push(`${batch.map((_, index) => `[v${index}]`).join('')}concat=n=${batch.length}:v=1:a=0[vout]`)
        const durationMs = batch.reduce((total, part) => total + part.durationMs, 0)
        const outputPath = path.join(workDirectory, `video-join-${level}-${offset}.mp4`)
        await this.run(this.ffmpegPath, [
          ...batch.flatMap((part) => ['-i', part.path]), '-filter_complex', filterParts.join(';'), '-map', '[vout]',
          ...this.videoEncoderArgs(bitrate), '-threads', '2', '-pix_fmt', 'yuv420p', '-t', seconds(durationMs),
          '-y', '-f', 'mp4', outputPath,
        ], `Joining bounded video batches ${path.basename(outputPath)}`, signal)
        next.push({ path: outputPath, durationMs })
      }
      current = next
      level += 1
    }
    return current[0]
  }

  async buildVideoTrack(session, source, segments, durationMs, persist, log, signal) {
    if (segments.length === 0) return { status: 'error', error: 'No decodable video segments are available' }
    const [width, height] = source === 'camera' ? [1280, 720] : [1920, 1080]
    const bitrate = source === 'camera' ? '2500k' : '5000k'
    const workDirectory = await this.createWorkDirectory(session)
    try {
      const groups = []
      for (let offset = 0; offset < segments.length; offset += MAX_FFMPEG_INPUTS) groups.push(segments.slice(offset, offset + MAX_FFMPEG_INPUTS))
      const parts = []
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]
        const startMs = index === 0 ? 0 : group[0].timelineMs
        const nextStart = groups[index + 1]?.[0].timelineMs
        const endMs = nextStart === undefined ? durationMs : Math.max(startMs + 1, nextStart)
        parts.push(await this.renderVideoBatch(group, width, height, startMs, endMs, path.join(workDirectory, `video-batch-${index}.mp4`), bitrate, signal))
      }
      const merged = await this.concatenateVideoParts(parts, workDirectory, bitrate, signal)
      return await this.writeOutput(session, `${source}_full`, 'mp4', [
        '-i', merged.path, '-map', '0:v:0', '-c:v', 'copy', '-t', seconds(durationMs),
      ], 'video', durationMs, persist, log, signal)
    } finally { await fs.rm(workDirectory, { recursive: true, force: true }).catch(() => undefined) }
  }

  async renderAudioBatch(segments, startMs, endMs, outputPath, signal) {
    const localSegments = segments.map((segment) => ({ ...segment, timelineMs: Math.max(0, segment.timelineMs - startMs) }))
    const durationMs = Math.max(1, endMs - startMs)
    const graph = this.makeAudioGraph(localSegments, durationMs)
    await this.run(this.ffmpegPath, [
      ...segments.flatMap((segment) => ['-i', segment.filePath]), '-filter_complex', graph.join(';'), '-map', '[aout]',
      '-c:a', 'aac', '-threads', '1', '-b:a', '160k', '-t', seconds(durationMs), '-y', '-f', 'ipod', outputPath,
    ], `Rendering bounded audio batch ${path.basename(outputPath)}`, signal)
    return { path: outputPath, durationMs }
  }

  async concatenateAudioParts(parts, workDirectory, signal) {
    let current = parts
    let level = 0
    while (current.length > 1) {
      const next = []
      for (let offset = 0; offset < current.length; offset += MAX_FFMPEG_INPUTS) {
        const batch = current.slice(offset, offset + MAX_FFMPEG_INPUTS)
        if (batch.length === 1) { next.push(batch[0]); continue }
        const graph = `${batch.map((_, index) => `[${index}:a:0]asetpts=PTS-STARTPTS[a${index}]`).join(';')};${batch.map((_, index) => `[a${index}]`).join('')}concat=n=${batch.length}:v=0:a=1[aout]`
        const durationMs = batch.reduce((total, part) => total + part.durationMs, 0)
        const outputPath = path.join(workDirectory, `audio-join-${level}-${offset}.m4a`)
        await this.run(this.ffmpegPath, [
          ...batch.flatMap((part) => ['-i', part.path]), '-filter_complex', graph, '-map', '[aout]',
          '-c:a', 'aac', '-threads', '1', '-b:a', '160k', '-t', seconds(durationMs), '-y', '-f', 'ipod', outputPath,
        ], `Joining bounded audio batches ${path.basename(outputPath)}`, signal)
        next.push({ path: outputPath, durationMs })
      }
      current = next
      level += 1
    }
    return current[0]
  }

  async buildAudioTrack(session, segments, durationMs, persist, log, signal) {
    if (segments.length === 0) return { status: 'error', error: 'No decodable microphone segments are available' }
    const workDirectory = await this.createWorkDirectory(session)
    try {
      const groups = []
      for (let offset = 0; offset < segments.length; offset += MAX_FFMPEG_INPUTS) groups.push(segments.slice(offset, offset + MAX_FFMPEG_INPUTS))
      const parts = []
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]
        const startMs = index === 0 ? 0 : group[0].timelineMs
        const nextStart = groups[index + 1]?.[0].timelineMs
        const endMs = nextStart === undefined ? durationMs : Math.max(startMs + 1, nextStart)
        parts.push(await this.renderAudioBatch(group, startMs, endMs, path.join(workDirectory, `audio-batch-${index}.m4a`), signal))
      }
      const merged = await this.concatenateAudioParts(parts, workDirectory, signal)
      return await this.writeOutput(session, 'microphone_full', 'm4a', [
        '-i', merged.path, '-map', '0:a:0', '-c:a', 'copy', '-t', seconds(durationMs),
      ], 'audio', durationMs, persist, log, signal)
    } finally { await fs.rm(workDirectory, { recursive: true, force: true }).catch(() => undefined) }
  }

  async buildCombined(session, screenFile, cameraFile, microphoneFile, durationMs, persist, log, signal) {
    if (!screenFile || !cameraFile || !microphoneFile) {
      return { status: 'skipped', error: 'Combined video requires decodable screen, camera, and microphone segments' }
    }
    const graph = [
      `[0:v:0]setpts=PTS-STARTPTS[screen]`,
      `[1:v:0]setpts=PTS-STARTPTS,scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:color=black,fps=24,format=yuv420p[camera]`,
      `[screen][camera]overlay=x=W-w-40:y=H-h-40:shortest=0:eof_action=pass:repeatlast=0,trim=duration=${seconds(durationMs)},setpts=PTS-STARTPTS[vout]`,
      `[2:a:0]asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=pad_dur=${seconds(durationMs)},atrim=duration=${seconds(durationMs)},asetpts=PTS-STARTPTS[aout]`,
    ]
    const args = [
      '-i', screenFile, '-i', cameraFile, '-i', microphoneFile, '-filter_complex', graph.join(';'), '-map', '[vout]', '-map', '[aout]',
      ...this.videoEncoderArgs('5000k'), '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-threads', '1', '-b:a', '160k', '-t', seconds(durationMs),
    ]
    return this.writeOutput(session, 'combined', 'mp4', args, 'video', durationMs, persist, log, signal)
  }

  async finalizeSession(session, options = {}) {
    const { signal, persist = async () => undefined, log = async () => undefined } = options
    try { return await this.finalizeSessionTask(session, { signal, persist, log }) }
    catch (error) {
      if (!signal?.aborted && error?.name !== 'AbortError') throw error
      const manifest = session?.manifest
      if (manifest?.finalization?.status === 'finalizing') {
        manifest.finalization.status = 'pending'
        manifest.finalization.endedAt = this.now().toISOString()
        manifest.finalization.pauseReason = 'Paused because the film or a live recording became active; original segments are retained for retry.'
        await persist()
        await log(`media finalization paused ${manifest.finalization.endedAt}`)
      }
      throw cancellationError(signal)
    }
  }

  async finalizeSessionTask(session, { signal, persist = async () => undefined, log = async () => undefined } = {}) {
    const manifest = session.manifest
    if (!manifest || !session.directory) throw new Error('Invalid recording session for finalization')
    if (manifest.finalization?.status === 'finalizing') throw new Error('This recording is already being finalized')
    if (manifest.finalization?.status === 'complete' || manifest.finalization?.status === 'partial') {
      const finalFiles = manifest.finalization.files ?? {}
      const complete = Object.values(finalFiles).every((file) => file.status === 'saved' || file.status === 'skipped')
      if (complete) return { status: manifest.finalization.status, files: finalFiles, errors: manifest.finalization.errors ?? [] }
    }

    const startedAt = this.now().toISOString()
    manifest.finalization = {
      status: 'finalizing', startedAt, endedAt: null, files: {}, errors: [],
      timeline: { basis: 'per-segment relative MediaRecorder start offsets', precision: 'offsets come from renderer monotonic segment-open timestamps; final container duration is checked with ffprobe, while per-source capture starts can differ by a few frames' },
    }
    await persist()
    await log(`media finalization started ${startedAt}`)

    let durationMs = this.sessionDurationMs(manifest)
    const segments = {}
    const files = manifest.finalization.files
    for (const source of SOURCES) {
      try { segments[source] = await this.inputSegments(session, source, persist, log, signal) }
      catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw cancellationError(signal)
        segments[source] = []
        manifest.finalization.errors.push(`${source}: ${messageOf(error)}`)
      }
    }
    for (const source of SOURCES) {
      for (const segment of segments[source]) {
        durationMs = Math.max(durationMs, segment.timelineMs + segment.decodedDurationMs)
      }
    }
    manifest.durationMs = durationMs
    manifest.finalization.durationMs = durationMs

    for (const source of ['camera', 'microphone', 'screen']) {
      try {
        const record = source === 'microphone'
          ? await this.buildAudioTrack(session, segments[source], durationMs, persist, log, signal)
          : await this.buildVideoTrack(session, source, segments[source], durationMs, persist, log, signal)
        if (record.status === 'saved' && sourceHasLoss(manifest.sources[source])) {
          record.status = 'partial'
          record.error = 'The output preserves all known offsets, with blank or silent gaps where one or more source segments failed decode validation.'
        }
        files[source] = record
        if (record.status === 'error') manifest.finalization.errors.push(`${source}: ${record.error}`)
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw cancellationError(signal)
        files[source] = { status: 'error', path: null, bytes: 0, error: messageOf(error) }
        manifest.finalization.errors.push(`${source}: ${messageOf(error)}`)
      }
      await persist()
    }

    const hasTimelineLoss = SOURCES.some((source) => sourceHasLoss(manifest.sources[source]))
    if (hasTimelineLoss) manifest.finalization.timeline.incompleteIntervalsPreservedAsGaps = true
    try {
      files.combined = hasTimelineLoss
        ? { status: 'skipped', path: null, bytes: 0, error: 'Combined video skipped because one or more original segments were missing or failed decode validation; source timeline gaps were kept.' }
        : await this.buildCombined(
          session,
          files.screen?.status === 'saved' ? path.join(session.directory, files.screen.path) : null,
          files.camera?.status === 'saved' ? path.join(session.directory, files.camera.path) : null,
          files.microphone?.status === 'saved' ? path.join(session.directory, files.microphone.path) : null,
          durationMs, persist, log, signal,
        )
      if (files.combined.status === 'skipped') manifest.finalization.errors.push(`combined: ${files.combined.error}`)
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw cancellationError(signal)
      files.combined = { status: 'error', path: null, bytes: 0, error: messageOf(error) }
      manifest.finalization.errors.push(`combined: ${messageOf(error)}`)
    }

    const requiredTracks = ['camera', 'microphone', 'screen'].map((source) => files[source]?.status === 'saved')
    const allTracksSaved = requiredTracks.every(Boolean)
    const allTracksAvailable = ['camera', 'microphone', 'screen'].every((source) => ['saved', 'partial'].includes(files[source]?.status))
    const allSegmentsValid = !hasTimelineLoss
    const combinedOkay = files.combined?.status === 'saved'
    const errors = manifest.finalization.errors
    if (signal?.aborted) throw cancellationError(signal)
    manifest.finalization.status = allTracksSaved && allSegmentsValid && combinedOkay && errors.length === 0
      ? 'complete'
      : allTracksAvailable ? 'partial' : 'error'
    manifest.finalization.endedAt = this.now().toISOString()
    manifest.finalization.durationMs = durationMs
    if (!allSegmentsValid) {
      errors.push('Timeline is preserved using original per-segment offsets; intervals with invalid or absent segment data are blank/silent and cannot be reconstructed.')
    }
    await persist()
    await log(`media finalization ${manifest.finalization.status} ${manifest.finalization.endedAt}`)
    return { status: manifest.finalization.status, files, errors: [...errors] }
  }
}

module.exports = { MediaFinalizer, resolveFfmpegPath, resolveFfprobePath, DEFAULT_TIMEOUT_MS }
