import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type Dispatch } from 'react'
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
import { MusicDirector } from '../systems/audio/MusicDirector'
import { useAudioDirector } from '../systems/audio/useAudioDirector'
import { AssetManager, type PreparationResult } from '../systems/assets/AssetManager'
import { Preloader } from '../bootstrap/Preloader'
import { PreparationScreen, type PreparationStep } from './PreparationScreen'
import { openGift } from './openGift'
import { PhoneBackground } from '../components/PhoneBackground'
import { PortraitHandoffOverlay } from '../components/PortraitHandoffOverlay'
import { getImplementationStatus } from './filmStatus'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { startPreparedFilm, isFilmStartupFailure, type FilmStartupError } from './filmStartup'
import { LilyParticlePreparationBanner } from './LilyParticlePreparationBanner'
import { createLilyParticlePreparationSeedKey, getLilyFilmSurfaceDimensions, lilyParticlePreparation, prepareLilyParticleGeometryForStart, subscribeLilyFilmSurfaceDimensions } from '../scenes/lily/lilyParticlePreparation'
import { LILY_MODEL_RUNTIME_ASSET, preloadLilyModel } from '../assets/lily/lilyAsset'
import { isDeveloperMode } from '../debug/developerMode'
import { DesktopRecordingSession } from '../systems/media/DesktopRecordingSession'
import { DesktopRecordingControls } from '../components/DesktopRecordingControls'
import { createFilmMusicBridge } from './filmMusicBridge'

// Application-lifetime ownership survives scene changes and StrictMode effect replay.
const media = new MediaSession()
const desktopRecording = new DesktopRecordingSession()
const audio = new AudioDirector()
const music = new MusicDirector({
  createMusicChannel: (element) => audio.createMusicChannel(element),
  setMusicVolume: (value) => audio.setMusicVolume(value),
})
const musicFilm = createFilmMusicBridge(music)
let restore: Promise<void> | undefined
let disposal: ReturnType<typeof setTimeout> | undefined
let standardSiteMediaPreparation: Promise<boolean> | undefined
function prepareStandardSiteMedia() {
  if (!standardSiteMediaPreparation) {
    media.setOptions({ gaze: false, recording: true, upload: false })
    standardSiteMediaPreparation = media.prepare().catch(() => false)
  }
  return standardSiteMediaPreparation
}
type AppRoute = PreparationStep | 'film' | 'loading'
// Film modules have already been prepared by Bootstrap; a rerun verifies resources/cache.
const devManager = new AssetManager({ development: import.meta.env.DEV,
  ...(import.meta.env.DEV ? { manifest: { version: 'development-lily', assets: [LILY_MODEL_RUNTIME_ASSET] } } : {}),
  loadModules: async () => FilmCanvas })
const DeveloperPanel = lazy(() => import('../debug/DeveloperPanel'))
const SceneTimeline = lazy(() => import('../debug/SceneTimeline'))

export function App({ preparation }: { preparation: PreparationResult }) {
  const { state, dispatch, runtime } = useFilm()
  const developerMode = isDeveloperMode()
  const reducedMotion = useReducedMotion()
  const [route, setRoute] = useState<AppRoute>('ready')
  const [prepared, setPrepared] = useState(preparation)
  const [checked, setChecked] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<FilmStartupError | null>(null)
  const [mountedFilm, setMountedFilm] = useState(false)
  const [debug, setDebug] = useState(developerMode)
  const operation = useRef(0)
  const opening = useRef<number | null>(null)
  const particlePreparation = useSyncExternalStore(lilyParticlePreparation.subscribe, lilyParticlePreparation.getSnapshot, lilyParticlePreparation.getSnapshot)
  useEffect(() => { void desktopRecording.setFilmActive(route === 'film').catch(() => undefined) }, [route])
  useAudioDirector(audio, state, runtime)
  useEffect(() => {
    musicFilm.syncFilmState(state)
    // Film clock updates do not affect music; reconcile only lifecycle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scene, state.mode, state.revision, state.paused, state.reading, state.returnToEnding])
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
    if (!developerMode && !desktopRecording.available) void prepareStandardSiteMedia()
    return () => {
      lifecycleOperation.current++
      // StrictMode remount cancels this timer before any live service is disposed.
      disposal = setTimeout(() => { void media.dispose(); musicFilm.dispose(); music.dispose(); audio.dispose() }, 0)
    }
  }, [developerMode])
  useEffect(() => {
    if (state.scene !== 'ending') return
    const request = ++operation.current
    if (!desktopRecording.available) void media.stop().then(() => {
      if (request === operation.current) media.setOptions({ gaze: false, recording: false, upload: false })
    })
  }, [state.scene])

  const start = (withRecording = true) => {
    if (opening.current !== null) return
    const request = ++operation.current
    opening.current = request
    setStarting(true)
    setStartError(null)
    setChecked(false)
    setRoute(withRecording && developerMode ? 'checking' : 'ready')
    const markChecked = () => { if (request === operation.current) setChecked(true) }
    const unlockAudio = () => {
      return musicFilm.startAfterUnlock(() => audio.unlock(), state)
    }
    void startPreparedFilm({
      startGift: () => {
        if (!withRecording) {
          media.setOptions({ gaze: false, recording: false, upload: false })
          const audioUnlock = unlockAudio()
          const cleanup = Promise.all([
            media.stop(),
            desktopRecording.available ? desktopRecording.stop() : Promise.resolve(),
          ])
          return cleanup.then(() => audioUnlock).then(markChecked)
        }

        if (desktopRecording.available) {
          media.setOptions({ gaze: false, recording: false, upload: false })
          const desktopMedia = {
            getSnapshot: () => ({
              options: { gaze: false, recording: true, upload: false },
              recordingStatus: desktopRecording.getSnapshot().status === 'recording' ? 'recording' as const : 'ready' as const,
              error: desktopRecording.getSnapshot().errors.join(' ') || null,
            }),
            start: async () => { await desktopRecording.start(); return true },
          }
          return openGift({ audio: { unlock: unlockAudio }, media: desktopMedia, onStart: markChecked })
        }

        if (!developerMode) {
          return openGift({
            audio: { unlock: unlockAudio },
            media: { getSnapshot: media.getSnapshot, prepare: prepareStandardSiteMedia, start: () => media.start() },
            onStart: markChecked,
          }).catch(() => {
            // Camera or recorder startup is optional on the standard site.
            markChecked()
          })
        }

        media.setOptions({ gaze: false, recording: true, upload: false })
        return openGift({
          audio: { unlock: unlockAudio },
          media: { getSnapshot: media.getSnapshot, prepare: () => media.prepare(), start: () => media.start() },
          onStart: markChecked,
        })
      },
      prepareParticles: () => prepareLilyParticleGeometryForStart(
        lilyParticlePreparation,
        getParticlePreparationInput,
        () => request === operation.current,
      ),
      stopRecording: () => desktopRecording.available ? desktopRecording.stop() : media.stop(),
      isCurrent: () => request === operation.current,
      onReady: () => {
        resetGalleryInstruction(); setMountedFilm(true); setRoute('film')
        dispatch({ type: state.mode === 'ready' ? 'start' : 'replay' })
      },
    }).catch((failure: unknown) => {
      if (request !== operation.current) return
      setRoute('ready')
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
    }).finally(() => {
      if (opening.current !== request) return
      opening.current = null
      setStarting(false)
    })
  }
  const devDispatch: Dispatch<FilmAction> = (action) => {
    if (action.type === 'dev-jump' || action.type === 'dev-restart') {
      operation.current++
      opening.current = null
      setStarting(false)
      media.setOptions({ gaze: false, recording: false, upload: false })
      void media.stop()
      if (desktopRecording.available) void desktopRecording.stop()
      setMountedFilm(true); setRoute('film')
    }
    dispatch(action)
  }
  const devPrepare = (next: 'loading') => {
    operation.current++
    opening.current = null
    setStarting(false)
    media.setOptions({ gaze: false, recording: false, upload: false })
    void media.stop()
    if (desktopRecording.available) void desktopRecording.stop()
    // Ready has no running clock; pausing it would carry into the first start.
    if (state.mode !== 'ready' && !state.paused) dispatch({ type: 'toggle-pause' })
    setChecked(false); setRoute(next)
  }
  const onReloadReady = useCallback((result: PreparationResult) => { setPrepared(result); setRoute('ready') }, [])
  const cinematic = state.scene === 'prologue'
  const lightPhase: PersistentLightPhase = route === 'ready' ? 'ready' : route === 'film' && cinematic ? 'prologue' : route === 'film' && state.scene === 'growth' ? 'growth' : 'hidden'
  const lightInteractive = lightPhase === 'prologue' && state.mode === 'waiting'
  const implementationStatus = getImplementationStatus(state.scene)
  const showOpeningBackground = route === 'film'
    && (state.scene === 'prologue' || state.scene === 'growth' || state.scene === 'bloom' || state.scene === 'identity')
  const stopViewingForRecovery = () => {
    operation.current++
    opening.current = null
    setStarting(false)
    if (!state.paused && (state.mode === 'playing' || state.mode === 'transitioning')) dispatch({ type: 'toggle-pause' })
    setRoute('ready')
    void media.stop()
    if (desktopRecording.available) void desktopRecording.stop()
  }

  return <main className={`universe${cinematic ? ' cinematic' : ''}`} data-route={route} data-scene={state.scene} data-mode={state.mode} data-reading={state.reading} data-paused={state.paused} data-debug={developerMode && debug ? 'true' : undefined}>
    <LilyParticlePreparationBanner snapshot={particlePreparation} development={import.meta.env.DEV} onRetry={retryParticlePreparation} />
    {mountedFilm && <div className="film-presentation" hidden={route !== 'film'}>
      <div className="film-surface">
        <PhoneBackground active={showOpeningBackground} scene={state.scene} runtime={runtime} reducedMotion={reducedMotion} />
        <div className="viewport" role="region" aria-label="Интерактивный фильм"><FilmCanvas state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} /></div>
        <PortraitHandoffOverlay scene={state.scene} runtime={runtime} reducedMotion={reducedMotion} identityDuration={state.identityDuration} />
        {!cinematic && <header className="page-header"><span className="dedication">Для Василисы</span>{import.meta.env.DEV && <span className="build-label">{implementationStatus}</span>}</header>}
        <SceneOverlay key={`${state.scene}:${state.revision}`} state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
      </div>
      {cinematic && <button className="cinematic-pause" type="button" data-testid="pause" aria-label={state.paused ? 'Продолжить фильм' : 'Пауза'} aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Ⅱ'}</button>}
    </div>}
    {route === 'loading' ? <Preloader manager={devManager} onReady={onReloadReady} /> : route !== 'film' && <PreparationScreen step={route} session={media} preparation={prepared} checked={checked} starting={starting} startError={visibleStartError} onPrepare={() => start(true)} onWithoutMedia={() => start(false)} onStart={() => start(true)} desktopRecording={desktopRecording.available} showMediaStatus={developerMode} />}
    <PersistentLight phase={lightPhase} interactive={lightInteractive} reducedMotion={reducedMotion} runtime={runtime} state={state} onActivate={() => dispatch({ type: 'interact' })} />
    {developerMode && !desktopRecording.available && <RecordingControls session={media} />}
    <DesktopRecordingControls session={desktopRecording} filmActive={route === 'film'} onStopViewing={stopViewingForRecovery} />
    {developerMode && !desktopRecording.available && <RecoveryPanel session={media} />}
    {state.reading && route === 'film' && <ReadingPanel dispatch={dispatch} />}
    {developerMode && <button className="debug-toggle" type="button" aria-expanded={debug} aria-controls="developer-panel" onClick={() => setDebug((value) => !value)}>DEV</button>}
    {developerMode && debug && <Suspense fallback={<p className="debug-loading">Загрузка Developer Mode…</p>}><DeveloperPanel state={state} dispatch={devDispatch} runtime={runtime} route={route} reducedMotion={reducedMotion} onPreload={() => devPrepare('loading')} desktopRecording={desktopRecording} musicDirector={music} /><SceneTimeline state={state} dispatch={devDispatch} runtime={runtime} route={route} onPreload={() => devPrepare('loading')} /></Suspense>}
  </main>
}
