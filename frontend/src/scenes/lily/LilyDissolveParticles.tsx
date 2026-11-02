import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Points } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createLilyParticleGeometry, createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, updateLilyPortraitAppearance, updateLilyPortraitSettings, type LilyDissolveUniforms, type LilyVisiblePortraitGeometryOptions } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { createLilyPortraitCameraBasisAtTime, placeLilyPortraitTargets, toLilyPortraitAppearanceSettings, toLilyPortraitCaptureSettings, toLilyPortraitUniformScales } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS, applyApprovedPortraitAppearance, createApprovedPortraitGate, loadApprovedPortrait } from './approvedPortrait'
type ParticleProps = {
  source: LilySurfaceSource
  uniforms: LilyDissolveUniforms
  /** Kept as an API hint; this layer preserves the configured budget for the approved portrait template. */
  low: boolean
  reducedMotion: boolean
  runtime: FilmRuntime
}

/** Hold the scene until the approved target data is ready, including on seek. */
export function LilyDissolveParticles(props: ParticleProps) {
  const [portrait, setPortrait] = useState<Awaited<ReturnType<typeof loadApprovedPortrait>> | null>(null)
  const [error, setError] = useState(false)
  const gate = useRef<ReturnType<typeof createApprovedPortraitGate> | null>(null)
  useLayoutEffect(() => {
    const next = createApprovedPortraitGate(props.runtime, (data) => { setError(false); setPortrait(data) }, (reason) => {
      console.error('Scene 04 approved portrait failed to load.', reason); setError(true)
    })
    gate.current = next
    next.load()
    return () => { gate.current = null; next.dispose() }
  }, [props.runtime])
  useLayoutEffect(() => { if (portrait) gate.current?.committed() }, [portrait, props.runtime])
  if (error) return <Html center><div role="alert" style={{ color: 'white', background: '#080914', padding: 16 }}>
    Не удалось загрузить портрет. <button type="button" onClick={() => { setError(false); gate.current?.load() }}>Повторить</button>
  </div></Html>
  return portrait ? <ReadyLilyDissolveParticles {...props} portrait={portrait} /> : null
}

function ReadyLilyDissolveParticles({ source, uniforms, reducedMotion, runtime, portrait }: ParticleProps & { portrait: Awaited<ReturnType<typeof loadApprovedPortrait>> }) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const portraitSettings = APPROVED_PORTRAIT_SETTINGS
  const settings = config.scenes.identity
  const portraitUniformScales = useMemo(() => toLilyPortraitUniformScales(portraitSettings, settings.particleBrightness, settings.particleSize),
    [portraitSettings, settings.particleBrightness, settings.particleSize])
  const count = settings.particleCount
  const portraitStart = settings.portraitStartProgress * settings.dissolveDuration
  const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, TIMING.identity.duration - portraitStart))
  const portraitTargets = portrait.points

  const cameraBasisAtTime = useMemo(() => createLilyPortraitCameraBasisAtTime({
    bloomSettings: config.scenes.bloom, identitySettings: settings, aspect, reducedMotion,
  }), [config.scenes.bloom, settings, aspect, reducedMotion])
  const portraitBasis = useMemo(() => cameraBasisAtTime(settings.cameraMoveDuration), [cameraBasisAtTime, settings.cameraMoveDuration])
  const targetPositions = useMemo(() => placeLilyPortraitTargets(portraitTargets, portrait.width / portrait.height, portraitBasis, portraitSettings),
  [portrait, portraitTargets, portraitBasis, portraitSettings])
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
  const geometryOptions = useMemo<LilyVisiblePortraitGeometryOptions | undefined>(() => portraitTargets.length > 0 ? ({
    targets: portraitTargets,
    targetPositions,
    start: portraitStart,
    duration: portraitDuration,
    dissolveDuration: settings.dissolveDuration,
    edgeWidth: settings.edgeWidth,
    cameraBasisAtTime,
    settings: particleSettings,
    capture: toLilyPortraitCaptureSettings(settings),
  }) : undefined, [portraitTargets, targetPositions, particleSettings, cameraBasisAtTime, portraitStart, portraitDuration, settings])
  const geometry = useMemo(() => createLilyParticleGeometry(source, count, geometryOptions), [source, count, geometryOptions])
  const material = useMemo(() => {
    const next = createLilyParticleMaterial(uniforms)
    // Match the lab's per-point appearance only as particles settle into the portrait.
    applyApprovedPortraitAppearance(next)
    return next
  }, [uniforms])
  const hasPortrait = useMemo(() => {
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
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
