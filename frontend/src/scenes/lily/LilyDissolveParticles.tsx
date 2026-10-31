import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Points } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import photoUrl from '../../assets/start_img.jpg'
import matteUrl from '../../assets/start_img.matte.png'
import { createPortraitCameraBasis, placePortraitTargets, samplePortraitTargets, type PortraitPixelSource } from './portraitTargets'
import { createLilyParticleGeometry, createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, updateLilyPortraitSettings, type LilyDissolveUniforms, type LilyPortraitGeometryOptions } from './dissolve'
import type { LilySurfaceSource } from './particleSource'

export function LilyDissolveParticles({ source, uniforms, low, reducedMotion, runtime }: {
  source: LilySurfaceSource
  uniforms: LilyDissolveUniforms
  low: boolean
  reducedMotion: boolean
  runtime: FilmRuntime
}) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const [pixelSource, setPixelSource] = useState<PortraitPixelSource | null>(null)
  const settings = config.scenes.identity
  const count = low ? Math.min(12000, settings.particleCount) : settings.particleCount
  const portraitStart = settings.portraitStart
  const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, TIMING.identity.duration - portraitStart))
  const portraitTargetCount = Math.floor(count * settings.portraitFraction)
  const portraitTargets = useMemo(() => pixelSource
    ? samplePortraitTargets(pixelSource, portraitTargetCount, settings.portraitDetail) : [],
  [pixelSource, portraitTargetCount, settings.portraitDetail])

  const bloomPose = useMemo(() => getBloomCloseupPose(config.scenes.bloom), [config.scenes.bloom])
  const identityPose = useMemo(() => getIdentityCameraMoveTarget(bloomPose, settings), [bloomPose, settings])
  const fovDegrees = aspect < 1 ? 42 : 38
  const cameraFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
  const selectionTime = Math.max(0, portraitStart - 0.16)
  const selectionPose = useMemo(() => getIdentityCameraPoseAt(bloomPose, identityPose, selectionTime, settings.cameraMoveDuration, reducedMotion),
    [bloomPose, identityPose, selectionTime, settings.cameraMoveDuration, reducedMotion])
  const targetPose = reducedMotion ? bloomPose : identityPose
  const selectionBasis = useMemo(() => makePortraitBasis(selectionPose, aspect, fovDegrees, cameraFit), [selectionPose, aspect, fovDegrees, cameraFit])
  const portraitBasis = useMemo(() => makePortraitBasis(targetPose, aspect, fovDegrees, cameraFit), [targetPose, aspect, fovDegrees, cameraFit])
  const targetPositions = useMemo(() => pixelSource
    ? placePortraitTargets(portraitTargets, pixelSource.width / pixelSource.height, portraitBasis,
      settings.portraitScale, settings.portraitOffsetX, settings.portraitOffsetY) : [],
  [pixelSource, portraitTargets, portraitBasis, settings.portraitScale, settings.portraitOffsetX, settings.portraitOffsetY])
  const particleSettings = useMemo(() => ({
    particleBrightness: 1,
    vortexRadius: settings.vortexRadius,
    vortexExpansion: settings.vortexExpansion,
    swirlSpeed: settings.swirlSpeed,
    swirlAcceleration: settings.swirlAcceleration,
    centerDissolveAt: settings.centerDissolveAt,
  }), [settings.vortexRadius, settings.vortexExpansion, settings.swirlSpeed, settings.swirlAcceleration, settings.centerDissolveAt])
  const geometryOptions = useMemo<LilyPortraitGeometryOptions | undefined>(() => pixelSource && portraitTargets.length > 0 ? ({
    targets: portraitTargets,
    targetPositions,
    fraction: settings.portraitFraction,
    start: portraitStart,
    duration: portraitDuration,
    dissolveDuration: settings.dissolveDuration,
    edgeWidth: settings.edgeWidth,
    cameraBasis: selectionBasis,
    settings: particleSettings,
  }) : undefined, [pixelSource, portraitTargets, targetPositions, settings.portraitFraction, settings.dissolveDuration,
    settings.edgeWidth, particleSettings, portraitStart, portraitDuration, selectionBasis])
  const geometry = useMemo(() => createLilyParticleGeometry(source, count, geometryOptions), [source, count, geometryOptions])
  const material = useMemo(() => createLilyParticleMaterial(uniforms), [uniforms])
  const hasPortrait = useMemo(() => {
    const route = geometry.getAttribute('aPortraitMotion').array
    for (let index = 3; index < route.length; index += 4) if (route[index]! > 0.5) return true
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
    const sync = (time: number) => {
      updateLilyPortraitSettings(uniforms, time, {
        portraitStart,
        portraitDuration,
        portraitBrightness: settings.portraitBrightness,
        portraitSize: settings.portraitSize,
      })
      if (points.current) points.current.visible = hasPortrait || time < settings.dissolveDuration + LILY_PARTICLE_TAIL_SECONDS
      invalidate()
    }
    sync(runtime.time)
    return runtime.subscribeFrame(sync)
  }, [runtime, invalidate, hasPortrait, uniforms, portraitStart, portraitDuration, settings.portraitBrightness, settings.portraitSize, settings.dissolveDuration])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}

async function readPortraitPixelSource(): Promise<PortraitPixelSource> {
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

function getIdentityCameraPoseAt(start: ReturnType<typeof getBloomCloseupPose>, end: ReturnType<typeof getBloomCloseupPose>, time: number, duration: number, reducedMotion: boolean) {
  if (reducedMotion) return start
  const progress = Math.min(1, Math.max(0, time / Math.max(0.001, duration)))
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress)
  return {
    x: start.x + (end.x - start.x) * eased, y: start.y + (end.y - start.y) * eased, z: start.z + (end.z - start.z) * eased,
    tx: start.tx + (end.tx - start.tx) * eased, ty: start.ty + (end.ty - start.ty) * eased, tz: start.tz + (end.tz - start.tz) * eased,
  }
}

function makePortraitBasis(pose: ReturnType<typeof getBloomCloseupPose>, aspect: number, fovDegrees: number, cameraFit: number) {
  return createPortraitCameraBasis({
    eye: [pose.tx + (pose.x - pose.tx) * cameraFit, pose.ty + (pose.y - pose.ty) * cameraFit, pose.tz + (pose.z - pose.tz) * cameraFit],
    lookAt: [pose.tx, pose.ty, pose.tz], aspect, fovDegrees, planeDistance: 3.4,
  })
}
