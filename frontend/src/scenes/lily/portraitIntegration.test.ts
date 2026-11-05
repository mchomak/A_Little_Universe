import { describe, expect, it } from 'vitest'
import { createFilmRuntime } from '../../engine/runtime'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget, getIdentityCameraPoseAt } from '../../engine/identityCamera'
import { DEFAULT_PARTICLE_PORTRAIT_SETTINGS } from '../../particle-portrait-lab/config'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getLilyParticlePortraitPosition } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { createPortraitCameraBasis } from './portraitTargets'
import { createLilyPortraitCameraBasisAtTime, orderLilyPortraitTargets, placeLilyPortraitTargets, sampleLilyPortraitTargets, toLilyPortraitAppearanceSettings, toLilyPortraitCaptureSettings, toLilyPortraitUniformScales, toStarPortraitSamplingSettings } from './portraitIntegration'
import { sampleStarPortraitTargets, type StarPortraitPoint, type StarPortraitSource } from './starPortraitTargets'

describe('Scene 04 portrait integration', () => {
  it('passes the saved DEV settings through the same sampler and preserves its sampled point data', () => {
    const source = makeSource(256, 256)
    expect(toStarPortraitSamplingSettings(DEFAULT_PARTICLE_PORTRAIT_SETTINGS).count).toBe(32_000)
    const settings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, count: 4_000 }
    const expectedSampling = {
      count: 4_000,
      detailBoost: settings.detailBoost,
      fillDensity: settings.fillDensity,
      contrast: settings.contrast,
      backgroundThreshold: settings.backgroundThreshold,
      irregularity: settings.irregularity,
      seed: settings.seed,
    }
    expect(toStarPortraitSamplingSettings(settings)).toEqual(expectedSampling)

    const sampled = sampleStarPortraitTargets(source, expectedSampling)
    const integrated = sampleLilyPortraitTargets(source, settings)
    expect(integrated).toEqual(orderLilyPortraitTargets(sampled))
    expect(integrated).toHaveLength(4_000)
    expect(integrated.every((point) => point.photoColorLinear.every(Number.isFinite))).toBe(true)
  })

  it('orders broad face, hair, facial detail, and lower silhouette points with overlap-ready groups', () => {
    const broadFace = point(0.62, 0.35, 0.2, 0.1)
    const hair = point(0.31, 0.32, 0.2, 0.2)
    const facialDetail = point(0.63, 0.34, 0.8, 0.3)
    const shoulders = point(0.68, 0.75, 0.8, 0.4)

    expect(orderLilyPortraitTargets([shoulders, facialDetail, hair, broadFace]))
      .toEqual([broadFace, hair, facialDetail, shoulders])
  })

  it('places sampler UVs with the portrait lab scale and offset on the requested camera plane', () => {
    const basis = createPortraitCameraBasis({ eye: [0, 0, 5.6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3.4 })
    const settings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, offsetX: 0.1, offsetY: -0.2 }
    const center = point(0.5, 0.5, 0.2, 0.1)
    const rightEdge = point(1, 0.5, 0.2, 0.2)
    const placed = placeLilyPortraitTargets([center, rightEdge], 1, basis, settings)
    const placedCenter = placed[0]!
    const placedRightEdge = placed[1]!

    expect(placedCenter[0]).toBeCloseTo(basis.center[0] + basis.visibleWidth * 0.1, 5)
    expect(placedCenter[1]).toBeCloseTo(basis.center[1] + basis.visibleHeight * 0.2, 5)
    expect(placedRightEdge[0]! - placedCenter[0]!).toBeCloseTo(basis.visibleHeight * settings.scale * 0.5, 5)
  })

  it('projects candidates through the moving Scene 04 camera and matches its reduced-motion pose', () => {
    const bloomSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom
    const identitySettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity
    const basisAtTime = createLilyPortraitCameraBasisAtTime({ bloomSettings, identitySettings, aspect: 4 / 3, reducedMotion: false })
    const start = basisAtTime(0)
    const middle = basisAtTime(identitySettings.cameraMoveDuration / 2)
    const end = basisAtTime(identitySettings.cameraMoveDuration)
    const pullbackMiddle = basisAtTime(identitySettings.cameraMoveDuration + 2)
    const afterEnd = basisAtTime(identitySettings.cameraMoveDuration + 5)

    expect(start.eye).not.toEqual(end.eye)
    expect(middle.eye).not.toEqual(start.eye)
    expect(Math.hypot(...pullbackMiddle.eye.map((value, index) => value - end.eye[index]!))).toBeCloseTo(0.85, 5)
    expect(Math.hypot(...afterEnd.eye.map((value, index) => value - end.eye[index]!))).toBeCloseTo(1.7, 5)
    afterEnd.forward.forEach((value, index) => expect(value).toBeCloseTo(end.forward[index]!, 6))
    expect(basisAtTime(identitySettings.cameraMoveDuration + 2).eye)
      .not.toEqual(end.eye)

    const reduced = createLilyPortraitCameraBasisAtTime({ bloomSettings, identitySettings, aspect: 4 / 3, reducedMotion: true })
    expect(reduced(0).eye).toEqual(reduced(identitySettings.cameraMoveDuration).eye)
    expect(reduced(0).eye[2]).toBeCloseTo(5.6, 5)
  })

  it('matches CameraDirector with non-default Bloom settings in moving and reduced-motion runtime', () => {
    const bloomSettings = {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom,
      cameraTargetX: -0.82,
      cameraTargetY: 1.74,
      cameraFinalHeight: 3.65,
      cameraFinalDistance: 3.15,
    }
    const identitySettings = {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity,
      cameraRise: 0.95,
      cameraPullback: 2.35,
      cameraMoveDuration: 6,
    }
    const start = getBloomCloseupPose(bloomSettings)
    const end = getIdentityCameraMoveTarget(start, identitySettings)
    const moving = createLilyPortraitCameraBasisAtTime({ bloomSettings, identitySettings, aspect: 4 / 3, reducedMotion: false })
    const expectedAt = (time: number) => {
      return cameraBasisForPose(getIdentityCameraPoseAt(start, end, time, identitySettings.cameraMoveDuration))
    }
    const runtime = createFilmRuntime()
    const movingFrames: ReturnType<typeof moving>[] = []
    const stopMoving = runtime.subscribeFrame((time) => movingFrames.push(moving(time)))
    runtime.publish(0)
    runtime.publish(3)
    runtime.publish(6)
    runtime.publish(0)
    stopMoving()
    expect(movingFrames).toEqual([expectedAt(0), expectedAt(3), expectedAt(6), expectedAt(0)])

    // CameraDirector's reduced-motion branch overwrites its initial Bloom pose
    // with `front`; non-default Bloom settings must not shift this projection.
    const reduced = createLilyPortraitCameraBasisAtTime({ bloomSettings, identitySettings, aspect: 4 / 3, reducedMotion: true })
    const front = cameraBasisForPose({ x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
    expect(start).not.toEqual(front)
    const reducedFrames: ReturnType<typeof reduced>[] = []
    const stopReduced = runtime.subscribeFrame((time) => reducedFrames.push(reduced(time)))
    runtime.publish(0)
    runtime.publish(4.2)
    runtime.publish(1.1)
    runtime.publish(0)
    stopReduced()
    expect(reducedFrames).toEqual([front, front, front, front])
  })

  it('replays particle positions on playback, backward/forward seek, and repeat using film time', () => {
    const runtime = createFilmRuntime()
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
      sample: () => [1, 0.5, 0],
      sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
    }
    const route = {
      origin: [1, 0.5, 0] as [number, number, number], part: 0, seed: 0.4,
      target: [2, 1, -1] as [number, number, number], launchTime: 4, travelDuration: 1.4,
      captureMotion: true,
    }
    const settings = {
      particleBrightness: 1, vortexRadius: 1, vortexExpansion: 0.3, swirlSpeed: 0.9, swirlAcceleration: 0.08,
      centerDissolveAt: 0.5, vortexSpeedMultiplier: 0.9, dissolveDuration: 12, edgeWidth: 0.035,
    }
    const samples = new Map<number, [number, number, number]>()
    const unsubscribe = runtime.subscribeFrame((time) => {
      samples.set(time, getLilyParticlePortraitPosition(route, time, source, settings))
    })

    runtime.publish(4.6)
    runtime.publish(8.1)
    const forwardPlayback = samples.get(4.6)!
    runtime.publish(2.3)
    runtime.publish(4.6)
    const backwardThenForwardSeek = samples.get(4.6)!
    runtime.publish(4.6)
    const repeatedFrame = samples.get(4.6)!
    unsubscribe()
    runtime.publish(4.6)

    expect(backwardThenForwardSeek).toEqual(forwardPlayback)
    expect(repeatedFrame).toEqual(forwardPlayback)
    expect(samples.size).toBe(3)
  })

  it('maps the scene capture controls and portrait appearance without dropping lab styles', () => {
    const scene = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity
    expect(toLilyPortraitCaptureSettings(scene)).toEqual({
      portraitStartProgress: 0.3,
      portraitFraction: 0.4,
      portraitMinTurns: 0,
      portraitMaxTurns: 2,
      portraitSteering: 1,
      portraitBraking: 1,
      portraitSettledBrightness: 1.15,
      vortexSpeedMultiplier: 0.9,
    })
    expect(toLilyPortraitAppearanceSettings(DEFAULT_PARTICLE_PORTRAIT_SETTINGS)).toEqual({
      photoColorMix: 0.25,
      opacity: 1,
      glow: 1.8,
      minSize: 1.2,
      maxSize: 2.8,
      minimumBrightness: 0.3,
      contrast: 1,
    })
    const uniformScales = toLilyPortraitUniformScales(DEFAULT_PARTICLE_PORTRAIT_SETTINGS, scene.particleBrightness, scene.particleSize)
    expect(scene.particleBrightness * uniformScales.brightness).toBeCloseTo(DEFAULT_PARTICLE_PORTRAIT_SETTINGS.brightness)
    expect(scene.particleSize * uniformScales.size).toBeCloseTo(1)
  })
})

function makeSource(width: number, height: number): StarPortraitSource {
  const photoRgba = new Uint8ClampedArray(width * height * 4)
  const matteRgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4
    photoRgba.set([x / width * 255, y / height * 255, (x + y) / (width + height) * 255, 255], offset)
    matteRgba.set([255, 255, 255, 255], offset)
  }
  return { width, height, photoRgba, matteRgba }
}

function point(u: number, v: number, featureWeight: number, seed: number): StarPortraitPoint {
  return { u, v, tone: 0.5, contrast: featureWeight, featureWeight, seed, photoColorLinear: [0.2, 0.3, 0.4] }
}

function cameraBasisForPose(pose: ReturnType<typeof getBloomCloseupPose>) {
  return createPortraitCameraBasis({
    eye: [pose.x, pose.y, pose.z],
    lookAt: [pose.tx, pose.ty, pose.tz],
    aspect: 4 / 3,
    fovDegrees: 38,
    planeDistance: 3.4,
  })
}
