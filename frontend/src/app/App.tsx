import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { FilmCanvas } from '../engine/FilmCanvas'
import { useFilm } from '../engine/useFilm'
import type { FilmAction } from '../engine/film'
import { useReducedMotion } from '../engine/useReducedMotion'
import { SceneOverlay } from '../components/SceneOverlay'
import { PersistentLight, type PersistentLightPhase } from '../components/PersistentLight'
import { ReadingPanel } from '../components/ReadingPanel'
import { RecordingControls } from '../components/RecordingControls'
import { RecoveryPanel } from '../components/RecoveryPanel'
import { useGallerySwipe } from '../components/useGallerySwipe'
import { MediaSession, type MediaOptions } from '../systems/media/MediaSession'
import { AudioDirector } from '../systems/audio/AudioDirector'
import { useAudioDirector } from '../systems/audio/useAudioDirector'
import { AssetManager, type PreparationResult } from '../systems/assets/AssetManager'
import { Preloader } from '../bootstrap/Preloader'
import { PreparationScreen, type PreparationStep } from './PreparationScreen'
import { openGift } from './openGift'

// Application-lifetime ownership survives scene changes and StrictMode effect replay.
const media = new MediaSession()
const audio = new AudioDirector()
let restore: Promise<void> | undefined
let disposal: ReturnType<typeof setTimeout> | undefined
// Film modules have already been prepared by Bootstrap; a rerun verifies resources/cache.
const devManager = new AssetManager({ development: import.meta.env.DEV, loadModules: async () => FilmCanvas })
const DeveloperPanel = import.meta.env.DEV ? lazy(() => import('../debug/DeveloperPanel')) : null

export function App({ preparation }: { preparation: PreparationResult }) {
  const { state, dispatch, runtime } = useFilm()
  const reducedMotion = useReducedMotion()
  const [route, setRoute] = useState<PreparationStep | 'film' | 'loading'>('settings')
  const [prepared, setPrepared] = useState(preparation)
  const [checked, setChecked] = useState(false)
  const [starting, setStarting] = useState(false)
  const [mountedFilm, setMountedFilm] = useState(false)
  const [debug, setDebug] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug'))
  const operation = useRef(0)
  const opening = useRef(false)
  const swipe = useGallerySwipe(route === 'film' && state.scene === 'gallery' && !state.reading, dispatch)
  useAudioDirector(audio, state, runtime)

  useEffect(() => {
    const lifecycleOperation = operation
    clearTimeout(disposal)
    restore ??= media.restore()
    return () => {
      lifecycleOperation.current++
      // StrictMode remount cancels this timer before any live service is disposed.
      disposal = setTimeout(() => { void media.dispose(); audio.dispose() }, 0)
    }
  }, [])
  useEffect(() => {
    if (state.scene !== 'ending') return
    const request = ++operation.current
    void media.stop().then(() => {
      if (request === operation.current) media.setOptions({ gaze: false, recording: false, upload: false })
    })
  }, [state.scene])

  const changeOptions = (options: MediaOptions) => { operation.current++; media.setOptions(options); setChecked(false) }
  const withoutMedia = () => { changeOptions({ gaze: false, recording: false, upload: false }); setRoute('ready') }
  const edit = () => { changeOptions({ gaze: false, recording: false, upload: false }); setRoute('settings') }
  const prepare = async () => {
    const request = ++operation.current
    setChecked(false)
    if (!media.getSnapshot().options.gaze && !media.getSnapshot().options.recording) { setRoute('ready'); return }
    setRoute('checking')
    await media.prepare()
    if (request === operation.current) setChecked(true)
  }
  const start = () => {
    if (opening.current) return
    opening.current = true
    setStarting(true)
    const request = ++operation.current
    void openGift({ audio, media, onStart: () => {
      if (request !== operation.current) return
      setMountedFilm(true); setRoute('film'); dispatch({ type: state.mode === 'ready' ? 'start' : 'replay' })
    } }).finally(() => { opening.current = false; setStarting(false) })
  }
  const devDispatch: Dispatch<FilmAction> = (action) => {
    if (action.type === 'dev-jump' || action.type === 'dev-restart') {
      operation.current++
      media.setOptions({ gaze: false, recording: false, upload: false })
      setMountedFilm(true); setRoute('film')
    }
    dispatch(action)
  }
  const devPrepare = (next: 'loading' | 'settings') => {
    operation.current++
    media.setOptions({ gaze: false, recording: false, upload: false })
    // Ready has no running clock; pausing it would carry into the first start.
    if (state.mode !== 'ready' && !state.paused) dispatch({ type: 'toggle-pause' })
    setChecked(false); setRoute(next)
  }
  const onReloadReady = useCallback((result: PreparationResult) => { setPrepared(result); setRoute('settings') }, [])
  const cinematic = state.scene === 'prologue'
  const lightPhase: PersistentLightPhase = route === 'ready' ? 'ready' : route === 'film' && cinematic ? 'prologue' : 'hidden'
  const lightInteractive = lightPhase === 'prologue' && state.mode === 'waiting'

  return <main className={`universe${cinematic ? ' cinematic' : ''}`} data-route={route} data-scene={state.scene} data-mode={state.mode} data-reading={state.reading} data-paused={state.paused}>
    {mountedFilm && <div className="film-presentation" hidden={route !== 'film'}>
      <div className="film-surface" {...swipe}>
        <div className="viewport" role="region" aria-label="Интерактивный фильм"><FilmCanvas state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} /></div>
        {!cinematic && <header className="page-header"><span className="dedication">Для Василисы</span><span className="build-label">Сцены 02–09 · placeholders</span></header>}
        <SceneOverlay key={`${state.scene}:${state.revision}`} state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
      </div>
      {cinematic ? <button className="cinematic-pause" type="button" data-testid="pause" aria-label={state.paused ? 'Продолжить фильм' : 'Пауза'} aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Ⅱ'}</button>
        : <footer className="page-footer" aria-label="Управление фильмом"><span className="film-status">{state.paused ? 'На паузе' : reducedMotion ? 'Уменьшенное движение' : 'Сцены 02–09 — placeholders'}</span><div className="playback-controls">{state.mode !== 'ended' && <button type="button" data-testid="pause" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button>}<label className="quality-control">Качество<select aria-label="Качество графики" value={state.quality} onChange={(event) => dispatch({ type: 'set-quality', quality: event.target.value === 'low' ? 'low' : 'standard' })}><option value="standard">Обычное</option><option value="low">Низкое</option></select></label></div></footer>}
    </div>}
    {route === 'loading' ? <Preloader manager={devManager} onReady={onReloadReady} /> : route !== 'film' && <PreparationScreen step={route} session={media} preparation={prepared} checked={checked} starting={starting} onOptions={changeOptions} onPrepare={() => { void prepare() }} onContinue={() => setRoute('ready')} onWithoutMedia={withoutMedia} onEdit={edit} onStart={start} />}
    <PersistentLight phase={lightPhase} interactive={lightInteractive} reducedMotion={reducedMotion} onActivate={() => dispatch({ type: 'interact' })} />
    <RecordingControls session={media} />
    <RecoveryPanel session={media} />
    {state.reading && route === 'film' && <ReadingPanel dispatch={dispatch} />}
    {import.meta.env.DEV && <button className="debug-toggle" type="button" aria-expanded={debug} aria-controls="developer-panel" onClick={() => setDebug((value) => !value)}>DEV</button>}
    {import.meta.env.DEV && debug && DeveloperPanel && <Suspense fallback={<p className="debug-loading">Загрузка Developer Mode…</p>}><DeveloperPanel state={state} dispatch={devDispatch} reducedMotion={reducedMotion} onPreload={() => devPrepare('loading')} onPermissions={() => devPrepare('settings')} /></Suspense>}
  </main>
}
