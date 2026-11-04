import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { SCENES, SCENE_ORDER, getPrologueTouchDuration } from '../engine/filmConfig'
import { getConfig } from '../systems/scene-config/config'
import { activeFrameIndex, timelineFrames } from './timelineModel'
import { frameExportCheckpoints } from './frameExportModel'
import { canRestoreReview, type Priority, type ReviewNote, type Status } from './reviewModel'
import { strToU8, zipSync } from 'fflate'
import './reviewNotes.css'

type Draft = Omit<ReviewNote, 'id' | 'createdAt' | 'status' | 'screenshotPath'>
type Editor = { draft: Draft; image: string; existing?: ReviewNote }
async function request(method: string, data?: unknown) {
  const response = await fetch('/__dev_reviews/', { method, headers: { 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  const result: unknown = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((result as { error?: string }).error || `Ошибка сервера (${response.status})`)
  return result as { notes?: ReviewNote[]; note?: ReviewNote; warning?: string }
}
async function capture(stream: MediaStream, hiddenAt: number) {
  const track = stream.getVideoTracks()[0]
  if (!track || track.getSettings().displaySurface !== 'browser') throw new Error('Выберите вкладку браузера с фильмом, а не окно или экран.')
  const video = document.createElement('video'); video.srcObject = stream; video.muted = true
  await video.play()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  // Wait for the captured tab to deliver a frame after the DEV UI was hidden.
  if (typeof video.requestVideoFrameCallback !== 'function') throw new Error('Браузер не позволяет подтвердить обновление кадра. Снимок не сохранён.')
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Не удалось получить обновлённый кадр вкладки. Повторите снимок.')), 3000)
    const updated: VideoFrameRequestCallback = (_now, metadata) => {
      if (metadata.presentationTime < hiddenAt) { video.requestVideoFrameCallback(updated); return }
      window.clearTimeout(timeout); resolve()
    }
    video.requestVideoFrameCallback(updated)
  })
  if (!video.videoWidth || !video.videoHeight) throw new Error('Не удалось получить кадр вкладки')
  const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
  const context = canvas.getContext('2d'); if (!context) throw new Error('Не удалось создать снимок')
  context.drawImage(video, 0, 0); return canvas.toDataURL('image/png')
}
function assertBrowserCapture(stream: MediaStream) {
  const track = stream.getVideoTracks()[0]
  if (!track || track.readyState !== 'live' || track.getSettings().displaySurface !== 'browser') {
    throw new Error('Захват вкладки завершён. Подключите вкладку сайта снова.')
  }
}
async function createTabScreenshotter(stream: MediaStream) {
  assertBrowserCapture(stream)
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  await video.play()
  return {
    async capture(signal: AbortSignal): Promise<Uint8Array> {
      if (signal.aborted) throw new Error('Экспорт остановлен.')
      const requestedAt = performance.now()
      if (typeof video.requestVideoFrameCallback !== 'function') throw new Error('Браузер не подтверждает обновление кадра вкладки.')
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Не удалось получить свежий кадр вкладки.')), 3000)
        const cleanup = () => {
          window.clearTimeout(timeout)
          signal.removeEventListener('abort', abort)
        }
        const abort = () => { cleanup(); reject(new Error('Экспорт остановлен.')) }
        const updated: VideoFrameRequestCallback = (_now, metadata) => {
          if (signal.aborted) { abort(); return }
          if (metadata.presentationTime < requestedAt) { video.requestVideoFrameCallback(updated); return }
          cleanup()
          resolve()
        }
        signal.addEventListener('abort', abort, { once: true })
        video.requestVideoFrameCallback(updated)
      })
      assertBrowserCapture(stream)
      if (!video.videoWidth || !video.videoHeight) throw new Error('Вкладка не передала изображение.')
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Не удалось подготовить PNG кадра.')
      context.drawImage(video, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Не удалось сформировать PNG кадра.')), 'image/png'))
      return new Uint8Array(await blob.arrayBuffer())
    },
    dispose() { video.pause(); video.srcObject = null },
  }
}
function waitForAnimationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}
function filenamePart(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'frame'
}
function frameFilename(sceneLabel: string, frameLabel: string, time: number) {
  return `${filenamePart(sceneLabel)}-${filenamePart(frameLabel)}-${time.toFixed(2)}s.png`
}
function waitForState(predicate: () => boolean, signal: AbortSignal, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const check = () => {
      if (signal.aborted) { reject(new Error('Экспорт остановлен.')); return }
      if (predicate()) { resolve(); return }
      if (performance.now() - started >= timeoutMs) { reject(new Error('Состояние сцены не обновилось. Экспорт остановлен.')); return }
      requestAnimationFrame(check)
    }
    check()
  })
}
export function useReviewNotes(state: FilmState, dispatch: Dispatch<FilmAction>, runtime: FilmRuntime, route: string) {
  const [notes, setNotes] = useState<ReviewNote[]>([])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [journal, setJournal] = useState(false)
  const [filterScene, setFilterScene] = useState('all')
  const [filterFrame, setFilterFrame] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [exportInfo, setExportInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [captureConnected, setCaptureConnected] = useState(false)
  const [capturePreview, setCapturePreview] = useState(false)
  const [frameExportProgress, setFrameExportProgress] = useState<{ current: number; total: number; message: string } | null>(null)
  const [frameExportResult, setFrameExportResult] = useState('')
  const captureStream = useRef<MediaStream | null>(null)
  const capturePreviewVideo = useRef<HTMLVideoElement | null>(null)
  const exportAbort = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const reload = useCallback(async () => { try { setNotes((await request('GET')).notes ?? []) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал') } }, [])
  useEffect(() => { void request('GET').then(result => setNotes(result.notes ?? []), e => setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал')) }, [])
  useEffect(() => () => {
    exportAbort.current?.abort()
    const stream = captureStream.current
    captureStream.current = null
    stream?.getTracks().forEach(track => track.stop())
  }, [])
  useEffect(() => {
    const video = capturePreviewVideo.current
    const stream = capturePreview && captureConnected ? captureStream.current : null
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => setError('Не удалось показать предпросмотр вкладки.'))
    return () => { video.pause(); video.srcObject = null }
  }, [capturePreview, captureConnected])
  const currentCaptureStream = () => {
    const stream = captureStream.current
    if (stream?.getVideoTracks().some(track => track.readyState === 'live')) return stream
    captureStream.current = null
    setCaptureConnected(false)
    return null
  }
  const connectCapture = async (): Promise<boolean> => {
    if (currentCaptureStream()) { setError(''); return true }
    if (!navigator.mediaDevices?.getDisplayMedia) { setError('Этот браузер не поддерживает захват вкладки.'); return false }
    setBusy(true); setError('')
    try {
      const captureOptions = {
        video: { displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      } as DisplayMediaStreamOptions & { preferCurrentTab: boolean; selfBrowserSurface: 'include' }
      const stream = await navigator.mediaDevices.getDisplayMedia(captureOptions)
      const track = stream.getVideoTracks()[0]
      if (!track || track.getSettings().displaySurface !== 'browser') {
        stream.getTracks().forEach(item => item.stop())
        throw new Error('Выберите именно вкладку браузера с фильмом, не окно и не весь экран.')
      }
      captureStream.current = stream
      setCaptureConnected(true)
      track.addEventListener('ended', () => {
        if (captureStream.current !== stream) return
        exportAbort.current?.abort()
        captureStream.current = null
        setCaptureConnected(false)
        setError('Захват вкладки остановлен. Подключите его снова перед следующим снимком.')
      }, { once: true })
      return true
    } catch (e) {
      setCaptureConnected(false)
      const error = e instanceof Error ? e : new Error('Не удалось подключить захват вкладки.')
      setError(error.name === 'NotAllowedError' || error.name === 'AbortError' ? 'Выбор источника отменён. Нажмите «Подключить вкладку» и выберите вкладку с фильмом.' : error.message)
      return false
    } finally { setBusy(false) }
  }
  const disconnectCapture = () => {
    const stream = captureStream.current
    captureStream.current = null
    setCaptureConnected(false)
    stream?.getTracks().forEach(track => track.stop())
  }
  const take = async (draft: Draft) => {
    const stream = currentCaptureStream()
    if (!stream) {
      setEditor({ draft, image: '' })
      setError('Сначала подключите вкладку кнопкой «Подключить вкладку» на Timeline.')
      return
    }
    setBusy(true); setError('')
    try {
      document.documentElement.classList.add('review-capturing')
      const image = await capture(stream, performance.now())
      setEditor({ draft, image })
    } catch (e) { setEditor({ draft, image: '' }); setError(e instanceof Error ? e.message : 'Не удалось снять кадр') }
    finally { document.documentElement.classList.remove('review-capturing'); setBusy(false) }
  }
  const begin = () => {
    if (route !== 'film' || editor || busy || state.mode === 'transitioning') { setError('Снимок доступен внутри сцены, вне перехода.'); return }
    const time = state.mode === 'playing' ? runtime.time : state.elapsed
    const frames = timelineFrames(state.scene, getConfig()); const frame = frames[activeFrameIndex(frames, time)]!
    const draft: Draft = { sceneId: state.scene, frameId: frame.label, localTimeSeconds: time, capturedMode: state.mode, checkpoint: { galleryIndex: state.galleryIndex, reading: state.reading }, text: '', priority: 'medium', viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }, config: structuredClone(getConfig()) }
    if (state.mode === 'playing' && !state.reading) dispatch({ type: 'dev-seek', time })
    if (!state.paused) dispatch({ type: 'toggle-pause' })
    void take(draft)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (event.key.toLowerCase() !== 'n' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || editor || journal || busy) return; event.preventDefault(); begin() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  const openNote = (note: ReviewNote) => {
    setJournal(false); setError('')
    if (canRestoreReview(note)) { dispatch({ type: 'dev-jump', scene: note.sceneId }); dispatch({ type: 'dev-seek', time: note.localTimeSeconds }); dispatch({ type: 'toggle-pause' }) }
    else setError('Этот checkpoint нельзя безопасно восстановить автоматически; показана сохранённая заметка.')
    setEditor({ draft: note, existing: note, image: `/__dev_reviews/image?scene=${encodeURIComponent(note.sceneId)}&id=${encodeURIComponent(note.id)}` })
  }
  const save = async () => {
    if (!editor || !editor.draft.text.trim()) { setError('Введите текст правки.'); return }
    if (!editor.existing && !editor.image) { setError('Сначала повторите захват вкладки.'); return }
    setBusy(true); setError('')
    try { if (editor.existing) await request('PATCH', { id: editor.existing.id, sceneId: editor.existing.sceneId, text: editor.draft.text, priority: editor.draft.priority, status: editor.existing.status }); else await request('POST', { note: editor.draft, image: editor.image }); await reload(); setEditor(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить заметку') } finally { setBusy(false) }
  }
  const updateStatus = async (note: ReviewNote, status: Status) => { try { await request('PATCH', { id: note.id, sceneId: note.sceneId, text: note.text, priority: note.priority, status }); await reload() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось обновить статус') } }
  const remove = async (note: ReviewNote) => { if (!window.confirm('Удалить заметку?')) return; try { const result = await request('DELETE', { id: note.id, sceneId: note.sceneId }); await reload(); if (result.warning) setError(result.warning) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить заметку') } }
  const exportNotes = async (action: 'save' | 'copy' | 'archive') => {
    const ids = notes.filter(note => selected.includes(note.id) && note.status !== 'done').map(note => note.id)
    if (!ids.length) { setError('Выберите заметки со статусом open, in_progress или ready_for_review.'); return }
    setBusy(true); setError(''); setExportInfo('')
    try {
      const response = await fetch(`/__dev_reviews/${action === 'archive' ? 'archive' : 'export'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || 'Не удалось сформировать экспорт') }
      if (action === 'archive') {
        const blob = await response.blob(); const url = URL.createObjectURL(blob)
        const link = document.createElement('a'); link.href = url; link.download = 'codex-review.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        setExportInfo('Архив подготовлен; проверьте загрузки браузера.')
      } else {
        const result = await response.json() as { markdown: string; path: string }
        setExportInfo(`Сохранено: ${result.path}. Пути снимков относительны к dev-reviews/.`)
        if (action === 'copy') {
          try { await navigator.clipboard.writeText(result.markdown); setExportInfo(`Скопировано; файл также сохранён: ${result.path}. Пути снимков относительны к dev-reviews/.`) }
          catch { setError(`Не удалось скопировать текст. Файл сохранён: ${result.path}.`) }
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сформировать экспорт') } finally { setBusy(false) }
  }
  const requestFrameExport = async () => {
    if (busy) return
    setError('')
    if (currentCaptureStream()) { setCapturePreview(true); return }
    if (await connectCapture()) setCapturePreview(true)
  }
  const captureCurrentFrame = async () => {
    if (busy) return
    const stream = currentCaptureStream()
    if (!stream) { setError('Сначала подключите вкладку сайта для снимков.'); return }
    if (route !== 'film') { setError('Текущий кадр доступен только внутри фильма.'); return }

    const current = stateRef.current
    const time = runtime.time
    const frames = timelineFrames(current.scene, getConfig())
    const frameLabel = current.mode === 'transitioning'
      ? 'Переход после касания'
      : frames[activeFrameIndex(frames, time)]?.label ?? SCENES[current.scene].label
    const filename = frameFilename(SCENES[current.scene].label, frameLabel, time)
    const controller = new AbortController()
    exportAbort.current = controller
    setBusy(true); setError(''); setFrameExportResult('')
    setFrameExportProgress({ current: 0, total: 0, message: 'Снимаем текущий кадр…' })
    let screenshotter: Awaited<ReturnType<typeof createTabScreenshotter>> | undefined
    try {
      screenshotter = await createTabScreenshotter(stream)
      if (controller.signal.aborted) throw new Error('Экспорт остановлен.')
      document.documentElement.classList.add('review-capturing', 'review-frame-capturing')
      const png = await screenshotter.capture(controller.signal)
      const url = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      setFrameExportResult(`Снимок скачан: ${filename}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось скачать снимок кадра.')
    } finally {
      document.documentElement.classList.remove('review-capturing', 'review-frame-capturing')
      screenshotter?.dispose()
      setFrameExportProgress(null)
      if (exportAbort.current === controller) exportAbort.current = null
      setBusy(false)
    }
  }
  const cancelFrameExport = () => exportAbort.current?.abort()
  const exportAllFrames = async () => {
    const stream = currentCaptureStream()
    if (!stream || busy || exportAbort.current) return
    const controller = new AbortController()
    exportAbort.current = controller
    setCapturePreview(false)
    setBusy(true)
    setError('')
    setExportInfo('')
    setFrameExportProgress({ current: 0, total: 0, message: 'Готовим съёмку сцен…' })
    let screenshotter: Awaited<ReturnType<typeof createTabScreenshotter>> | undefined
    let shotCount = 0
    const files: Record<string, Uint8Array> = {}
    const indexRows: string[] = []
    const config = structuredClone(getConfig())
    const total = SCENE_ORDER.reduce((sum, sceneId) => sum + frameExportCheckpoints(sceneId, config).length, 0) + 2
    const setProgress = (message: string) => setFrameExportProgress({ current: shotCount, total, message })
    const saveShot = async (sceneId: FilmState['scene'], label: string, time: number) => {
      if (controller.signal.aborted) throw new Error('Экспорт остановлен.')
      const sceneIndex = SCENE_ORDER.indexOf(sceneId)
      const sceneFolder = `${String(sceneIndex + 1).padStart(2, '0')}-${sceneId}`
      const imageName = `${String(shotCount + 1).padStart(2, '0')}-${time.toFixed(2)}s.png`
      setProgress(`${SCENES[sceneId].label} · ${label} · ${time.toFixed(2)} с`)
      await waitForAnimationFrame()
      document.documentElement.classList.add('review-frame-capturing')
      try { files[`${sceneFolder}/${imageName}`] = await screenshotter!.capture(controller.signal) }
      finally { document.documentElement.classList.remove('review-frame-capturing') }
      indexRows.push(`- [${SCENES[sceneId].label} · ${label} · ${time.toFixed(2)} с](./${sceneFolder}/${imageName})`)
      shotCount += 1
      setProgress(`Снято ${shotCount} из ${total}`)
    }
    const seekAndCapture = async (sceneId: FilmState['scene'], checkpoint: { label: string; time: number }) => {
      dispatch({ type: 'dev-seek', time: checkpoint.time })
      await waitForState(() => stateRef.current.scene === sceneId && stateRef.current.paused && Math.abs(stateRef.current.elapsed - checkpoint.time) < 0.05, controller.signal)
      await waitForAnimationFrame()
      await waitForAnimationFrame()
      await saveShot(sceneId, checkpoint.label, runtime.time)
    }
    try {
      screenshotter = await createTabScreenshotter(stream)
      await waitForAnimationFrame()
      document.documentElement.classList.add('review-capturing')
      for (const sceneId of SCENE_ORDER) {
        if (controller.signal.aborted) throw new Error('Экспорт остановлен.')
        dispatch({ type: 'dev-jump', scene: sceneId })
        await waitForState(() => stateRef.current.scene === sceneId && document.querySelector('.universe')?.getAttribute('data-route') === 'film', controller.signal)
        await waitForAnimationFrame()
        if (sceneId === 'prologue') {
          try { await waitForState(() => document.querySelector('.prologue-overlay[data-matter-ready="true"]') !== null, controller.signal, 5000) }
          catch (error) { if (controller.signal.aborted) throw error } // The DOM phrase layer remains a visible fallback.
        }
        const sceneState = stateRef.current

        if (sceneState.mode === 'playing') {
          if (!sceneState.paused) dispatch({ type: 'toggle-pause' })
          await waitForState(() => stateRef.current.scene === sceneId && stateRef.current.paused, controller.signal)
          for (const checkpoint of frameExportCheckpoints(sceneId, config)) await seekAndCapture(sceneId, checkpoint)

          if (sceneId === 'prologue') {
            const duration = SCENES.prologue.duration
            dispatch({ type: 'dev-seek', time: duration - 0.05 })
            await waitForState(() => stateRef.current.scene === 'prologue' && stateRef.current.paused && stateRef.current.elapsed >= duration - 0.1, controller.signal)
            dispatch({ type: 'toggle-pause' })
            await waitForState(() => stateRef.current.scene === 'prologue' && stateRef.current.mode === 'waiting', controller.signal)
            await saveShot('prologue', 'Ожидание касания', duration)
            setProgress('Нажмите на свет в фильме, чтобы снять переход пролога')
            await waitForState(() => stateRef.current.scene === 'prologue' && stateRef.current.mode === 'transitioning', controller.signal, 120000)
            const transitionMidpoint = duration + (stateRef.current.prologueTouchDuration ?? getPrologueTouchDuration()) / 2
            await waitForState(() => runtime.time >= transitionMidpoint, controller.signal, 10000)
            if (!stateRef.current.paused) dispatch({ type: 'toggle-pause' })
            await waitForState(() => stateRef.current.scene === 'prologue' && stateRef.current.paused, controller.signal)
            await saveShot('prologue', 'Переход после касания · середина', runtime.time)
          }
        } else {
          const checkpoint = frameExportCheckpoints(sceneId, config)[0]!
          await saveShot(sceneId, checkpoint.label, runtime.time)
        }
      }
      files['README.md'] = strToU8(`# Кадры A Little Universe for You\n\nСнято ${shotCount} кадров из вкладки, выбранной для захвата. Время указано в секундах локального таймлайна сцены.\n\n${indexRows.join('\n')}\n`)
      const archive = zipSync(files, { level: 0 })
      const blob = new Blob([archive as BlobPart], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `a-little-universe-frames-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportInfo(`Архив подготовлен: ${shotCount} кадров. Проверьте загрузки браузера.`)
      setFrameExportResult(`Архив подготовлен: ${shotCount} кадров. Проверьте загрузки браузера.`)
      setFrameExportProgress(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось собрать кадры сцен.')
      setFrameExportProgress(null)
    } finally {
      document.documentElement.classList.remove('review-capturing', 'review-frame-capturing')
      screenshotter?.dispose()
      exportAbort.current = null
      setBusy(false)
    }
  }
  const frameOptions = [...new Set(notes.filter(n => filterScene === 'all' || n.sceneId === filterScene).map(n => n.frameId))]
  const visible = notes.filter(n => (filterScene === 'all' || n.sceneId === filterScene) && (filterFrame === 'all' || n.frameId === filterFrame) && (filterStatus === 'all' || n.status === filterStatus))
  const ui = <>
    {error && !editor && <div className="review-error" role="alert">{error} <button onClick={() => setError('')}>×</button></div>}
    {frameExportProgress && <aside className="frame-export-progress" role="region" aria-label="Экспорт кадров"><span role="status" aria-live="polite">{frameExportProgress.message}</span>{frameExportProgress.total > 0 && <small>{frameExportProgress.current} / {frameExportProgress.total}</small>}<button type="button" onClick={cancelFrameExport}>Отменить</button></aside>}
    {frameExportResult && <aside className="frame-export-result" role="status">{frameExportResult}<button type="button" aria-label="Закрыть сообщение об экспорте" onClick={() => setFrameExportResult('')}>×</button></aside>}
    {capturePreview && <div className="review-modal"><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="frame-export-title"><header><strong id="frame-export-title">Проверьте вкладку для снимков</strong></header><p>В системном окне выберите вкладку A Little Universe и убедитесь, что в превью виден сайт. Экспорт снимет все девять сцен и сохранит их в ZIP.</p><video ref={capturePreviewVideo} className="review-preview" aria-label="Предпросмотр выбранной вкладки" autoPlay muted playsInline /><footer><button type="button" disabled={busy || !captureConnected} onClick={() => { void exportAllFrames() }}>Начать экспорт</button><button type="button" disabled={busy} onClick={() => setCapturePreview(false)}>Отмена</button></footer></section></div>}
    {journal && <div className="review-modal"><section className="review-dialog" role="dialog" aria-modal="true" aria-label="Журнал заметок"><header><strong>Журнал заметок</strong><button onClick={() => setJournal(false)}>Закрыть</button></header>
      <div className="review-filters"><select aria-label="Фильтр сцены" value={filterScene} onChange={e => { setFilterScene(e.target.value); setFilterFrame('all') }}><option value="all">Все сцены</option>{[...new Set(notes.map(n => n.sceneId))].map(scene => <option key={scene}>{scene}</option>)}</select><select aria-label="Фильтр кадра" value={filterFrame} onChange={e => setFilterFrame(e.target.value)}><option value="all">Все кадры</option>{frameOptions.map(frame => <option key={frame}>{frame}</option>)}</select><select aria-label="Фильтр статуса" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Все статусы</option>{(['open', 'in_progress', 'ready_for_review', 'done'] as const).map(status => <option key={status}>{status}</option>)}</select></div>
      {visible.length === 0 && <p>Заметок нет.</p>}{visible.map(note => <article className="review-entry" key={note.id}><input type="checkbox" aria-label={`Выбрать заметку ${note.frameId} ${note.text}`} disabled={note.status === 'done'} checked={note.status !== 'done' && selected.includes(note.id)} onChange={e => setSelected(e.target.checked ? [...selected, note.id] : selected.filter(id => id !== note.id))} /><button onClick={() => openNote(note)}>{note.frameId} · {note.localTimeSeconds.toFixed(2)} с — {note.text}</button><span>{note.priority}</span><select aria-label={`Статус ${note.frameId}`} value={note.status} onChange={e => { void updateStatus(note, e.target.value as Status) }}>{(['open', 'in_progress', 'ready_for_review', 'done'] as const).map(status => <option key={status}>{status}</option>)}</select><button onClick={() => { void remove(note) }}>Удалить</button></article>)}
      <details className="review-export"><summary>Экспорт для Codex</summary><p>Выбрано: {notes.filter(note => selected.includes(note.id) && note.status !== 'done').length}. Статусы автоматически не меняются.</p><div><button disabled={busy} onClick={() => { void exportNotes('save') }}>Сохранить Markdown</button><button disabled={busy} onClick={() => { void exportNotes('copy') }}>Скопировать Markdown</button><button disabled={busy} onClick={() => { void exportNotes('archive') }}>Скачать ZIP со снимками</button></div>{exportInfo && <p role="status">{exportInfo}</p>}</details>
    </section></div>}
    {editor && <div className="review-modal"><section className="review-dialog" role="dialog" aria-modal="true" aria-label="Заметка"><header><strong>{editor.draft.frameId} · {editor.draft.localTimeSeconds.toFixed(2)} с · {editor.draft.capturedMode}</strong></header>
      <p>Выберите вкладку с фильмом в системном диалоге и проверьте превью: браузер не может проверить, какая вкладка выбрана.</p>
      {editor.image ? <img className="review-preview" src={editor.image} alt="Снимок кадра" /> : <div className="review-capture-actions">{!captureConnected ? <button disabled={busy} onClick={() => { void connectCapture() }}>Подключить вкладку</button> : <button disabled={busy} onClick={() => { void take(editor.draft) }}>Повторить снимок</button>}<small>{captureConnected ? 'Захват подключён до закрытия вкладки или перезагрузки.' : 'Выберите вкладку с фильмом в системном диалоге.'}</small></div>}
      <label>Текст правки<textarea value={editor.draft.text} maxLength={10000} onChange={e => setEditor({ ...editor, draft: { ...editor.draft, text: e.target.value } })} /></label>
      <label>Приоритет<select value={editor.draft.priority} onChange={e => setEditor({ ...editor, draft: { ...editor.draft, priority: e.target.value as Priority } })}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label>
      {error && <p role="alert" className="review-dialog-error">{error}</p>}<footer><button disabled={busy} onClick={() => { void save() }}>Сохранить</button><button disabled={busy} onClick={() => { setEditor(null); setError('') }}>Отмена</button></footer>
    </section></div>}
  </>
  return { notes, begin, openNote, openJournal: () => { setJournal(true); setError('') }, connectCapture, disconnectCapture, captureConnected, requestFrameExport, captureCurrentFrame, ui, busy }
}
