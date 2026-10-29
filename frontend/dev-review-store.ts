import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { zipSync } from 'fflate'
import { buildReviewMarkdown } from './dev-review-export'

const scenes = ['prologue', 'growth', 'bloom', 'identity', 'gallery', 'eye', 'cosmos', 'greeting', 'ending'] as const
const priorities = ['low', 'medium', 'high']
const statuses = ['open', 'in_progress', 'ready_for_review', 'done']
type Data = Record<string, unknown>
const idPattern = /^[0-9a-f-]{36}$/
export function isAllowedRequest(remote: string | undefined, origin: string | undefined, host: string | undefined) {
  if (!remote || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || !host || !origin) return false
  try { const target = new URL(`http://${host}`); return new URL(origin).origin === target.origin && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) } catch { return false }
}
export function validateDraft(draft: Data, image: string) {
  if (!scenes.includes(draft.sceneId as typeof scenes[number]) || typeof draft.text !== 'string' || !draft.text.trim() || draft.text.length > 10000) throw new Error('Некорректная сцена или текст')
  if (!priorities.includes(String(draft.priority)) || typeof draft.localTimeSeconds !== 'number' || !Number.isFinite(draft.localTimeSeconds) || draft.localTimeSeconds < 0 || draft.localTimeSeconds > 10000 || typeof draft.frameId !== 'string' || !draft.frameId || draft.frameId.length > 150 || typeof draft.capturedMode !== 'string' || draft.capturedMode.length > 50) throw new Error('Некорректные данные момента')
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 12_000_000) throw new Error('Снимок PNG отсутствует или слишком велик')
  const png = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64')
  if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Некорректный PNG')
  return png
}
function sceneDir(scene: unknown) { const index = scenes.indexOf(scene as typeof scenes[number]); if (index < 0) throw new Error('Неизвестная сцена'); return `scene-${String(index + 1).padStart(2, '0')}` }
async function dir(base: string, name: string) { const result = path.join(base, name); try { await fs.mkdir(result) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e }; const stat = await fs.lstat(result); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Недопустимый каталог'); return result }
async function read(dirPath: string): Promise<Data[]> { try { const file = path.join(dirPath, 'notes.json'); const st = await fs.lstat(file); if (!st.isFile() || st.isSymbolicLink()) throw new Error('Недопустимый журнал'); const value: unknown = JSON.parse(await fs.readFile(file, 'utf8')); if (!Array.isArray(value)) throw new Error('Некорректный журнал'); return value as Data[] } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e } }
async function write(dirPath: string, notes: Data[]) { const temp = path.join(dirPath, `.${randomUUID()}.tmp`); try { await fs.writeFile(temp, JSON.stringify(notes, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temp, path.join(dirPath, 'notes.json')) } finally { await fs.rm(temp, { force: true }) } }
async function body(req: IncomingMessage): Promise<Data> { let size = 0; const parts: Buffer[] = []; for await (const p of req) { const b = Buffer.from(p as Buffer); size += b.length; if (size > 13_000_000) throw new Error('Слишком большой запрос'); parts.push(b) }; const data: unknown = JSON.parse(Buffer.concat(parts).toString('utf8')); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некорректный запрос'); return data as Data }
export function reviewNotesPlugin(): Plugin {
  let project = ''; let queue: Promise<unknown> = Promise.resolve()
  return { name: 'local-review-notes', apply: 'serve', configResolved(config) { project = path.resolve(config.root, '..') }, configureServer(server) {
    server.middlewares.use('/__dev_reviews', (req: IncomingMessage, res: ServerResponse) => {
      const origin = req.headers.origin ?? (req.method === 'GET' && req.headers['sec-fetch-site'] === 'same-origin' ? `http://${req.headers.host}` : undefined)
      if (!isAllowedRequest(req.socket.remoteAddress, origin, req.headers.host)) { res.writeHead(403).end('Forbidden'); return }
      const run = async () => {
        const root = await dir(project, 'dev-reviews'); const url = new URL(req.url ?? '/', 'http://localhost')
        if (req.method === 'GET' && url.pathname === '/') { const all: Data[] = []; for (const scene of scenes) all.push(...await read(await dir(root, sceneDir(scene)))); return { notes: all } }
        if (req.method === 'GET' && url.pathname === '/image') { const id = url.searchParams.get('id') ?? ''; if (!idPattern.test(id)) throw new Error('Некорректный id'); const scene = await dir(root, sceneDir(url.searchParams.get('scene'))); if (!(await read(scene)).some(n => n.id === id)) throw new Error('Заметка не найдена'); const file = path.join(await dir(scene, 'screenshots'), `${id}.png`); const st = await fs.lstat(file); if (!st.isFile() || st.isSymbolicLink()) throw new Error('Недопустимый снимок'); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); res.end(await fs.readFile(file)); return }
        const data = await body(req)
        if (req.method === 'POST' && (url.pathname === '/export' || url.pathname === '/archive')) {
          if (!Array.isArray(data.ids) || data.ids.length < 1 || data.ids.length > 100 || data.ids.some(id => typeof id !== 'string' || !idPattern.test(id)) || new Set(data.ids).size !== data.ids.length) throw new Error('Выберите от 1 до 100 заметок')
          const chosen: Data[] = []; const files: Record<string, Uint8Array> = {}; let totalBytes = 0
          for (const sceneId of scenes) {
            const sceneName = sceneDir(sceneId); const scene = await dir(root, sceneName)
            for (const note of await read(scene)) {
              if (!data.ids.includes(note.id)) continue
              if (note.sceneId !== sceneId || !idPattern.test(String(note.id)) || !statuses.slice(0, 3).includes(String(note.status))) throw new Error('Выбранная заметка недоступна для экспорта')
              const relative = `${sceneName}/screenshots/${note.id}.png`
              if (note.screenshotPath !== relative) throw new Error('Некорректный путь снимка')
              const file = path.join(await dir(scene, 'screenshots'), `${note.id}.png`)
              const st = await fs.lstat(file); if (!st.isFile() || st.isSymbolicLink()) throw new Error('Снимок отсутствует или недоступен')
              totalBytes += st.size; if (totalBytes > 80_000_000) throw new Error('Объём снимков превышает 80 МБ')
              files[relative] = await fs.readFile(file); chosen.push(note)
            }
          }
          if (chosen.length !== data.ids.length) throw new Error('Заметка или снимок не найдены; обновите журнал')
          const markdown = buildReviewMarkdown(chosen)
          if (url.pathname === '/archive') {
            files['codex-review.md'] = Buffer.from(markdown, 'utf8')
            const archive = zipSync(files, { level: 0 })
            res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="codex-review.zip"', 'Cache-Control': 'no-store' }); res.end(archive); return
          }
          const name = `codex-review-${randomUUID()}.md`
          await fs.writeFile(path.join(root, name), markdown, { flag: 'wx' })
          return { markdown, path: `dev-reviews/${name}` }
        }
        if (req.method === 'POST' && url.pathname === '/') { const draft = data.note as Data; if (!draft || typeof draft !== 'object') throw new Error('Нет заметки'); const png = validateDraft(draft, String(data.image ?? '')); const id = randomUUID(); const name = sceneDir(draft.sceneId); const scene = await dir(root, name); const imageDir = await dir(scene, 'screenshots'); const file = path.join(imageDir, `${id}.png`); const notes = await read(scene); const note = { id, sceneId: draft.sceneId, frameId: draft.frameId, localTimeSeconds: draft.localTimeSeconds, capturedMode: draft.capturedMode, checkpoint: draft.checkpoint, createdAt: new Date().toISOString(), text: (draft.text as string).trim(), priority: draft.priority, status: 'open', screenshotPath: `${name}/screenshots/${id}.png`, viewport: draft.viewport, config: draft.config }; await fs.writeFile(file, png, { flag: 'wx' }); try { await write(scene, [...notes, note]) } catch (e) { await fs.rm(file, { force: true }); throw e }; return { note } }
        if ((req.method === 'PATCH' || req.method === 'DELETE') && url.pathname === '/') {
          if (typeof data.id !== 'string' || !idPattern.test(data.id)) throw new Error('Некорректный id')
          const scene = await dir(root, sceneDir(data.sceneId)); const notes = await read(scene); const i = notes.findIndex(n => n.id === data.id)
          if (i < 0) throw new Error('Заметка не найдена')
          if (req.method === 'DELETE') {
            const imageDir = await dir(scene, 'screenshots'); const image = path.join(imageDir, `${data.id}.png`)
            const stat = await fs.lstat(image); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Снимок недоступен; заметка сохранена')
            // Move first, then commit the journal. Restore the image on a failed journal write.
            const temporary = path.join(imageDir, `.${randomUUID()}.deleting`)
            await fs.rename(image, temporary)
            try { notes.splice(i, 1); await write(scene, notes) }
            catch (error) { await fs.rename(temporary, image); throw error }
            try { await fs.rm(temporary); return { ok: true } }
            catch { return { ok: true, warning: `Заметка удалена, но временный файл снимка ${path.basename(temporary)} не удалось удалить.` } }
          }
          if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 10000 || !priorities.includes(String(data.priority)) || !statuses.includes(String(data.status))) throw new Error('Некорректные поля')
          notes[i] = { ...notes[i], text: data.text.trim(), priority: data.priority, status: data.status }; await write(scene, notes); return { note: notes[i] }
        }
        res.writeHead(404).end('Not found')
      }
      const task = queue.then(run); queue = task.catch(() => undefined)
      void task.then(result => { if (result !== undefined) { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(result)) } }).catch((e: unknown) => { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Ошибка записи' })) })
    })
  } }
}
