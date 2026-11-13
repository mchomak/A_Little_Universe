import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { useReviewNotes } from './useReviewNotes'
import { getCreditsScrollDuration, SCENES, SCENE_ORDER } from '../engine/filmConfig'
import { getConfig, subscribeConfig, updateConfig } from '../systems/scene-config/config'
import { activeFrameIndex, canSeekTimeline, timelineDuration, timelineFrames } from './timelineModel'
import { createLoopListener, validLoop } from './timelinePlayback'
import './sceneTimeline.css'

export default function SceneTimeline({ state, dispatch, runtime, route, onPreload }: { state: FilmState; dispatch: Dispatch<FilmAction>; runtime: FilmRuntime; route: string; onPreload: () => void }) {
  const review = useReviewNotes(state, dispatch, runtime, route)
  const filmVisible = route === 'film'
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<'scenes' | 'frames'>('frames')
  const [loop, setLoop] = useState<{ scene: FilmState['scene']; start: number; end: number; label: string } | null>(null)
  const [rangeStart, setRangeStart] = useState('0')
  const [rangeEnd, setRangeEnd] = useState('1')
  const [rangeError, setRangeError] = useState('')
  const [previewFrame, setPreviewFrame] = useState<number | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [previousSpeed, setPreviousSpeed] = useState<number | null>(null)
  const [creditsScrollDuration, setCreditsScrollDuration] = useState<number | null>(null)
  const previousRevision = useRef(state.revision)
  const loopSeek = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useLayoutEffect(() => {
    if (state.scene !== 'greeting') return
    const measure = () => {
      const crawl = document.querySelector<HTMLElement>('.greeting-overlay .credits-crawl')
      const viewport = document.querySelector<HTMLElement>('.greeting-overlay')
      if (crawl && viewport) setCreditsScrollDuration(getCreditsScrollDuration(crawl.scrollHeight, viewport.clientHeight, config.scenes.greeting.crawlSpeed))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    const crawl = document.querySelector<HTMLElement>('.greeting-overlay .credits-crawl')
    const viewport = document.querySelector<HTMLElement>('.greeting-overlay')
    if (crawl) observer?.observe(crawl)
    if (viewport) observer?.observe(viewport)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [state.scene, config.scenes.greeting.crawlSpeed])
  const frames = timelineFrames(state.scene, config, creditsScrollDuration, state.returnToEnding)
  const index = activeFrameIndex(frames, state.elapsed)
  const nextFrame = frames[index + 1]
  const duration = timelineDuration(state, config)
  const seekable = canSeekTimeline(state, filmVisible, config)
  const activeLoop = loop?.scene === state.scene && filmVisible ? loop : null
  const loopAllowed = seekable && state.mode === 'playing' && !state.reading
  useEffect(() => {
    if (!activeLoop || !loopAllowed || state.paused) return
    return runtime.subscribeFrame(createLoopListener(activeLoop, action => { loopSeek.current = true; dispatch(action) }))
  }, [runtime, dispatch, activeLoop, loopAllowed, state.paused])
  useEffect(() => {
    // A loop belongs to one visit to one scene, never to a later replay or route.
    const revisionChanged = previousRevision.current !== state.revision
    const ownSeek = loopSeek.current
    previousRevision.current = state.revision
    loopSeek.current = false
    // A revision can also represent replay or an external seek. Disable the loop on those.
    setLoop(previous => previous && (previous.scene !== state.scene || !filmVisible || state.mode !== 'playing' || (revisionChanged && !ownSeek)) ? null : previous)
  }, [state.scene, state.mode, state.revision, filmVisible])
  const waiting = state.mode === 'waiting' || state.mode === 'exploring' || state.mode === 'ended'
  const status = !filmVisible ? '00 Загрузка' : state.reading ? 'Чтение · ожидание' : state.mode === 'exploring' ? 'Свободный просмотр' : state.mode === 'waiting' ? 'Ожидание действия' : state.mode === 'ended' ? 'Финал' : state.paused ? 'Пауза' : 'Воспроизведение'
  const available = (time: number) => seekable && !(state.scene === 'prologue' && time >= duration)
  const frameRange = (i: number) => {
    const frame = frames[i]
    if (!frame) return ''
    if (duration === 0 || frame.start >= duration) return 'ожидание'
    return `${frame.start.toFixed(1)}–${(frames[i + 1]?.start ?? duration).toFixed(1)} с`
  }
  const seek = (time: number) => { if (available(time)) { if (activeLoop && (time < activeLoop.start || time >= activeLoop.end)) setLoop(null); else if (activeLoop) loopSeek.current = true; dispatch({ type: 'dev-seek', time }) } }
  const startLoop = (start: number, end: number, label: string) => {
    if (!loopAllowed || !validLoop(start, end, duration)) { setRangeError('Выберите отрезок от 0,1 с внутри текущей сцены.'); return }
    setRangeError(''); setLoop({ scene: state.scene, start, end, label }); loopSeek.current = true; dispatch({ type: 'dev-seek', time: start })
  }
  const loopFrame = () => { const exactIndex = activeFrameIndex(frames, runtime.time); const frame = frames[exactIndex]; if (frame) startLoop(frame.start, frames[exactIndex + 1]?.start ?? duration, frame.label) }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key.toLowerCase() !== 'l' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || document.querySelector('.review-modal')) return
      if (!activeLoop && !loopAllowed) return
      event.preventDefault()
      if (activeLoop) setLoop(null); else loopFrame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const setSpeed = async (speed: number) => {
    const next = await updateConfig({ global: { playbackSpeed: speed } })
    dispatch({ type: 'set-speed', speed: next.global.playbackSpeed })
  }
  const chooseSlowSpeed = (speed: number) => {
    if (previousSpeed === null) setPreviousSpeed(state.speed)
    void setSpeed(speed)
  }
  const restoreSpeed = () => {
    if (previousSpeed !== null) { const speed = previousSpeed; setPreviousSpeed(null); void setSpeed(speed) }
  }
  const hoveredFrame = previewFrame === null ? undefined : frames[previewFrame]
  const hoveredNote = hoveredFrame && review.notes.find(note => note.sceneId === state.scene && note.frameId === hoveredFrame.label && note.screenshotPath)
  const sceneIndex = filmVisible ? SCENE_ORDER.indexOf(state.scene) + 1 : 0
  const step = (direction: -1 | 1) => {
    if (level === 'scenes') {
      const next = sceneIndex + direction
      if (next === 0) onPreload()
      else {
        const scene = SCENE_ORDER[next - 1]
        if (scene) dispatch({ type: 'dev-jump', scene })
      }
    } else {
      const target = frames[index + direction]
      if (target) seek(target.start)
    }
  }
  const enter = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    timer.current = setTimeout(() => setOpen(true), 170)
  }
  const leave = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setOpen(false) }
  return <section className={`scene-timeline${open ? ' is-open' : ''}`} aria-label="Временная шкала сцен" onPointerEnter={enter} onPointerLeave={event => { if (event.pointerType === 'mouse') leave() }}>
    <button type="button" className="timeline-summary" aria-expanded={open} aria-controls="timeline-expanded" onClick={() => setOpen((value) => !value)}>
      <span className="timeline-summary-title">{filmVisible ? `${SCENES[state.scene].label} · ${frames[index]?.label}${activeLoop ? ' · Цикл' : ''}` : 'Шкала времени сцен'}</span>
      <span>{status}</span>
      <span>{filmVisible && duration > 0 ? `${state.elapsed.toFixed(1)} / ${duration.toFixed(1)} с` : '—'}</span>
      <span aria-hidden="true">{open ? '⌄' : '⌃'}</span>
      {filmVisible && duration > 0 && <span className="timeline-progress" style={{ width: `${Math.min(100, state.elapsed / duration * 100)}%` }} />}
    </button>
    <div id="timeline-expanded" className="timeline-expanded" inert={!open}><div className="timeline-expanded-inner">
      <div className="timeline-toolbar">
        <button type="button" aria-pressed={level === 'scenes'} onClick={() => setLevel('scenes')}>Сцены</button>
        <button type="button" aria-pressed={level === 'frames'} onClick={() => setLevel('frames')}>Кадры</button>
        <span className="timeline-divider" />
        <button type="button" aria-label={level === 'scenes' ? 'Предыдущая сцена' : 'Предыдущий кадр'} disabled={level === 'scenes' ? sceneIndex === 0 : index === 0 || !seekable} onClick={() => step(-1)}>◀|</button>
        <button type="button" aria-label={state.paused ? 'Продолжить' : 'Пауза'} disabled={!filmVisible || state.mode === 'ready' || state.mode === 'ended'} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? '▶' : 'Ⅱ'}</button>
        <button type="button" aria-label={level === 'scenes' ? 'Следующая сцена' : 'Следующий кадр'} disabled={level === 'scenes' ? sceneIndex === SCENE_ORDER.length + 1 : !nextFrame || !available(nextFrame.start)} onClick={() => step(1)}>|▶</button>
        <button type="button" onClick={review.begin} disabled={!filmVisible || review.busy}>+ Заметка</button><button type="button" onClick={review.openJournal}>Журнал</button>
        <button type="button" title="Подключите вкладку один раз за сеанс; поток используется для снимков заметок" aria-pressed={review.captureConnected} disabled={review.busy} onClick={() => { if (review.captureConnected) review.disconnectCapture(); else void review.connectCapture() }}>{review.captureConnected ? 'Скриншоты подключены' : 'Подключить вкладку'}</button>
        <button type="button" title="Скачать текущий кадр без DEV-панели; сначала подключите вкладку" disabled={!filmVisible || review.busy} onClick={() => { void review.captureCurrentFrame() }}>Скрин PNG</button>
        <button type="button" title="Сохранить ключевые кадры всех девяти сцен в архив ZIP" disabled={review.busy} onClick={() => { void review.requestFrameExport() }}>Экспорт кадров</button>
        <details className="timeline-tools"><summary>Просмотр{activeLoop ? ' · Цикл' : ''}{previousSpeed !== null ? ` · ${state.speed}×` : ''}</summary><div className="timeline-tools-menu">
          <p>Скорость: {state.speed}×</p><div className="timeline-tool-row">{[0.25, 0.5, 1].map(speed => <button type="button" key={speed} aria-pressed={state.speed === speed} onClick={() => chooseSlowSpeed(speed)}>{speed}×</button>)}<button type="button" disabled={previousSpeed === null} onClick={restoreSpeed}>Вернуть</button></div>
          <p>{activeLoop ? `Цикл: ${activeLoop.label} · ${activeLoop.start.toFixed(2)}–${activeLoop.end.toFixed(2)} с` : 'Цикл выключен'}</p>
          <div className="timeline-tool-row"><button type="button" disabled={!loopAllowed || !frames[index] || frames[index].start >= duration} onClick={loopFrame}>Цикл кадра (L)</button><button type="button" disabled={!activeLoop} onClick={() => setLoop(null)}>Выключить цикл</button></div>
          <div className="timeline-tool-row"><label>От, с<input type="number" min="0" max={duration} step="0.01" value={rangeStart} onChange={event => setRangeStart(event.target.value)} /></label><label>До, с<input type="number" min="0" max={duration} step="0.01" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} /></label><button type="button" disabled={!loopAllowed || !rangeStart.trim() || !rangeEnd.trim()} onClick={() => startLoop(Number(rangeStart), Number(rangeEnd), 'отрезок')}>Цикл отрезка</button></div>
          {rangeError && <p role="alert">{rangeError}</p>}<p>Цикл доступен только во время воспроизведения сцены, после интерактивного входа.</p>
        </div></details>
        <span className="timeline-hint">{level === 'scenes' ? 'Порядок сцен · длительность фильма не фиксирована' : !seekable ? status : 'Локальное время сцены'}</span>
      </div>
      {level === 'scenes' ? <div className="timeline-segments" aria-label="Сцены фильма">
        <button type="button" className={route === 'loading' ? 'is-active' : ''} onClick={onPreload}><span>00</span> Загрузка</button>
        {SCENE_ORDER.map((scene, i) => <button type="button" key={scene} className={scene === state.scene && filmVisible ? 'is-active' : ''} onClick={() => dispatch({ type: 'dev-jump', scene })}><span>{String(i + 1).padStart(2, '0')}</span> {SCENES[scene].label}</button>)}
      </div> : !filmVisible ? <div className="timeline-unavailable">{status} · отдельная временная шкала недоступна. Выберите сцену фильма.</div> : <div className="timeline-frame-track">
        <div className="timeline-segments" aria-label="Кадры сцены">
          {frames.map((frame, i) => <button type="button" key={`${frame.start}:${frame.label}`} className={i === index ? 'is-active' : ''} disabled={!available(frame.start)} onPointerEnter={() => { setPreviewFailed(false); setPreviewFrame(i) }} onPointerLeave={() => setPreviewFrame(null)} onFocus={() => { setPreviewFailed(false); setPreviewFrame(i) }} onBlur={() => setPreviewFrame(null)} onClick={() => seek(frame.start)}><span>{frameRange(i)}</span> {frame.label}</button>)}
        </div>
        <input type="range" aria-label="Локальное время сцены" min={0} max={state.scene === 'prologue' ? duration - 0.01 : duration || 1} step="0.01" value={Math.min(state.elapsed, state.scene === 'prologue' ? duration - 0.01 : duration || 1)} disabled={!seekable} onChange={(event) => seek(Number(event.target.value))} />
        <div className="timeline-notes" aria-label="Маркеры заметок">{review.notes.filter(note => note.sceneId === state.scene).map(note => <button type="button" key={note.id} title={`${note.frameId}: ${note.text}`} aria-label={`Открыть заметку ${note.frameId}`} style={{ left: `${duration ? Math.max(0, Math.min(100, note.localTimeSeconds / duration * 100)) : 0}%` }} onClick={() => review.openNote(note)}>●</button>)}</div>
        {waiting && <span className="timeline-gate">{status} · переход не имитирует касание</span>}
      </div>}
    </div></div>
    {open && hoveredFrame && <div className="timeline-preview" role="status"><strong>{hoveredFrame.label}</strong><span>{frameRange(previewFrame!)}</span>{hoveredNote && !previewFailed ? <><img src={`/__dev_reviews/image?scene=${encodeURIComponent(hoveredNote.sceneId)}&id=${encodeURIComponent(hoveredNote.id)}`} alt={`Снимок на ${hoveredNote.localTimeSeconds.toFixed(2)} с`} onError={() => setPreviewFailed(true)} /><small>Снимок заметки · {hoveredNote.localTimeSeconds.toFixed(2)} с</small></> : <small>Превью пока нет</small>}</div>}
    {review.ui}
  </section>
}
