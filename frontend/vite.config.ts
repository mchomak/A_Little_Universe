import react from '@vitejs/plugin-react'
import { reviewNotesPlugin } from './dev-review-store'
import { defineConfig } from 'vitest/config'
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'
import { createReadStream, realpathSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'


/** Private reconstruction derivatives are served only by the local dev server. */
function irisLabAssets(): Plugin {
  return {
    name: 'iris-lab-assets',
    apply: 'serve',
    configureServer(server) {
      const directory = resolve(server.config.root, 'dev-assets/iris/vasilisa')
      server.middlewares.use('/__iris-assets/vasilisa/', (request, response, next) => {
        const name = (request.url ?? '').split('?')[0] ?? ''
        if (!/^\/[A-Za-z0-9_-]+\.(?:json|png|bin)$/.test(name)) { response.statusCode = 404; response.end(); return }
        try {
          const root = realpathSync(directory)
          const file = realpathSync(resolve(directory, name.slice(1)))
          if (!file.startsWith(root + sep) || !statSync(file).isFile()) { response.statusCode = 404; response.end(); return }
          response.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : name.endsWith('.png') ? 'image/png' : 'application/octet-stream')
          response.setHeader('Cache-Control', 'no-store')
          createReadStream(file).on('error', next).pipe(response)
        } catch { response.statusCode = 404; response.end('Iris asset not found') }
      })
    },
  }
}
/** Every emitted runtime file belongs to one immutable, versioned offline snapshot. */
function offlineBuild(): Plugin {
  let base = '/'
  return {
    name: 'little-universe-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      base = config.base
      if (!base.startsWith('/') || base.startsWith('//')) throw new Error('Offline build requires a same-origin absolute Vite base path')
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const assets = Object.values(bundle).map((output) => {
          const bytes = Buffer.from(output.type === 'chunk' ? output.code : output.source)
          const extension = output.fileName.split('.').at(-1)?.toLowerCase()
          const kind = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'].includes(extension ?? '') ? 'image'
            : ['mp3', 'wav', 'ogg', 'm4a'].includes(extension ?? '') ? 'audio'
              : ['gltf', 'glb'].includes(extension ?? '') ? 'model' : 'file'
          const contentType = extension === 'js' ? 'javascript' : extension === 'css' ? 'text/css' : extension === 'html' ? 'text/html' : undefined
          return { url: `${base}${output.fileName}`, kind, required: true, bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'), ...(contentType ? { contentType } : {}) }
        }).sort((a, b) => a.url.localeCompare(b.url))
        const optionalAssets = [{ url: `${base}scene-composer.json`, kind: 'file', required: false }]
        const version = createHash('sha256').update(offlineBuild.toString()).update(JSON.stringify({ assets, optionalAssets })).digest('hex').slice(0, 20)
        const manifest = { version, assets, optionalAssets }
        this.emitFile({ type: 'asset', fileName: 'runtime-manifest.json', source: JSON.stringify(manifest) })
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const MANIFEST = ${JSON.stringify(manifest)};
const BASE = ${JSON.stringify(base)};
const CACHE = 'little-universe-' + MANIFEST.version;
const URLS = new Set(MANIFEST.assets.map(asset => new URL(asset.url, self.location.origin).href));
const OPTIONAL_URLS = new Set((MANIFEST.optionalAssets || []).map(asset => new URL(asset.url, self.location.origin).href));
const MANIFEST_URL = new URL(BASE + 'runtime-manifest.json', self.location.origin).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const asset of MANIFEST.assets) {
      const response = await fetch(new Request(asset.url, {cache: 'reload', signal: AbortSignal.timeout(25000)}));
      if (!response.ok || response.type === 'opaque') throw new Error('Unavailable runtime asset: ' + asset.url);
      const bytes = await response.clone().arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== asset.bytes || digest !== asset.sha256) throw new Error('Runtime integrity failure: ' + asset.url);
      await cache.put(asset.url, response);
    }
    await cache.put(BASE + 'runtime-manifest.json', new Response(JSON.stringify(MANIFEST), {headers: {'Content-Type': 'application/json'}}));
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('little-universe-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && url.pathname.startsWith(BASE);
  if (!navigation && request.url !== MANIFEST_URL && !URLS.has(request.url) && !OPTIONAL_URLS.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (navigation || request.url === MANIFEST_URL) {
      try { const response = await fetch(request); if (response.ok) return response; } catch { /* Offline snapshot below. */ }
      const cached = await cache.match(navigation ? BASE + 'index.html' : request.url, {ignoreVary: true});
      return cached || new Response('Offline resource unavailable', {status: 503});
    }
    if (OPTIONAL_URLS.has(request.url)) {
      const cached = await cache.match(request, {ignoreVary: true});
      try {
        const response = await fetch(request);
        if (response.ok) { await cache.put(request, response.clone()); return response; }
        if (response.status === 404) await cache.delete(request, {ignoreVary: true});
        return response;
      } catch {
        return cached || new Response(null, {status: 404});
      }
    }
    // Immutable same-origin build files are byte-verified. Dev preview may add
    // Vary: Origin; module CORS headers differ from the installation fetch.
    return (await cache.match(request, {ignoreVary: true})) || fetch(request);
  })());
});
` })
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), reviewNotesPlugin(), irisLabAssets(), offlineBuild()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})


