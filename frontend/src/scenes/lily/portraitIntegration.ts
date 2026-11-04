import type { ParticlePortraitSettings } from '../../particle-portrait-lab/config'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import type { LilyPortraitAppearanceSettings } from './dissolve'
import { createPortraitCameraBasis, type PortraitCameraBasis } from './portraitTargets'
import { sampleStarPortraitTargets, type StarPortraitPoint, type StarPortraitSamplingSettings, type StarPortraitSource } from './starPortraitTargets'

type IdentitySettings = SceneComposerConfig['scenes']['identity']
type BloomSettings = SceneComposerConfig['scenes']['bloom']

export interface LilyPortraitCameraWorkerSettings {
  bloomSettings: Pick<BloomSettings, 'cameraTargetX' | 'cameraTargetY' | 'cameraFinalDistance' | 'cameraFinalHeight'>
  identitySettings: Pick<IdentitySettings, 'cameraPullback' | 'cameraRise' | 'cameraMoveDuration'>
  aspect: number
  reducedMotion: boolean
}

/** Keep the sampler inputs identical to the standalone DEV portrait lab. */
export function toStarPortraitSamplingSettings(settings: ParticlePortraitSettings): StarPortraitSamplingSettings {
  return {
    count: settings.count,
    detailBoost: settings.detailBoost,
    fillDensity: settings.fillDensity,
    contrast: settings.contrast,
    backgroundThreshold: settings.backgroundThreshold,
    irregularity: settings.irregularity,
    seed: settings.seed,
  }
}

export function toLilyPortraitAppearanceSettings(settings: ParticlePortraitSettings): LilyPortraitAppearanceSettings {
  return {
    photoColorMix: settings.photoColorMix,
    opacity: settings.opacity,
    glow: settings.glow,
    minSize: settings.minSize,
    maxSize: settings.maxSize,
    minimumBrightness: settings.minimumBrightness,
    contrast: settings.portraitContrast,
  }
}

export function toLilyPortraitUniformScales(
  portraitSettings: ParticlePortraitSettings,
  particleBrightness: number,
  particleSize: number,
) {
  return {
    brightness: portraitSettings.brightness / Math.max(0.001, particleBrightness),
    size: 1 / Math.max(0.001, particleSize),
  }
}

/**
 * Uses the approved lab sampler and only reorders its existing samples so the
 * early reveal fills the head before hair detail and the lower silhouette.
 */
export function sampleLilyPortraitTargets(source: StarPortraitSource, settings: ParticlePortraitSettings) {
  return orderLilyPortraitTargets(sampleStarPortraitTargets(source, toStarPortraitSamplingSettings(settings)))
}

export function orderLilyPortraitTargets(targets: readonly StarPortraitPoint[]): StarPortraitPoint[] {
  return targets.map((point, index) => ({ point, index, priority: getPortraitRevealPriority(point) }))
    .sort((a, b) => a.priority - b.priority || a.point.featureWeight - b.point.featureWeight || a.index - b.index)
    .map(({ point }) => point)
}

function getPortraitRevealPriority(point: StarPortraitPoint) {
  const isFace = point.u >= 0.46 && point.u <= 0.77 && point.v >= 0.16 && point.v <= 0.55
  if (isFace && point.featureWeight < 0.34) return 0

  const isHeadAndHair = point.u >= 0.2 && point.u <= 0.85 && point.v >= 0.07 && point.v <= 0.62
  if (isHeadAndHair) return 1
  if (isFace) return 2
  return 3
}

/**
 * This matches CameraDirector's Scene 04 `sine.inOut` camera timeline and
 * returns a basis for the camera at any absolute identity-scene time.
 */
export function createLilyPortraitCameraBasisAtTime(input: LilyPortraitCameraWorkerSettings) {
  const start = getBloomCloseupPose(input.bloomSettings)
  const end = getIdentityCameraMoveTarget(start, input.identitySettings)
  const aspect = Number.isFinite(input.aspect) && input.aspect > 0 ? input.aspect : 1
  const fovDegrees = aspect < 1 ? 42 : 38
  const cameraFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1

  return (time: number): PortraitCameraBasis => {
    // For a reduced-motion Identity scene, CameraDirector replaces the Bloom
    // pose with `front` and returns before adding the identity camera tween.
    // Bloom settings therefore affect this projection only when motion is enabled.
    const pose = input.reducedMotion
      ? { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
      : getIdentityCameraPoseAt(start, end, time, input.identitySettings.cameraMoveDuration)
    return createPortraitCameraBasis({
      eye: [pose.tx + (pose.x - pose.tx) * cameraFit, pose.ty + (pose.y - pose.ty) * cameraFit,
        pose.tz + (pose.z - pose.tz) * cameraFit],
      lookAt: [pose.tx, pose.ty, pose.tz], aspect, fovDegrees, planeDistance: 3.4,
    })
  }
}

/** Places the exact lab UVs on a camera-facing plane with its scale and offset semantics. */
export function placeLilyPortraitTargets(
  targets: readonly StarPortraitPoint[],
  sourceAspect: number,
  basis: PortraitCameraBasis,
  settings: Pick<ParticlePortraitSettings, 'scale' | 'offsetX' | 'offsetY'>,
): [number, number, number][] {
  const aspect = Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 1
  const fitWidth = aspect <= basis.aspect ? basis.visibleHeight * aspect : basis.visibleWidth
  const fitHeight = fitWidth / aspect
  const scale = settings.scale
  const xOffset = settings.offsetX * basis.visibleWidth
  const yOffset = -settings.offsetY * basis.visibleHeight

  return targets.map((target) => [
    basis.center[0] + basis.right[0] * ((target.u - 0.5) * fitWidth * scale + xOffset)
      + basis.up[0] * ((0.5 - target.v) * fitHeight * scale + yOffset),
    basis.center[1] + basis.right[1] * ((target.u - 0.5) * fitWidth * scale + xOffset)
      + basis.up[1] * ((0.5 - target.v) * fitHeight * scale + yOffset),
    basis.center[2] + basis.right[2] * ((target.u - 0.5) * fitWidth * scale + xOffset)
      + basis.up[2] * ((0.5 - target.v) * fitHeight * scale + yOffset),
  ])
}

export function toLilyPortraitCaptureSettings(settings: IdentitySettings) {
  return {
    portraitStartProgress: settings.portraitStartProgress,
    portraitFraction: settings.portraitFraction,
    portraitMinTurns: settings.portraitMinTurns,
    portraitMaxTurns: settings.portraitMaxTurns,
    portraitSteering: settings.portraitSteering,
    portraitBraking: settings.portraitBraking,
    portraitSettledBrightness: settings.portraitSettledBrightness,
    vortexSpeedMultiplier: settings.vortexSpeedMultiplier,
  }
}

function getIdentityCameraPoseAt(start: ReturnType<typeof getBloomCloseupPose>, end: ReturnType<typeof getBloomCloseupPose>, time: number, duration: number) {
  const progress = Math.min(1, Math.max(0, (Number.isFinite(time) ? time : 0) / Math.max(0.001, duration)))
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress)
  return {
    x: start.x + (end.x - start.x) * eased, y: start.y + (end.y - start.y) * eased, z: start.z + (end.z - start.z) * eased,
    tx: start.tx + (end.tx - start.tx) * eased, ty: start.ty + (end.ty - start.ty) * eased, tz: start.tz + (end.tz - start.tz) * eased,
  }
}
