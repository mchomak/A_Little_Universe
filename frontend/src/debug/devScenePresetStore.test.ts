import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { scenePresetStorePlugin } from '../../dev-scene-preset-store'

let root: string
let server: ViteDevServer
let origin: string
const sample = { formatVersion: 1, configSchemaVersion: 20, id: 'growth-test', name: 'Growth test', scope: 'growth', savedAt: '2026-11-03T10:00:00.000Z', scene: { formationDuration: 3.5 }, openingBackground: { zoom: 1.2, offsetX: 0.1, offsetY: -0.1 } }
const send = (pathName: string, method = 'GET', value?: unknown, source = origin) => fetch(`${origin}/__scene-presets${pathName}`, { method, headers: { Origin: source, 'Content-Type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) })

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scene-preset-test-'))
  server = await createServer({ configFile: false, root, plugins: [scenePresetStorePlugin(path.join(root, 'scene-presets'))], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
  await server.listen()
  const address = server.httpServer!.address()
  if (!address || typeof address === 'string') throw new Error('No test server address')
  origin = `http://127.0.0.1:${address.port}`
})
afterAll(async () => { await server?.close(); if (root) await rm(root, { recursive: true, force: true }) })

describe('local scene preset store', () => {
  it('lists, reads, and atomically replaces a valid per-scene preset', async () => {
    const created = await send('', 'PUT', sample)
    expect(created.status, await created.clone().text()).toBe(201)
    expect((await created.json()).id).toBe('growth-test')
    expect((await (await send('?scope=growth')).json()).presets).toEqual([{ id: 'growth-test', name: 'Growth test', scope: 'growth', savedAt: sample.savedAt }])
    expect(await (await send('/growth-test?scope=growth')).json()).toMatchObject(sample)
    const replacement = { ...sample, name: 'Long growth', scene: { formationDuration: 3.8 } }
    expect((await send('', 'PUT', replacement)).status).toBe(201)
    expect(JSON.parse(await readFile(path.join(root, 'scene-presets', 'growth', 'growth-test.json'), 'utf8')).name).toBe('Long growth')
  })
  it('rejects foreign origins, unknown scopes, oversized documents, and invalid files', async () => {
    expect((await send('', 'PUT', sample, 'https://example.org')).status).toBe(403)
    expect((await send('?scope=../../other')).status).toBe(400)
    expect((await send('', 'PUT', { ...sample, scope: 'gallery', openingBackground: sample.openingBackground })).status).toBe(400)
    expect((await fetch(`${origin}/__scene-presets?scope=growth`, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '"x"'.repeat(100_000) })).status).toBe(413)
  })
})
