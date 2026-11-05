const { spawn } = require('node:child_process')
const net = require('node:net')
const electronBinary = require('electron')

const timeout = (promise, milliseconds, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), milliseconds)),
])

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitForPage(port) {
  const end = Date.now() + 30000
  while (Date.now() < end) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page' && target.url.startsWith('app://bundle/'))
      if (page) return page
    } catch { /* Electron has not opened its debugging endpoint yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Electron did not load the bundled application page')
}

async function inspectBundle(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await timeout(new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  }), 5000, 'opening the Electron DevTools connection')
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const resolve = pending.get(message.id)
    if (resolve) { pending.delete(message.id); resolve(message) }
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
  const result = await timeout(send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `fetch('/runtime-manifest.json').then(async response => {
      const manifest = await response.json();
      const seedResponse = await fetch('/scene-presets/index.json');
      const seedPresets = await seedResponse.json();
      const storageKey = 'a-little-universe.scene-presets.v1.smoke';
      localStorage.setItem(storageKey, 'persisted');
      const persistentStorage = localStorage.getItem(storageKey) === 'persisted';
      localStorage.removeItem(storageKey);
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 60000;
        const check = () => {
          const title = document.querySelector('#preparation-title')?.textContent?.trim();
          if (title === 'Почти всё готово' || title === 'Проверка камеры') return resolve();
          if (Date.now() >= deadline) return reject(new Error('Film assets did not finish their startup validation'));
          setTimeout(check, 100);
        };
        check();
      });
      return {
        secure: isSecureContext,
        origin: location.origin,
        title: document.title,
        rootText: document.querySelector('#preparation-title').textContent.trim(),
        requiredAssets: manifest.assets.filter(asset => asset.required).length,
        seedPresets: seedPresets.length,
        persistentStorage,
        cacheApi: 'caches' in globalThis,
      };
    })`,
  }), 35000, 'loading local runtime manifest and film UI')
  socket.close()
  if (result.error || result.result?.exceptionDetails) {
    throw new Error(result.result?.exceptionDetails?.text ?? result.error?.message ?? 'Bundle inspection failed')
  }
  return result.result.result.value
}

async function main() {
  const port = await availablePort()
  const desktop = spawn(electronBinary, [
    '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '.',
  ], { cwd: process.cwd(), stdio: 'inherit' })
  try {
    const page = await waitForPage(port)
    const result = await inspectBundle(page)
    if (!result.secure || result.origin !== 'app://bundle' || !result.requiredAssets
      || result.seedPresets < 1 || !result.persistentStorage) {
      throw new Error(`Bundled app failed its local-origin smoke test: ${JSON.stringify(result)}`)
    }
    console.log(`Bundled film rendered on ${result.origin}; required assets: ${result.requiredAssets}`)
    console.log(`UI: ${result.rootText}`)
  } finally {
    desktop.kill()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
