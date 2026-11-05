const { app, BrowserWindow, desktopCapturer, ipcMain, net, protocol, session, shell, webContents } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { appScheme, canCheckMediaPermission, canRequestMedia, isAppOrigin, resolveBundlePath } = require('./runtime-path.cjs')
const { RecordingDiskStore } = require('./recording-store.cjs')
const { MediaFinalizer } = require('./media-finalizer.cjs')
const { RecordingRecoveryScheduler } = require('./recording-recovery-scheduler.cjs')
const { installRecordingHandlers } = require('./recording-ipc.cjs')
const { createAppWindowCaptureHandler } = require('./media-capture.cjs')
const { getRecordingRoot } = require('./recording-path.cjs')

const APP_ENTRY = 'app://bundle/index.html'
const DEVELOPMENT_URL = process.env.ALU_DEV_SERVER_URL

protocol.registerSchemesAsPrivileged([appScheme])

app.setName('A Little Universe for You')
let recordingStore
let recordingFinalizer
let recoveryScheduler
let finalizationQueue = Promise.resolve()

function queueFinalization(recording, callbacks) {
  const operation = finalizationQueue.then(() => recordingFinalizer.finalizeSession(recording, callbacks))
  finalizationQueue = operation.catch(() => undefined)
  return operation
}

function finalizeStoredSession(sessionId, { signal } = {}) {
  const recording = recordingStore.getSession(sessionId)
  return queueFinalization(recording, {
    signal,
    persist: () => recordingStore.persist(recording),
    log: (message) => recordingStore.log(recording, message),
  })
}

function registerRecordingIpc() {
  recordingStore = new RecordingDiskStore(getRecordingRoot(app))
  recordingFinalizer = new MediaFinalizer({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath })
  recoveryScheduler = new RecordingRecoveryScheduler({
    recover: async (sessionId, { signal } = {}) => {
      try { return await finalizeStoredSession(sessionId, { signal }) }
      catch (error) { console.error(`Could not recover recording session ${sessionId}.`, error); throw error }
    },
  })
  installRecordingHandlers(ipcMain, recordingStore, {
    openPath: shell.openPath,
    finalizer: { finalizeSession: (recording, callbacks) => queueFinalization(recording, callbacks) },
    getRecoveryStatus: () => recoveryScheduler.getStatus(),
    retryRecovery: () => recoveryScheduler.retryFailed(),
    onFilmActivity: (active) => recoveryScheduler.setBusy('film', active),
    onRecordingActivity: (active) => recoveryScheduler.setBusy('recording', active),
  })
  return recordingStore.recoverInterrupted().then((sessionIds) => {
    recoveryScheduler.enqueue(sessionIds)
  })
}

function installBundledProtocol() {
  const root = path.join(app.getAppPath(), 'dist')
  protocol.handle('app', async (request) => {
    try {
      const file = resolveBundlePath(root, request.url)
      const result = await net.fetch(pathToFileURL(file).href)
      if (!result.ok) return new Response('Not found', { status: 404 })
      const headers = new Headers(result.headers)
      if (file.endsWith('.html')) {
        headers.set('Content-Security-Policy', [
          "default-src 'self' data: blob:",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' blob:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-src 'none'",
        ].join('; '))
      }
      return new Response(result.body, { status: result.status, headers })
    } catch (error) {
      if (error && error.code === 'ERR_FILE_NOT_FOUND') return new Response('Not found', { status: 404 })
      console.error(`Failed to serve bundled resource ${request.url}.`, error)
      return new Response('Not found', { status: 404 })
    }
  })
}

function registerMediaPermissions() {
  const defaultSession = session.defaultSession
  defaultSession.setPermissionCheckHandler((contents, permission, origin) => {
    return !contents.isDestroyed() && canCheckMediaPermission(origin, permission)
  })
  defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    let isAppPage = false
    try { isAppPage = !contents.isDestroyed() && isAppOrigin(contents.getURL()) } catch { /* Deny invalid origins. */ }
    callback(isAppPage && canRequestMedia(contents.getURL(), permission, details.mediaTypes ?? []))
  })
  defaultSession.setDisplayMediaRequestHandler(createAppWindowCaptureHandler({
    isAppOrigin: (origin) => canRequestMedia(origin, 'display-capture'),
    getWebContents: (frame) => webContents.fromFrame(frame),
    getWindow: (contents) => BrowserWindow.fromWebContents(contents),
    getSources: (options) => desktopCapturer.getSources(options),
  }))
}

function createMainWindow() {
  const window = new BrowserWindow({
    title: 'A Little Universe for You',
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#080914',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  window.removeMenu()
  window.setTitle('A Little Universe for You')
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppOrigin(url)) event.preventDefault()
  })
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle('A Little Universe for You')
  })
  window.once('closed', () => recoveryScheduler?.setBusy('film', false))
  window.once('ready-to-show', () => window.show())
  const url = DEVELOPMENT_URL || APP_ENTRY
  void window.loadURL(url).catch((error) => {
    console.error('Could not start the local film.', error)
  })
  return window
}

app.whenReady().then(() => {
  registerMediaPermissions()
  void registerRecordingIpc().catch((error) => console.error('Could not scan local recording sessions for recovery.', error))
  if (!DEVELOPMENT_URL) installBundledProtocol()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
