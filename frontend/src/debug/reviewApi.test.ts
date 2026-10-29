import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { unzipSync, strFromU8 } from 'fflate'
import { reviewNotesPlugin } from '../../dev-review-store'

let root: string
let server: ViteDevServer
let origin: string
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2p8AAAAASUVORK5CYII='
async function send(route: string, method: string, data?: unknown, from = origin) {
  return fetch(`${origin}/__dev_reviews/${route}`, { method, headers: { Origin: from, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) })
}
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'review-test-'))
  const frontend = path.join(root, 'frontend'); await fs.mkdir(frontend)
  server = await createServer({ root: frontend, configFile: false, plugins: [reviewNotesPlugin()], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
  await server.listen(); const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw Error('No port'); origin = `http://127.0.0.1:${address.port}`
})
afterAll(async () => { await server?.close(); if (root) await fs.rm(root, { recursive: true, force: true }) })
describe('review notes local file API', () => {
  it('persists and reloads notes, exports only verified images, rejects traversal and failed image reads', async () => {
    const note = { sceneId: 'identity', frameId: '04.3 Имя', localTimeSeconds: 12.5, capturedMode: 'playing', checkpoint: { reading: false }, priority: 'high', text: 'Тестовая заметка', viewport: { width: 1024, height: 768, dpr: 2 }, config: { global: { quality: 'standard' } } }
    expect((await send('', 'POST', { note: { ...note, sceneId: '../escape' }, image: png })).status).toBe(400)
    expect((await send('', 'POST', { note, image: png }, 'https://example.com')).status).toBe(403)
    expect((await send('', 'PATCH', { ...note, id: '../../escape', status: 'open' })).status).toBe(400)
    const blockedDir = path.join(root, 'dev-reviews', 'scene-03')
    await fs.mkdir(blockedDir, { recursive: true }); await fs.writeFile(path.join(blockedDir, 'screenshots'), 'blocked')
    expect((await send('', 'POST', { note: { ...note, sceneId: 'bloom' }, image: png })).status).toBe(400)
    expect(await fs.stat(path.join(blockedDir, 'notes.json')).then(() => true, () => false)).toBe(false)
    const created = await send('', 'POST', { note, image: png }); expect(created.status).toBe(200)
    const saved = (await created.json()).note as { id: string; screenshotPath: string }
    expect(await fs.readFile(path.join(root, 'dev-reviews', saved.screenshotPath))).toEqual(Buffer.from(png.split(',')[1]!, 'base64'))
    expect((await (await send('', 'GET')).json()).notes).toHaveLength(1)
    expect((await send('', 'PATCH', { id: saved.id, sceneId: 'identity', text: note.text, priority: note.priority, status: 'ready_for_review' })).status).toBe(200)
    expect((await (await send('', 'GET')).json()).notes[0].status).toBe('ready_for_review')
    const exported = await send('export', 'POST', { ids: [saved.id] }); expect(exported.status).toBe(200)
    const result = await exported.json() as { markdown: string; path: string }
    expect(await fs.readFile(path.join(root, result.path), 'utf8')).toBe(result.markdown)
    expect(result.markdown).toContain(saved.screenshotPath)
    const archive = await send('archive', 'POST', { ids: [saved.id] }); expect(archive.status).toBe(200)
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    expect(strFromU8(entries['codex-review.md']!)).toContain(saved.screenshotPath)
    expect(entries[saved.screenshotPath]).toBeDefined()
    await fs.rm(path.join(root, 'dev-reviews', saved.screenshotPath))
    expect((await send('export', 'POST', { ids: [saved.id] })).status).toBe(400)
    expect((await send('', 'DELETE', { id: saved.id, sceneId: 'identity' })).status).toBe(400)
    expect((await (await send('', 'GET')).json()).notes).toHaveLength(1)
    expect((await send('', 'POST', { note, image: 'bad' })).status).toBe(400)
    expect((await (await send('', 'GET')).json()).notes).toHaveLength(1)
  })
})
