const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel) => (payload) => ipcRenderer.invoke(channel, payload)
contextBridge.exposeInMainWorld('desktopRecording', Object.freeze({
  available: true,
  createSession: invoke('recording:create-session'),
  openSegment: invoke('recording:open-segment'),
  markSegmentStarted: invoke('recording:mark-segment-started'),
  getRecoveryStatus: invoke('recording:get-recovery-status'),
  setFilmActive: invoke('recording:set-film-active'),
  retryRecovery: invoke('recording:retry-recovery'),
  appendChunk: invoke('recording:append-chunk'),
  closeSegment: invoke('recording:close-segment'),
  reportError: invoke('recording:report-error'),
  finishSession: invoke('recording:finish-session'),
  markStartupComplete: invoke('recording:mark-startup-complete'),
  discardSession: invoke('recording:discard-session'),
  getStatus: invoke('recording:get-status'),
  openFolder: invoke('recording:open-folder'),
}))
