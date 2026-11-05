const { app, BrowserWindow, desktopCapturer, net, protocol, session } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { appScheme, canCheckMediaPermission, canRequestMedia, isAppOrigin, resolveBundlePath } = require('./runtime-path.cjs')

const APP_ENTRY = 'app://bundle/index.html'
const DEVELOPMENT_URL = process.env.ALU_DEV_SERVER_URL

protocol.registerSchemesAsPrivileged([appScheme])

app.setName('A Little Universe for You')

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
  defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!canRequestMedia(request.securityOrigin, 'display-capture') || !request.videoRequested) return callback(null)
    const windowTitle = BrowserWindow.getAllWindows()[0]?.getTitle()
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1, height: 1 } })
      const appWindow = sources.find((source) => source.name === windowTitle)
      callback(appWindow ? { video: appWindow } : null)
    } catch (error) {
      console.error('Could not select the application window for capture.', error)
      callback(null)
    }
  })
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
  window.once('ready-to-show', () => window.show())
  const url = DEVELOPMENT_URL || APP_ENTRY
  void window.loadURL(url).catch((error) => {
    console.error('Could not start the local film.', error)
  })
  return window
}

app.whenReady().then(() => {
  registerMediaPermissions()
  if (!DEVELOPMENT_URL) installBundledProtocol()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
