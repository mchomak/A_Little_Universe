import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import { parseScenePreset, type ScenePresetScope, type ScenePresetV1 } from './src/debug/scenePresetModel'

const scopes = new Set<ScenePresetScope>(['preload', 'prologue', 'growth', 'bloom', 'identity', 'gallery', 'galaxy'])
const validId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
const safeName = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.trim().length <= 80 && ![...value].some(char => char.charCodeAt(0) < 32)
const fileId = (value: string) => value.trim().toLocaleLowerCase('ru-RU').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80)
const isScope = (value: string): value is ScenePresetScope => scopes.has(value as ScenePresetScope)

export type ScenePresetSummary = Pick<ScenePresetV1, 'id' | 'name' | 'scope' | 'savedAt'>

export function createScenePresetStore(directory: string) {
  const folder = (scope: ScenePresetScope) => resolve(directory, scope)
  const list = async (scope: ScenePresetScope): Promise<ScenePresetSummary[]> => {
    let names: string[]
    try { names = await readdir(folder(scope)) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
    const result: ScenePresetSummary[] = []
    for (const filename of names.filter(name => name.endsWith('.json'))) {
      try {
        const item = parseScenePreset(JSON.parse(await readFile(resolve(folder(scope), filename), 'utf8')), scope)
        result.push({ id: item.id, name: item.name, scope: item.scope, savedAt: item.savedAt })
      } catch { /* Invalid files are not exposed through the local API. */ }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id))
  }
  const read = async (scope: ScenePresetScope, id: string): Promise<ScenePresetV1> => {
    if (!validId(id)) throw Object.assign(new Error('Invalid preset id'), { code: 'INVALID' })
    const item = parseScenePreset(JSON.parse(await readFile(resolve(folder(scope), `${id}.json`), 'utf8')), scope)
    if (item.id !== id) throw Object.assign(new Error('Preset id mismatch'), { code: 'INVALID' })
    return item
  }
  const save = async (value: unknown): Promise<ScenePresetV1> => {
    if (!value || typeof value !== 'object') throw Object.assign(new Error('Invalid preset'), { code: 'INVALID' })
    const raw = value as Record<string, unknown>
    if (typeof raw.scope !== 'string' || !isScope(raw.scope) || !safeName(raw.name)) throw Object.assign(new Error('Invalid preset'), { code: 'INVALID' })
    const scope = raw.scope
    const generated = fileId(raw.name)
    if (!generated) throw Object.assign(new Error('Invalid preset name'), { code: 'INVALID' })
    const id = raw.id === undefined || raw.id === '' ? `${generated}-${randomUUID().slice(0, 8)}` : raw.id
    if (typeof id !== 'string' || !validId(id)) throw Object.assign(new Error('Invalid preset id'), { code: 'INVALID' })
    const item = parseScenePreset({ ...raw, id, scope }, scope)
    const dir = folder(scope)
    await mkdir(dir, { recursive: true })
    const target = resolve(dir, `${id}.json`)
    const temp = resolve(dir, `.${id}.${randomUUID()}.tmp`)
    try { await writeFile(temp, `${JSON.stringify(item, null, 2)}\n`, { flag: 'wx' }); await rename(temp, target) }
    finally { await rm(temp, { force: true }).catch(() => undefined) }
    return item
  }
  return { list, read, save }
}

function respond(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}
function localRequest(request: IncomingMessage): boolean {
  const host = request.headers.host ?? ''
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0] ?? ''
  const origin = request.headers.origin
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  return localHost && (!origin || origin === `http://${host}` || origin === `https://${host}`)
}
async function bodyJson(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
    if (Buffer.byteLength(body) > 256_000) throw Object.assign(new Error('Payload too large'), { code: 'TOO_LARGE' })
  }
  return JSON.parse(body)
}
function installRoutes(server: Pick<ViteDevServer, 'middlewares'>, store: ReturnType<typeof createScenePresetStore>) {
  server.middlewares.use('/__scene-presets', (request, response, next) => {
    if (!localRequest(request)) { respond(response, 403, { error: 'Local same-origin requests only' }); return }
    const url = new URL(request.url ?? '/', 'http://localhost')
    const scopeValue = url.searchParams.get('scope') ?? ''
    if (request.method === 'PUT' && url.pathname === '/') {
      void bodyJson(request).then(value => {
        if (!value || typeof value !== 'object' || !isScope(String((value as Record<string, unknown>).scope ?? ''))) throw Object.assign(new Error('Invalid scope'), { code: 'INVALID' })
        return store.save(value)
      }).then(preset => respond(response, 201, preset)).catch(error => {
        const code = (error as { code?: string }).code
        if (code === 'TOO_LARGE') respond(response, 413, { error: 'Payload too large' })
        else if (error instanceof SyntaxError || code === 'INVALID' || error?.name === 'ScenePresetValidationError') respond(response, 400, { error: 'Invalid preset document' })
        else next(error)
      })
      return
    }
    if (!isScope(scopeValue)) { respond(response, 400, { error: 'Invalid scope' }); return }
    const scope = scopeValue
    if (request.method === 'GET' && url.pathname === '/') {
      void store.list(scope).then(presets => respond(response, 200, { presets })).catch(next)
      return
    }
    if (request.method === 'GET' && /^\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
      void store.read(scope, url.pathname.slice(1)).then(preset => respond(response, 200, preset)).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') respond(response, 404, { error: 'Preset not found' })
        else if ((error as { code?: string }).code === 'INVALID') respond(response, 400, { error: 'Invalid preset' })
        else next(error)
      })
      return
    }
    response.setHeader('Allow', 'GET, PUT')
    respond(response, 405, { error: 'Method not allowed' })
  })
}

export function scenePresetStorePlugin(directory = resolve(process.cwd(), 'scene-presets')): Plugin {
  const store = createScenePresetStore(directory)
  return {
    name: 'scene-preset-store',
    apply: 'serve',
    configureServer(server) { installRoutes(server, store) },
    configurePreviewServer(server) { installRoutes(server, store) },
  }
}
