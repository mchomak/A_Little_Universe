import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, type Points } from 'three'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, updateLilyPortraitAppearance, updateLilyPortraitSettings, type LilyDissolveUniforms } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { toLilyPortraitAppearanceSettings, toLilyPortraitCaptureSettings, toLilyPortraitUniformScales } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS, applyApprovedPortraitAppearance, createApprovedPortraitGate, loadApprovedPortrait } from './approvedPortrait'
import { createLilyGeometryWorkerRequest, sampleLilySurfaceForWorker, serializeLilyPortraitTargets, type LilyGeometryWorkerPortraitOptions, type LilyGeometryWorkerSuccess } from './lilyGeometryWorkerClient'
import { ParticlePreparationStatus } from './ParticlePreparationStatus'

type ParticleProps = {
  source: LilySurfaceSource
  uniforms: LilyDissolveUniforms
  /** Kept as an API hint; this layer preserves the configured budget for the approved portrait template. */
  low: boolean
  reducedMotion: boolean
  runtime: FilmRuntime
}

/** Hold the scene until the portrait and its worker-built particle geometry are ready. */
export function LilyDissolveParticles(props: ParticleProps) {
  const [portrait, setPortrait] = useState<Awaited<ReturnType<typeof loadApprovedPortrait>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const gate = useRef<ReturnType<typeof createApprovedPortraitGate> | null>(null)
  const geometryPreparationRelease = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    const next = createApprovedPortraitGate(props.runtime, (data) => { setError(null); setPortrait(data) }, (reason) => {
      console.error('Scene 04 approved portrait failed to load.', reason)
      setError('Не удалось подготовить портрет.')
    })
    gate.current = next
    next.load()
    return () => { gate.current = null; next.dispose() }
  }, [props.runtime])

  const holdGeometryPreparation = useCallback(() => {
    if (!geometryPreparationRelease.current) geometryPreparationRelease.current = props.runtime.hold()
  }, [props.runtime])
  const releaseGeometryPreparation = useCallback(() => {
    geometryPreparationRelease.current?.()
    geometryPreparationRelease.current = null
  }, [])
  useLayoutEffect(() => () => releaseGeometryPreparation(), [releaseGeometryPreparation])
  const commitReady = useCallback(() => {
    releaseGeometryPreparation()
    gate.current?.committed()
  }, [releaseGeometryPreparation])
  const reportWorkerError = useCallback((reason: unknown) => {
    console.error('Scene 04 particle preparation failed.', reason)
    setError('Не удалось подготовить световой вихрь.')
  }, [])
  const retry = useCallback(() => {
    setError(null)
    if (portrait) setAttempt((value) => value + 1)
    else gate.current?.load()
  }, [portrait])

  if (error) return <Html center><div role="alert" style={{ color: 'white', background: '#080914', padding: 16 }}>
    {error} <button type="button" onClick={retry}>Повторить</button>
  </div></Html>

  return portrait
    ? <ReadyLilyDissolveParticles {...props} portrait={portrait} attempt={attempt} onPreparationStart={holdGeometryPreparation} onReady={commitReady} onError={reportWorkerError} />
    : <ParticlePreparationStatus message="Подготавливаем частицы для распада…" />
}

function ReadyLilyDissolveParticles({ source, uniforms, reducedMotion, runtime, portrait, attempt, onPreparationStart, onReady, onError }: ParticleProps & {
  portrait: Awaited<ReturnType<typeof loadApprovedPortrait>>
  attempt: number
  onPreparationStart: () => void
  onReady: () => void
  onError: (error: unknown) => void
}) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const portraitSettings = APPROVED_PORTRAIT_SETTINGS
  const settings = config.scenes.identity
  const portraitUniformScales = useMemo(() => toLilyPortraitUniformScales(portraitSettings, settings.particleBrightness, settings.particleSize),
    [portraitSettings, settings.particleBrightness, settings.particleSize])
  const count = settings.particleCount
  const portraitStart = settings.portraitStartProgress * settings.dissolveDuration
  const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, TIMING.identity.duration - portraitStart))
  const portraitTargets = portrait.points

  const workerCameraSettings = useMemo(() => ({
    bloomSettings: config.scenes.bloom,
    identitySettings: settings,
    aspect,
    reducedMotion,
  }), [config.scenes.bloom, settings, aspect, reducedMotion])
  const particleSettings = useMemo(() => ({
    particleBrightness: settings.particleBrightness,
    vortexRadius: settings.vortexRadius,
    vortexExpansion: settings.vortexExpansion,
    swirlSpeed: settings.swirlSpeed,
    swirlAcceleration: settings.swirlAcceleration,
    centerDissolveAt: settings.centerDissolveAt,
    vortexSpeedMultiplier: settings.vortexSpeedMultiplier,
    portraitSteering: settings.portraitSteering,
    portraitBraking: settings.portraitBraking,
    portraitSettledBrightness: settings.portraitSettledBrightness,
  }), [settings.particleBrightness, settings.vortexRadius, settings.vortexExpansion, settings.swirlSpeed, settings.swirlAcceleration, settings.centerDissolveAt,
    settings.vortexSpeedMultiplier, settings.portraitSteering, settings.portraitBraking, settings.portraitSettledBrightness])
  const geometryOptions = useMemo<LilyGeometryWorkerPortraitOptions | undefined>(() => portraitTargets.length > 0 ? ({
    width: portrait.width,
    height: portrait.height,
    appearanceSettings: { scale: portraitSettings.scale, offsetX: portraitSettings.offsetX, offsetY: portraitSettings.offsetY },
    start: portraitStart,
    duration: portraitDuration,
    dissolveDuration: settings.dissolveDuration,
    edgeWidth: settings.edgeWidth,
    settings: particleSettings,
    capture: toLilyPortraitCaptureSettings(settings),
  }) : undefined, [portrait, portraitTargets, portraitSettings, particleSettings, portraitStart, portraitDuration, settings])

  useLayoutEffect(() => {
    let cancelled = false
    let request: ReturnType<typeof createLilyGeometryWorkerRequest> | undefined
    onPreparationStart()
    if (!geometryOptions) {
      onError(new Error('Scene 04 portrait targets are empty.'))
      return () => { cancelled = true }
    }
    void Promise.all([
      sampleLilySurfaceForWorker(source, count, undefined, () => cancelled),
      serializeLilyPortraitTargets(portraitTargets, undefined, () => cancelled),
    ]).then(([sampledSource, packedTargets]) => {
      if (cancelled) return
      request = createLilyGeometryWorkerRequest({
        count,
        source: sampledSource,
        portrait: { ...geometryOptions, targetValues: packedTargets.values, targetTypes: packedTargets.types },
        cameraSettings: workerCameraSettings,
      })
      return request.promise
    }).then((result) => {
      if (!result || cancelled) return
      setGeometry(createBufferGeometry(result))
    }).catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === 'AbortError')) return
      onError(reason)
    })
    return () => {
      cancelled = true
      request?.cancel()
    }
  }, [source, count, portraitTargets, geometryOptions, workerCameraSettings, attempt, onError, onPreparationStart])

  useEffect(() => () => geometry?.dispose(), [geometry])
  useLayoutEffect(() => { if (geometry) onReady() }, [geometry, onReady])

  const material = useMemo(() => {
    const next = createLilyParticleMaterial(uniforms)
    // Match the lab's per-point appearance only as particles settle into the portrait.
    applyApprovedPortraitAppearance(next)
    return next
  }, [uniforms])
  const hasPortrait = useMemo(() => {
    if (!geometry) return false
    const route = geometry.getAttribute('aPortraitRoute').array
    for (let index = 0; index < route.length; index += 1) if (route[index]! > 0.5) return true
    return false
  }, [geometry])

  useLayoutEffect(() => { updateLilyParticleSize(uniforms, settings.particleSize, dpr) }, [uniforms, settings.particleSize, dpr])
  useLayoutEffect(() => {
    updateLilyPortraitAppearance(uniforms, toLilyPortraitAppearanceSettings(portraitSettings))
  }, [uniforms, portraitSettings])
  useLayoutEffect(() => {
    const sync = (time: number) => {
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
  }, [runtime, invalidate, hasPortrait, uniforms, portraitStart, portraitDuration, portraitUniformScales, settings.dissolveDuration])
  useEffect(() => () => material.dispose(), [material])

  return geometry
    ? <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
    : <ParticlePreparationStatus message="Подготавливаем частицы для распада…" />
}

function createBufferGeometry(result: LilyGeometryWorkerSuccess) {
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(result.attributes)) {
    geometry.setAttribute(name, new BufferAttribute(attribute.array, attribute.itemSize))
  }
  return geometry
}
