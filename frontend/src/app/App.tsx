import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { FilmCanvas } from '../engine/FilmCanvas'
import { resetGalleryInstruction } from '../scenes/gallery/controller'
import { useFilm } from '../engine/useFilm'
import type { FilmAction } from '../engine/film'
import { useReducedMotion } from '../engine/useReducedMotion'
import { SceneOverlay } from '../components/SceneOverlay'
import { PersistentLight, type PersistentLightPhase } from '../components/PersistentLight'
import { ReadingPanel } from '../components/ReadingPanel'
import { RecordingControls } from '../components/RecordingControls'
import { RecoveryPanel } from '../components/RecoveryPanel'
import { MediaSession } from '../systems/media/MediaSession'
import { AudioDirector } from '../systems/audio/AudioDirector'
import { useAudioDirector } from '../systems/audio/useAudioDirector'
import { AssetManager } from '../systems/assets/AssetManager'
import { Preloader } from '../bootstrap/Preloader'
import { PhoneBackground } from '../components/PhoneBackground'
import { getImplementationStatus } from './filmStatus'
import { LILY_MODEL_RUNTIME_ASSET, preloadLilyModel } from '../assets/lily/lilyAsset'
import { isDeveloperMode } from '../debug/developerMode'

// Application-lifetime ownership survives scene changes and StrictMode effect replay.
const media = new MediaSession()
const audio = new AudioDirector()
let restore: Promise<void> | undefined
let disposal: ReturnType<typeof setTimeout> | undefined
// Film modules have already been prepared by Bootstrap; a rerun verifies resources/cache.
const devManager = new AssetManager({ development: import.meta.env.DEV,
  ...(import.meta.env.DEV ? { manifest: { version: 'development-lily', assets: [LILY_MODEL_RUNTIME_ASSET] } } : {}),
  loadModules: async () => FilmCanvas })
const DeveloperPanel = lazy(() => import('../debug/DeveloperPanel'))
const SceneTimeline = lazy(() => import('../debug/SceneTimeline'))

export function App() {
  const { state, dispatch, runtime } = useFilm()
  const developerMode = isDeveloperMode()
  const reducedMotion = useReducedMotion()
  const [route, setRoute] = useState<'film' | 'loading'>('film')
  const [debug, setDebug] = useState(developerMode)
  const operation = useRef(0)
  useAudioDirector(audio, state, runtime)
  useEffect(() => { dispatch({ type: 'start' }) }, [dispatch])
  useEffect(() => { preloadLilyModel() }, [])
  useEffect(() => { if (state.scene === 'prologue') resetGalleryInstruction() }, [state.scene, state.revision])

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

  const devDispatch: Dispatch<FilmAction> = (action) => {
    if (action.type === 'dev-jump' || action.type === 'dev-restart') {
      operation.current++
      media.setOptions({ gaze: false, recording: false, upload: false })
      setRoute('film')
    }
    dispatch(action)
  }
  const devPrepare = () => {
    operation.current++
    media.setOptions({ gaze: false, recording: false, upload: false })
    // Ready has no running clock; pausing it would carry into the first start.
    if (state.mode !== 'ready' && !state.paused) dispatch({ type: 'toggle-pause' })
    setRoute('loading')
  }
  const onReloadReady = useCallback(() => {
    setRoute('film')
    if (state.mode === 'ready') dispatch({ type: 'start' })
    else if (state.paused) dispatch({ type: 'toggle-pause' })
  }, [dispatch, state.mode, state.paused])
  const cinematic = state.scene === 'prologue'
  const lightPhase: PersistentLightPhase = route === 'film' && cinematic ? 'prologue' : route === 'film' && state.scene === 'growth' ? 'growth' : 'hidden'
  const lightInteractive = lightPhase === 'prologue' && state.mode === 'waiting'
  const implementationStatus = getImplementationStatus(state.scene)
  const showOpeningBackground = route === 'film'
    && (state.scene === 'prologue' || state.scene === 'growth' || state.scene === 'bloom' || state.scene === 'identity')

  return <main className={`universe${cinematic ? ' cinematic' : ''}`} data-route={route} data-scene={state.scene} data-mode={state.mode} data-reading={state.reading} data-paused={state.paused} data-debug={developerMode && debug ? 'true' : undefined}>
    <div className="film-presentation" hidden={route !== 'film'}>
      <div className="film-surface">
        <PhoneBackground active={showOpeningBackground} scene={state.scene} runtime={runtime} reducedMotion={reducedMotion} />
        <div className="viewport" role="region" aria-label="Интерактивный фильм"><FilmCanvas state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} /></div>
        {!cinematic && <header className="page-header"><span className="dedication">Для Василисы</span>{import.meta.env.DEV && <span className="build-label">{implementationStatus}</span>}</header>}
        <SceneOverlay key={`${state.scene}:${state.revision}`} state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
      </div>
      {cinematic ? <button className="cinematic-pause" type="button" data-testid="pause" aria-label={state.paused ? 'Продолжить фильм' : 'Пауза'} aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Ⅱ'}</button>
        : <footer className="page-footer" aria-label="Управление фильмом"><span className="film-status">{state.paused ? 'На паузе' : reducedMotion ? 'Уменьшенное движение' : import.meta.env.DEV ? implementationStatus : ''}</span><div className="playback-controls">{state.scene !== 'greeting' && state.mode !== 'ended' && <button type="button" data-testid="pause" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button>}<label className="quality-control">Качество<select aria-label="Качество графики" value={state.quality} onChange={(event) => dispatch({ type: 'set-quality', quality: event.target.value === 'low' ? 'low' : 'standard' })}><option value="standard">Обычное</option><option value="low">Низкое</option></select></label></div></footer>}
    </div>
    {route === 'loading' && <Preloader manager={devManager} onReady={onReloadReady} />}
    <PersistentLight phase={lightPhase} interactive={lightInteractive} reducedMotion={reducedMotion} runtime={runtime} state={state} onActivate={() => dispatch({ type: 'interact' })} />
    <RecordingControls session={media} />
    <RecoveryPanel session={media} />
    {state.reading && route === 'film' && <ReadingPanel dispatch={dispatch} />}
    {developerMode && <button className="debug-toggle" type="button" aria-expanded={debug} aria-controls="developer-panel" onClick={() => setDebug((value) => !value)}>DEV</button>}
    {developerMode && debug && <Suspense fallback={<p className="debug-loading">Загрузка Developer Mode…</p>}><DeveloperPanel state={state} dispatch={devDispatch} runtime={runtime} route={route} reducedMotion={reducedMotion} onPreload={devPrepare} /><SceneTimeline state={state} dispatch={devDispatch} runtime={runtime} route={route} onPreload={devPrepare} /></Suspense>}
  </main>
}

