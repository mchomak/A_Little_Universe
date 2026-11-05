import { expect, it, vi } from 'vitest'
import { AssetManager, verifyRuntimeCache } from './AssetManager'

it('starts the optional startup config after real preload readiness without adding progress work', async () => {
  const events: string[] = []
  const configFetch = vi.fn(async (input: RequestInfo | URL) => {
    events.push(`config:${String(input)}`)
    return new Response('', { status: 404 })
  })
  vi.stubGlobal('fetch', configFetch)
  try {
    const manager = new AssetManager({ manifest: { version: 'optional-config', assets: [{ url: '/font.ttf', kind: 'file', required: true }],
      optionalAssets: [{ url: '/scene-composer.json', kind: 'file', required: false }] },
      loadModules: async () => undefined, fetch: async () => new Response('font'), verifyOffline: async () => undefined,
    })
    let finalProgress = { completed: 0, total: 0 }
    const result = await manager.prepare((progress) => {
      events.push(progress.phase)
      finalProgress = progress
    })
    expect(result.ready).toBe(true)
    expect(events.indexOf('ready')).toBeLessThan(events.findIndex((event) => event.startsWith('config:')))
    expect(configFetch).toHaveBeenCalledWith('/scene-composer.json', expect.objectContaining({ cache: 'no-cache' }))
    expect(finalProgress).toMatchObject({ phase: 'ready', completed: 2, total: 2 })
  } finally {
    vi.unstubAllGlobals()
  }
})

it('blocks a missing mandatory asset, then retries only unfinished work with real progress', async () => {
  let missing = true
  const fetchAsset = vi.fn(async (input: RequestInfo | URL) => new Response(
    String(input) === '/missing.txt' && missing ? 'missing' : 'real resource',
    { status: String(input) === '/missing.txt' && missing ? 404 : 200 },
  ))
  const modules = vi.fn(async () => undefined)
  const manager = new AssetManager({ development: true, loadModules: modules, fetch: fetchAsset,
    manifest: { version: 'test', assets: [
      { url: '/present.txt', kind: 'file', required: true },
      { url: '/missing.txt', kind: 'file', required: true },
    ] },
  })
  expect((await manager.prepare()).ready).toBe(false)
  missing = false
  const progress: number[] = []
  const result = await manager.retry((value) => { if (value.phase === 'assets') progress.push(value.completed) })
  expect(result).toMatchObject({ ready: true, offline: 'development', errors: [] })
  expect(modules).toHaveBeenCalledTimes(1)
  expect(fetchAsset).toHaveBeenCalledTimes(3)
  expect(progress.at(-1)).toBe(3)
})

it('optional failure does not block or dilute mandatory progress', async () => {
  const manager = new AssetManager({ development: true, loadModules: async () => undefined,
    fetch: async () => new Response('missing', { status: 404 }),
    manifest: { version: 'test', assets: [{ url: '/optional.png', kind: 'image', required: false }] },
  })
  let finalProgress = { completed: 0, total: 0 }
  const result = await manager.prepare((value) => { finalProgress = value })
  expect(result.ready).toBe(true)
  expect(result.warnings.some((warning) => warning.includes('/optional.png'))).toBe(true)
  expect(finalProgress).toMatchObject({ completed: 1, total: 1 })
})

it('verifies packaged Electron assets without depending on Service Worker or CacheStorage', async () => {
  const verifyOffline = vi.fn(async () => { throw new Error('CacheStorage is unavailable') })
  const manager = new AssetManager({ bundled: true, loadModules: async () => undefined,
    manifest: { version: 'electron-bundle', assets: [{ url: '/film.txt', kind: 'file', required: true, bytes: 4 }] },
    fetch: async () => new Response('film'), verifyOffline,
  })

  await expect(manager.prepare()).resolves.toMatchObject({ ready: true, offline: 'verified', warnings: [] })
  expect(verifyOffline).not.toHaveBeenCalled()
})

it('never claims offline readiness for a failed manifest response, and can retry cache verification', async () => {
  let broken = true
  const manifest = { version: 'cache-test', assets: [{ url: '/film.txt', kind: 'file' as const, required: true, bytes: 4 }] }
  const storage = { open: async () => ({ match: async (url: string) => url === '/film.txt'
    ? new Response('film') : new Response(JSON.stringify(manifest), { status: broken ? 500 : 200 }) }) as Cache }
  const manager = new AssetManager({ manifest, loadModules: async () => undefined,
    fetch: async () => new Response('film'), verifyOffline: (value) => verifyRuntimeCache(value, storage),
  })
  expect(await manager.prepare()).toMatchObject({ ready: true, offline: 'unavailable' })
  broken = false
  expect(await manager.retry()).toMatchObject({ ready: true, offline: 'verified' })
})

it('refuses a corrupt mandatory cached resource and exposes storage failures as an offline warning', async () => {
  const manifest = { version: 'corrupt', assets: [{ url: '/film.js', kind: 'file' as const, required: true,
    bytes: 4, contentType: 'javascript' }] }
  const storage = { open: async () => ({ match: async (url: string) => url === '/film.js'
    ? new Response('<bad', { headers: { 'Content-Type': 'text/html' } }) : new Response(JSON.stringify(manifest)) }) as Cache }
  await expect(verifyRuntimeCache(manifest, storage)).rejects.toThrow('Неверный тип ресурса')
  // A denied CacheStorage access must not block the already-loaded film.
  const manager = new AssetManager({ manifest, loadModules: async () => undefined,
    fetch: async () => new Response('film', { headers: { 'Content-Type': 'text/javascript' } }),
    verifyOffline: async () => { throw new Error('Storage denied') },
  })
  const result = await manager.prepare()
  expect(result).toMatchObject({ ready: true, offline: 'unavailable' })
  expect(result.warnings.join()).toContain('Storage denied')
})

it('requests page reload when the browser module import failed', async () => {
  const manager = new AssetManager({ development: true, loadModules: async () => { throw new Error('Failed to fetch dynamically imported module') } })
  expect(await manager.prepare()).toMatchObject({ ready: false, recovery: 'reload' })
})

it('rejects a GLB with a valid header but no model content', async () => {
  const bytes = new ArrayBuffer(12)
  const header = new DataView(bytes)
  header.setUint32(0, 0x46546c67, true)
  header.setUint32(4, 2, true)
  header.setUint32(8, 12, true)
  const manager = new AssetManager({ development: true, loadModules: async () => undefined,
    manifest: { version: 'broken-model', assets: [{ url: '/empty.glb', kind: 'model', required: true }] },
    fetch: async () => new Response(bytes),
  })
  const result = await manager.prepare()
  expect(result.ready).toBe(false)
  expect(result.errors.join()).toContain('/empty.glb')
})

it('repairs only missing or corrupt current-build cache entries and reports quota failure honestly', async () => {
  const sha256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
  const assets = ['/good.txt', '/corrupt.txt', '/missing.txt'].map((url) => ({ url, kind: 'file' as const, required: true, bytes: 5, sha256 }))
  const manifest = { version: 'repair-test', assets }
  const saved = new Map<string, Response>([
    ['/good.txt', new Response('hello')], ['/corrupt.txt', new Response('wrong')],
    ['/runtime-manifest.json', new Response(JSON.stringify(manifest))],
  ])
  let quota = false
  const storage = { open: async () => ({
    match: async (url: string) => saved.get(url)?.clone(),
    delete: async (url: string) => saved.delete(url),
    put: async (url: string, response: Response) => {
      if (quota) throw new Error('Storage quota exceeded')
      saved.set(url, response)
    },
  }) as unknown as Cache }
  const repairFetch = vi.fn<typeof fetch>(async () => new Response('hello'))
  const manager = new AssetManager({ manifest, loadModules: async () => undefined,
    fetch: async () => new Response('hello'), verifyOffline: (value) => verifyRuntimeCache(value, storage, repairFetch),
  })
  expect(await manager.prepare()).toMatchObject({ ready: true, offline: 'verified' })
  expect(repairFetch.mock.calls.map((args) => args[0])).toEqual(['/corrupt.txt', '/missing.txt'])
  await expect(verifyRuntimeCache(manifest, storage)).resolves.toBeUndefined()
  saved.delete('/missing.txt')
  quota = true
  const retry = await manager.retry()
  expect(retry).toMatchObject({ ready: true, offline: 'unavailable' })
  expect(retry.warnings.join()).toContain('Storage quota exceeded')
})

