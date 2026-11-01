import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Points } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import { loadParticlePortraitSettings } from '../../particle-portrait-lab/config'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import photoUrl from '../../assets/start_img.jpg'
import matteUrl from '../../assets/start_img.matte.png'
import { createLilyParticleGeometry, createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, updateLilyPortraitAppearance, updateLilyPortraitSettings, type LilyDissolveUniforms, type LilyVisiblePortraitGeometryOptions } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { createLilyPortraitCameraBasisAtTime, placeLilyPortraitTargets, sampleLilyPortraitTargets, toLilyPortraitAppearanceSettings, toLilyPortraitCaptureSettings, toLilyPortraitUniformScales } from './portraitIntegration'
import type { StarPortraitSource } from './starPortraitTargets'

export function LilyDissolveParticles({ source, uniforms, reducedMotion, runtime }: {
  source: LilySurfaceSource
  uniforms: LilyDissolveUniforms
  /** Kept as an API hint; this layer preserves the configured budget for the approved portrait template. */
  low: boolean
  reducedMotion: boolean
  runtime: FilmRuntime
}) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const [pixelSource, setPixelSource] = useState<StarPortraitSource | null>(null)
  const [portraitSettings] = useState(() => loadParticlePortraitSettings().settings)
  const settings = config.scenes.identity
  const portraitUniformScales = useMemo(() => toLilyPortraitUniformScales(portraitSettings, settings.particleBrightness, settings.particleSize),
    [portraitSettings, settings.particleBrightness, settings.particleSize])
  const count = settings.particleCount
  const portraitStart = settings.portraitStartProgress * settings.dissolveDuration
  const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, TIMING.identity.duration - portraitStart))
  const portraitTargets = useMemo(() => pixelSource ? sampleLilyPortraitTargets(pixelSource, portraitSettings) : [],
    [pixelSource, portraitSettings])

  const cameraBasisAtTime = useMemo(() => createLilyPortraitCameraBasisAtTime({
    bloomSettings: config.scenes.bloom, identitySettings: settings, aspect, reducedMotion,
  }), [config.scenes.bloom, settings, aspect, reducedMotion])
  const portraitBasis = useMemo(() => cameraBasisAtTime(settings.cameraMoveDuration), [cameraBasisAtTime, settings.cameraMoveDuration])
  const targetPositions = useMemo(() => pixelSource
    ? placeLilyPortraitTargets(portraitTargets, pixelSource.width / pixelSource.height, portraitBasis, portraitSettings) : [],
  [pixelSource, portraitTargets, portraitBasis, portraitSettings])
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
  const geometryOptions = useMemo<LilyVisiblePortraitGeometryOptions | undefined>(() => pixelSource && portraitTargets.length > 0 ? ({
    targets: portraitTargets,
    targetPositions,
    start: portraitStart,
    duration: portraitDuration,
    dissolveDuration: settings.dissolveDuration,
    edgeWidth: settings.edgeWidth,
    cameraBasisAtTime,
    settings: particleSettings,
    capture: toLilyPortraitCaptureSettings(settings),
  }) : undefined, [pixelSource, portraitTargets, targetPositions, particleSettings, cameraBasisAtTime, portraitStart, portraitDuration, settings])
  const geometry = useMemo(() => createLilyParticleGeometry(source, count, geometryOptions), [source, count, geometryOptions])
  const material = useMemo(() => createLilyParticleMaterial(uniforms), [uniforms])
  const hasPortrait = useMemo(() => {
    const route = geometry.getAttribute('aPortraitRoute').array
    for (let index = 0; index < route.length; index += 1) if (route[index]! > 0.5) return true
    return false
  }, [geometry])

  useEffect(() => {
    let active = true
    void readPortraitPixelSource().then((pixels) => {
      if (active) setPixelSource(pixels)
    }).catch((error: unknown) => {
      if (active && import.meta.env.DEV) console.warn('Scene 04 portrait sampling is unavailable; preserving the vortex fallback.', error)
    })
    return () => { active = false }
  }, [])

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

async function readPortraitPixelSource(): Promise<StarPortraitSource> {
  const [photo, matte] = await Promise.all([loadImage(photoUrl), loadImage(matteUrl)])
  const width = photo.naturalWidth, height = photo.naturalHeight
  if (width < 2 || height < 2 || matte.naturalWidth < 2 || matte.naturalHeight < 2
    || Math.abs(matte.naturalWidth / matte.naturalHeight - width / height) > 0.005) {
    throw new Error('The portrait photo and matte dimensions do not match.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('A 2D canvas context is unavailable for portrait sampling.')
  context.drawImage(photo, 0, 0, width, height)
  const photoRgba = new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
  context.clearRect(0, 0, width, height)
  context.drawImage(matte, 0, 0, width, height)
  const matteRgba = new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
  return { photoRgba, matteRgba, width, height }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  return image.decode().then(() => image)
}
