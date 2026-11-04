import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, type Points } from 'three'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, updateLilyPortraitAppearance, updateLilyPortraitSettings, type LilyDissolveUniforms } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { toLilyPortraitAppearanceSettings, toLilyPortraitUniformScales } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS, applyApprovedPortraitAppearance, loadApprovedPortrait } from './approvedPortrait'
import { createLilyGeometryWorkerRequest, sampleLilySurfaceForWorker, serializeLilyPortraitTargets, type LilyGeometryWorkerSuccess } from './lilyGeometryWorkerClient'
import { createLilyParticleGeometrySetup, lilyParticlePreparation } from './lilyParticlePreparation'
import { ParticlePreparationStatus } from './ParticlePreparationStatus'

type ParticleProps = {
  source: LilySurfaceSource
  uniforms: LilyDissolveUniforms
  /** Kept as an API hint; this layer preserves the configured budget for the approved portrait template. */
  low: boolean
  reducedMotion: boolean
  runtime: FilmRuntime
}

/** Read the approved points without holding the film clock while async work runs. */
export function LilyDissolveParticles(props: ParticleProps) {
  const [portrait, setPortrait] = useState<Awaited<ReturnType<typeof loadApprovedPortrait>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void loadApprovedPortrait().then((data) => {
      if (!cancelled) { setError(null); setPortrait(data) }
    }).catch((reason: unknown) => {
      if (cancelled) return
      console.error('Scene 04 approved portrait failed to load.', reason)
      setError('Не удалось подготовить портрет.')
    })
    return () => { cancelled = true }
  }, [attempt])

  const retry = useCallback(() => { setError(null); setAttempt((value) => value + 1) }, [])
  if (error) return <Html center><div role="alert" style={{ color: 'white', background: '#080914', padding: 16 }}>
    {error} <button type="button" onClick={retry}>Повторить</button>
  </div></Html>

  return portrait
    ? <ReadyLilyDissolveParticles {...props} portrait={portrait} />
    : <ParticlePreparationStatus message="Подготавливаем частицы для распада…" />
}

function ReadyLilyDissolveParticles({ source, uniforms, reducedMotion, runtime, portrait }: ParticleProps & {
  portrait: Awaited<ReturnType<typeof loadApprovedPortrait>>
}) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const preparationSnapshot = useSyncExternalStore(lilyParticlePreparation.subscribe, lilyParticlePreparation.getSnapshot, lilyParticlePreparation.getSnapshot)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const [localGeometry, setLocalGeometry] = useState<{ key: string; geometry: BufferGeometry } | null>(null)
  const localGeometryRef = useRef<{ key: string; geometry: BufferGeometry } | null>(null)
  const [localFailure, setLocalFailure] = useState<{ key: string; message: string } | null>(null)
  const settings = config.scenes.identity
  const portraitUniformScales = useMemo(() => toLilyPortraitUniformScales(APPROVED_PORTRAIT_SETTINGS, settings.particleBrightness, settings.particleSize),
    [settings.particleBrightness, settings.particleSize])
  const setup = useMemo(() => createLilyParticleGeometrySetup({
    config,
    width: size.width,
    height: size.height,
    reducedMotion,
    sourceSignature: source.signature ?? 'unversioned-lily-surface',
  }), [config, reducedMotion, size.height, size.width, source.signature])
  const cached = lilyParticlePreparation.getForKey(setup.key)
  const cachedWorkerGeometry = cached?.geometry
  const cachedStatus = cached?.status
  const cachedGeometry = useMemo(() => cachedWorkerGeometry ? createBufferGeometry(cachedWorkerGeometry) : null,
    [cachedWorkerGeometry])
  const managerPreparing = preparationSnapshot.status === 'preparing'
    && (preparationSnapshot.key === setup.key || preparationSnapshot.key === setup.seedKey)
  const activeError = cachedGeometry ? null
    : managerPreparing ? null
      : localFailure?.key === setup.key ? localFailure.message
    : cached?.status === 'error' ? cached.error ?? 'Не удалось подготовить световой вихрь.'
      : preparationSnapshot.status === 'error' && preparationSnapshot.key === setup.key ? preparationSnapshot.error : null
  const displayedGeometry = cachedGeometry ?? (localGeometry?.key === setup.key ? localGeometry.geometry : null)

  useLayoutEffect(() => {
    const previous = localGeometryRef.current
    if (previous && previous.key !== setup.key) {
      previous.geometry.dispose()
      localGeometryRef.current = null
    }
  }, [setup.key])

  const retry = useCallback(() => {
    setLocalFailure(null)
    void lilyParticlePreparation.retry({ config, width: size.width, height: size.height, reducedMotion }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === 'AbortError') return
      setLocalFailure({ key: setup.key, message: 'Не удалось подготовить световой вихрь.' })
    })
  }, [config, reducedMotion, setup.key, size.height, size.width])

  useLayoutEffect(() => {
    let cancelled = false
    let request: ReturnType<typeof createLilyGeometryWorkerRequest> | undefined
    if (cachedWorkerGeometry) {
      return () => { cancelled = true }
    }
    if (cachedStatus === 'error') {
      return () => { cancelled = true }
    }
    const snapshot = lilyParticlePreparation.getSnapshot()
    if (snapshot.status === 'preparing' && (snapshot.key === setup.seedKey || snapshot.key === setup.key)) {
      // Keep the currently displayed geometry while the active request catches up.
      return () => { cancelled = true }
    }
    if (preparationSnapshot.status === 'error' && preparationSnapshot.key === setup.key) {
      return () => { cancelled = true }
    }

    void Promise.all([
      sampleLilySurfaceForWorker(source, setup.count, undefined, () => cancelled),
      serializeLilyPortraitTargets(portrait.points, undefined, () => cancelled),
    ]).then(([sampledSource, packedTargets]) => {
      if (cancelled) return
      request = createLilyGeometryWorkerRequest({
        count: setup.count,
        source: sampledSource,
        portrait: { ...setup.portrait, targetValues: packedTargets.values, targetTypes: packedTargets.types },
        cameraSettings: setup.cameraSettings,
      })
      return request.promise
    }).then((result) => {
      if (!result || cancelled) return
      const next = { key: setup.key, geometry: createBufferGeometry(result) }
      localGeometryRef.current?.geometry.dispose()
      localGeometryRef.current = next
      setLocalFailure(null)
      setLocalGeometry(next)
    }).catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === 'AbortError')) return
      console.error('Scene 04 particle preparation failed.', reason)
      setLocalFailure({ key: setup.key, message: 'Не удалось подготовить световой вихрь.' })
    })
    return () => {
      cancelled = true
      request?.cancel()
    }
  }, [cachedStatus, cachedWorkerGeometry, preparationSnapshot, portrait, setup, source])

  useEffect(() => () => {
    localGeometryRef.current?.geometry.dispose()
    localGeometryRef.current = null
  }, [])
  useEffect(() => () => cachedGeometry?.dispose(), [cachedGeometry])

  const material = useMemo(() => {
    const next = createLilyParticleMaterial(uniforms)
    applyApprovedPortraitAppearance(next)
    return next
  }, [uniforms])
  const hasPortrait = useMemo(() => {
    if (!displayedGeometry) return false
    const route = displayedGeometry.getAttribute('aPortraitRoute')?.array
    if (!route) return false
    for (let index = 0; index < route.length; index += 1) if (route[index]! > 0.5) return true
    return false
  }, [displayedGeometry])

  useLayoutEffect(() => { updateLilyParticleSize(uniforms, settings.particleSize, dpr) }, [uniforms, settings.particleSize, dpr])
  useLayoutEffect(() => {
    updateLilyPortraitAppearance(uniforms, toLilyPortraitAppearanceSettings(APPROVED_PORTRAIT_SETTINGS))
  }, [uniforms])
  useLayoutEffect(() => {
    const sync = (time: number) => {
      const portraitStart = settings.portraitStartProgress * settings.dissolveDuration
      const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, TIMING.identity.duration - portraitStart))
      updateLilyPortraitSettings(uniforms, time, {
        portraitStart,
        portraitDuration,
        portraitBrightness: portraitUniformScales.brightness,
        portraitSize: portraitUniformScales.size,
      })
      if (points.current) points.current.visible = hasPortrait || time < settings.dissolveDuration + LILY_PARTICLE_TAIL_SECONDS
      invalidate()
    }
    sync(runtime.time)
    return runtime.subscribeFrame(sync)
  }, [runtime, invalidate, hasPortrait, uniforms, portraitUniformScales, settings.dissolveDuration, settings.portraitDuration, settings.portraitStartProgress])
  useEffect(() => () => material.dispose(), [material])

  if (activeError) return <Html center><div role="alert" style={{ color: 'white', background: '#080914', padding: 16 }}>
    {activeError} <button type="button" onClick={retry}>Повторить</button>
  </div></Html>

  return <>
    {displayedGeometry
      ? <points ref={points} geometry={displayedGeometry} material={material} frustumCulled={false} />
      : <ParticlePreparationStatus message="Подготавливаем частицы для распада…" />}
  </>
}

function createBufferGeometry(result: LilyGeometryWorkerSuccess) {
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(result.attributes)) {
    geometry.setAttribute(name, new BufferAttribute(attribute.array, attribute.itemSize))
  }
  return geometry
}
