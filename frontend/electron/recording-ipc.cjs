const { shell } = require('electron')
const { isAppOrigin } = require('./runtime-path.cjs')

const CHANNELS = [
  'recording:create-session', 'recording:open-segment', 'recording:append-chunk',
  'recording:close-segment', 'recording:report-error', 'recording:finish-session',
  'recording:get-status', 'recording:open-folder',
]

function trusted(event, originCheck = isAppOrigin) {
  try { return originCheck(event.senderFrame?.url ?? event.sender?.getURL?.() ?? '') } catch { return false }
}

function installRecordingHandlers(ipcMain, store, { openPath = shell.openPath, originCheck = isAppOrigin } = {}) {
  const handle = (channel, operation) => ipcMain.handle(channel, (event, payload) => {
    if (!trusted(event, originCheck)) throw new Error('Recording access is limited to the bundled application')
    return operation(payload)
  })
  handle(CHANNELS[0], () => store.createSession())
  handle(CHANNELS[1], (value) => store.openSegment(value?.sessionId, value?.source, value?.sequence, value?.mimeType, value?.startedAt, value?.timelineMs))
  handle(CHANNELS[2], (value) => {
    const bytes = value?.bytes
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('Invalid recording chunk')
    return store.appendChunk(value?.sessionId, value?.source, value?.sequence, Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength))
  })
  handle(CHANNELS[3], (value) => store.closeSegment(value?.sessionId, value?.source, value?.sequence, value?.endedAt, value?.error ?? null))
  handle(CHANNELS[4], (value) => store.reportError(value?.sessionId, value?.source, value?.message))
  handle(CHANNELS[5], (value) => store.finishSession(value?.sessionId))
  handle(CHANNELS[6], (value) => store.getStatus(value?.sessionId))
  handle(CHANNELS[7], async (value) => {
    const status = await store.getStatus(value?.sessionId)
    const error = await openPath(status.directory)
    if (error) throw new Error('Could not open the recording folder')
    return true
  })
  return () => CHANNELS.forEach((channel) => ipcMain.removeHandler(channel))
}

module.exports = { CHANNELS, installRecordingHandlers, trusted }
