import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { useSyncExternalStore } from 'react'
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
import { MediaSession, type MediaOptions } from '../systems/media/MediaSession'
import { AudioDirector } from '../systems/audio/AudioDirector'
import { useAudioDirector } from '../systems/audio/useAudioDirector'
import { AssetManager, type PreparationResult } from '../systems/assets/AssetManager'
import { Preloader } from '../bootstrap/Preloader'
import { PreparationScreen, type PreparationStep } from './PreparationScreen'
import { PhoneBackground } from '../components/PhoneBackground'
import { openGift } from './openGift'
import { getImplementationStatus } from './filmStatus'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { awaitFilmStartup, isFilmStartupFailure, type FilmStartupError } from './filmStartup'
import { LilyParticlePreparationBanner } from './LilyParticlePreparationBanner'
import { createLilyParticlePreparationSeedKey, getLilyFilmSurfaceDimensions, lilyParticlePreparation, prepareLilyParticleGeometryForStart, subscribeLilyFilmSurfaceDimensions } from '../scenes/lily/lilyParticlePreparation'
import { LILY_MODEL_RUNTIME_ASSET, preloadLilyModel } from '../assets/lily/lilyAsset'

// Application-lifetime ownership survives scene changes and StrictMode effect replay.
const media = new MediaSession()
const audio = new AudioDirector()
let restore: Promise<void> | undefined
let disposal: ReturnType<typeof setTimeout> | undefined
// Film modules have already been prepared by Bootstrap; a rerun verifies resources/cache.
const devManager = new AssetManager({ development: import.meta.env.DEV,
  ...(import.meta.env.DEV ? { manifest: { version: 'development-lily', assets: [LILY_MODEL_RUNTIME_ASSET] } } : {}),
  loadModules: async () => FilmCanvas })
const DeveloperPanel = import.meta.env.DEV ? lazy(() => import('../debug/DeveloperPanel')) : null
const SceneTimeline = import.meta.env.DEV ? lazy(() => import('../debug/SceneTimeline')) : null

export function App({ preparation }: { preparation: PreparationResult }) {
  const { state, dispatch, runtime } = useFilm()
  const reducedMotion = useReducedMotion()
  const [route, setRoute] = useState<PreparationStep | 'film' | 'loading'>('settings')
  const [prepared, setPrepared] = useState(preparation)
  const [checked, setChecked] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<FilmStartupError | null>(null)
  const [mountedFilm, setMountedFilm] = useState(false)
  const [debug, setDebug] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug'))
  const operation = useRef(0)
  const opening = useRef(false)
  const particlePreparation = useSyncExternalStore(lilyParticlePreparation.subscribe, lilyParticlePreparation.getSnapshot, lilyParticlePreparation.getSnapshot)
  useAudioDirector(audio, state, runtime)
  const getParticlePreparationInput = useCallback(() => ({
    config: getConfig(),
    ...getLilyFilmSurfaceDimensions(),
    reducedMotion,
  }), [reducedMotion])
  const currentParticleSeedKey = createLilyParticlePreparationSeedKey(getParticlePreparationInput())
  const currentParticleRecord = particlePreparation.status === 'ready'
    ? lilyParticlePreparation.getForKey(particlePreparation.key)
    : undefined
  const visibleStartError = startError?.source === 'particles'
    ? startError.seedKey === currentParticleSeedKey
      && !(currentParticleRecord?.seedKey === currentParticleSeedKey && currentParticleRecord.status === 'ready')
      ? startError
      : null
    : startError
  useEffect(() => {
    const prepareParticles = () => { void lilyParticlePreparation.prepare(getParticlePreparationInput()).catch(() => undefined) }
    prepareParticles()
    const unsubscribeConfig = subscribeConfig(prepareParticles)
    const unsubscribeSize = subscribeLilyFilmSurfaceDimensions(prepareParticles)
    return () => { unsubscribeConfig(); unsubscribeSize(); lilyParticlePreparation.cancel() }
  }, [getParticlePreparationInput])
  const retryParticlePreparation = useCallback(() => {
    void lilyParticlePreparation.retry(getParticlePreparationInput()).catch(() => undefined)
  }, [getParticlePreparationInput])
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
    setStartError(null)
    const request = ++operation.current
    let giftReady = false
    let particlesReady = false
    const enterFilm = () => {
      if (!giftReady || !particlesReady || request !== operation.current) return
      resetGalleryInstruction(); setMountedFilm(true); setRoute('film'); dispatch({ type: state.mode === 'ready' ? 'start' : 'replay' })
    }
    // Start the gesture-sensitive audio unlock synchronously; keep the user on
    // preparation until the matching scene-04 geometry is actually ready.
    const giftPromise = openGift({ audio, media, onStart: () => { giftReady = true; enterFilm() } })
    const particlePromise = prepareLilyParticleGeometryForStart(
      lilyParticlePreparation,
      getParticlePreparationInput,
      () => request === operation.current,
    )
    void awaitFilmStartup(giftPromise, particlePromise).then(() => {
      particlesReady = true
      enterFilm()
    }).catch((failure: unknown) => {
      if (request !== operation.current) return
      const tagged = isFilmStartupFailure(failure) ? failure : { source: 'gift' as const, reason: failure }
      if (tagged.source === 'particles' && tagged.reason instanceof Error && tagged.reason.name === 'AbortError'
        && lilyParticlePreparation.getSnapshot().status !== 'error') return
      console.error(tagged.source === 'gift' ? 'Gift opening failed.' : 'Scene 04 particle preparation failed.', tagged.reason)
      const message = tagged.reason instanceof Error ? tagged.reason.message : String(tagged.reason)
      if (tagged.source === 'gift') {
        setStartError({ source: 'gift', message })
      } else {
        setStartError({ source: 'particles', seedKey: createLilyParticlePreparationSeedKey(getParticlePreparationInput()), message })
      }
    }).finally(() => { opening.current = false; setStarting(false) })
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
  const lightPhase: PersistentLightPhase = route === 'ready' ? 'ready' : route === 'film' && cinematic ? 'prologue' : route === 'film' && state.scene === 'growth' ? 'growth' : 'hidden'
  const lightInteractive = lightPhase === 'prologue' && state.mode === 'waiting'
  const implementationStatus = getImplementationStatus(state.scene)
  const showOpeningBackground = route === 'film'
    && (state.scene === 'prologue' || state.scene === 'growth' || state.scene === 'bloom' || state.scene === 'identity')

  return <main className={`universe${cinematic ? ' cinematic' : ''}`} data-route={route} data-scene={state.scene} data-mode={state.mode} data-reading={state.reading} data-paused={state.paused} data-debug={import.meta.env.DEV && debug ? 'true' : undefined}>
    <LilyParticlePreparationBanner snapshot={particlePreparation} development={import.meta.env.DEV} onRetry={retryParticlePreparation} />
    {mountedFilm && <div className="film-presentation" hidden={route !== 'film'}>
      <div className="film-surface">
        <PhoneBackground active={showOpeningBackground} />
        <div className="viewport" role="region" aria-label="Интерактивный фильм"><FilmCanvas state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} /></div>
        {!cinematic && <header className="page-header"><span className="dedication">Для Василисы</span>{import.meta.env.DEV && <span className="build-label">{implementationStatus}</span>}</header>}
        <SceneOverlay key={`${state.scene}:${state.revision}`} state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
      </div>
      {cinematic ? <button className="cinematic-pause" type="button" data-testid="pause" aria-label={state.paused ? 'Продолжить фильм' : 'Пауза'} aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Ⅱ'}</button>
        : <footer className="page-footer" aria-label="Управление фильмом"><span className="film-status">{state.paused ? 'На паузе' : reducedMotion ? 'Уменьшенное движение' : import.meta.env.DEV ? implementationStatus : ''}</span><div className="playback-controls">{state.scene !== 'greeting' && state.mode !== 'ended' && <button type="button" data-testid="pause" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button>}<label className="quality-control">Качество<select aria-label="Качество графики" value={state.quality} onChange={(event) => dispatch({ type: 'set-quality', quality: event.target.value === 'low' ? 'low' : 'standard' })}><option value="standard">Обычное</option><option value="low">Низкое</option></select></label></div></footer>}
    </div>}
    {route === 'loading' ? <Preloader manager={devManager} onReady={onReloadReady} /> : route !== 'film' && <PreparationScreen step={route} session={media} preparation={prepared} checked={checked} starting={starting} startError={visibleStartError} onOptions={changeOptions} onPrepare={() => { void prepare() }} onContinue={() => setRoute('ready')} onWithoutMedia={withoutMedia} onEdit={edit} onStart={start} />}
    <PersistentLight phase={lightPhase} interactive={lightInteractive} reducedMotion={reducedMotion} runtime={runtime} state={state} onActivate={() => dispatch({ type: 'interact' })} />
    <RecordingControls session={media} />
    <RecoveryPanel session={media} />
    {state.reading && route === 'film' && <ReadingPanel dispatch={dispatch} />}
    {import.meta.env.DEV && <button className="debug-toggle" type="button" aria-expanded={debug} aria-controls="developer-panel" onClick={() => setDebug((value) => !value)}>DEV</button>}
    {import.meta.env.DEV && debug && DeveloperPanel && SceneTimeline && <Suspense fallback={<p className="debug-loading">Загрузка Developer Mode…</p>}><DeveloperPanel state={state} dispatch={devDispatch} runtime={runtime} route={route} reducedMotion={reducedMotion} onPreload={() => devPrepare('loading')} onPermissions={() => devPrepare('settings')} /><SceneTimeline state={state} dispatch={devDispatch} runtime={runtime} route={route} onPreload={() => devPrepare('loading')} onPermissions={() => devPrepare('settings')} /></Suspense>}
  </main>
}

