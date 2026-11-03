import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3, type WebGLRenderer } from 'three'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import { createLilyGeometryParticleSource } from './particleSource'
import { createLilyDissolveUniforms, createLilyParticleGeometry, createLilyParticleMaterial, getLilyParticleCaptureRiseAge, getLilyParticleFade, getLilyParticleOrbitRadius, getLilyParticlePortraitAlpha, getLilyParticlePortraitSettledProgress, getLilyParticlePortraitPosition, getLilyParticleVerticalRise, getLilyParticleVortexPosition, glslFloat, LILY_FIELD, LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE, LILY_PARTICLE_CAPTURE_SLOWDOWN_DURATION, LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE, LILY_PARTICLE_FADE_START_SECONDS, LILY_PARTICLE_MAX_POINT_SIZE, LILY_PARTICLE_MAX_SIZE_ACCENT, LILY_PARTICLE_TAIL_SECONDS, LILY_PORTRAIT_MIN_FEATURE_ACCENT, LILY_PORTRAIT_MIN_TONE_CONTRAST, LILY_PORTRAIT_SETTLED_RAMP_SECONDS, LILY_VORTEX_RADIUS_CAP_OFFSET, patchLilyMaterial, updateLilyDissolve, updateLilyParticleSettings, updateLilyPortraitAppearance, updateLilyPortraitSettings } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { createPortraitCameraBasis, getPortraitHermitePosition, projectPortraitPoint } from './portraitTargets'
import { placeLilyPortraitTargets } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS, decodeApprovedPortrait } from './approvedPortrait'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'

it('samples particles from posed flower triangles with their correct dissolve phase', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  const root = new Group()
  const petal = new Mesh(geometry, new MeshBasicMaterial()); petal.name = 'Petals'; petal.position.set(2, 3, 4)
  root.add(petal)
  const source = createLilyGeometryParticleSource(root)
  const particles = createLilyParticleGeometry(source, 256)
  const positions = particles.getAttribute('position'), parts = particles.getAttribute('aPart')
  expect(positions.count).toBe(256)
  for (let i = 0; i < positions.count; i++) {
    const sample = source.sampleSurface(i, 256)
    expect(sample.part).toBe(0)
    expect(parts.getX(i)).toBe(0)
    expect(positions.getX(i)).toBeCloseTo(sample.position[0], 5)
    expect(positions.getY(i)).toBeCloseTo(sample.position[1], 5)
    expect(positions.getZ(i)).toBeCloseTo(4, 5)
    expect(sample.position[0] + sample.position[1]).toBeLessThanOrEqual(6.00001)
  }
  particles.dispose(); geometry.dispose(); (petal.material as MeshBasicMaterial).dispose()
})

it('uses the same field for surface and particles and supports deterministic backwards seeks through the slower dissolve', () => {
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)
  expect(material.vertexShader).toContain('lilyThreshold(position, aPart)')
  expect(uniforms.uLilyDuration.value).toBe(12)
  expect(uniforms.uLilyParticleBrightness.value).toBe(1.25)
  expect(uniforms.uLilyVortexRadius.value).toBe(0.8)
  expect(uniforms.uLilyVortexExpansion.value).toBe(0.45)
  expect(uniforms.uLilySwirlSpeed.value).toBe(1)
  expect(uniforms.uLilySwirlAcceleration.value).toBe(0.1)
  expect(uniforms.uLilyCenterDissolveAt.value).toBe(0.5)
  updateLilyParticleSettings(uniforms, {
    particleBrightness: 1.6, vortexRadius: 2, vortexExpansion: 0.7,
    swirlSpeed: 3, swirlAcceleration: 0.9, centerDissolveAt: 0.6,
  })
  expect(uniforms.uLilyParticleBrightness.value).toBe(1.6)
  expect(uniforms.uLilyVortexRadius.value).toBe(2)
  expect(uniforms.uLilyVortexExpansion.value).toBe(0.7)
  expect(uniforms.uLilySwirlSpeed.value).toBe(3)
  expect(uniforms.uLilySwirlAcceleration.value).toBe(0.9)
  expect(uniforms.uLilyCenterDissolveAt.value).toBe(0.6)
  updateLilyDissolve(uniforms, true, 12, 12, 0.035)
  expect(uniforms.uLilyProgress.value).toBe(1)
  updateLilyDissolve(uniforms, true, 3, 12, 0.035)
  expect(uniforms.uLilyProgress.value).toBe(0.25)
  expect(material.vertexShader).toContain('float turn = angularSpeed * age + 0.5 * uLilySwirlAcceleration * age * age')
  expect(material.vertexShader).toContain('uLilyRadius * uLilyVortexRadius * mix(0.9, 1.08, seed)')
  expect(material.vertexShader).toContain('min(0.25, verticalRise * uLilyVortexExpansion)')
  expect(material.vertexShader).toContain('uLilyRadius * (uLilyVortexRadius + riseAllowance)')
  expect(material.vertexShader).toContain('verticalRise * uLilyVortexExpansion')
  expect(material.vertexShader).toContain('pow(aSeed, 8.0)')
  expect(material.fragmentShader).toContain('uLilyParticleBrightness * brightnessAccent')
  expect(material.fragmentShader).toContain('float core = mix(softCore, portraitCore, vPortraitMix)')
  expect(material.fragmentShader).toContain('float haloScale = mix(1.0, 0.55, vPortraitMix)')
  expect(material.fragmentShader).toContain('float toneContrast = mix(0.95, 1.15, smoothstep(0.16, 0.82, portraitTone))')
  expect(material.vertexShader).toContain('vPortraitContrast = clamp(aPortraitMotion.w - 1.0, 0.0, 1.0)')
  expect(material.vertexShader).toContain('float featureSize = mix(0.92, 1.7, smoothstep(0.1, 0.48, vPortraitContrast))')
  expect(material.vertexShader).toContain('float portraitSize = mix(1.0, uLilyPortraitSize * featureSize * targetSeedSize, portraitMix)')
  expect(material.vertexShader).toContain('uLilySize * sizeAccent * portraitSize * uLilyDpr')
  expect(material.vertexShader).toMatch(/bool portraitLanded = .*;[\s\S]*?if \(travel >= 1\.0\) \{\s*p = aPortraitTarget\.xyz;/)
  const travelBranch = material.vertexShader.slice(material.vertexShader.indexOf('if (travel >= 1.0)'), material.vertexShader.indexOf('float stage ='))
  expect(travelBranch).toContain('lilyVortexPosition(position, aPart, aSeed, departureAge, aPortraitSeedData.z)')
  expect(travelBranch).toContain('lilyVortexPosition(position, aPart, aSeed, beforeAge, aPortraitSeedData.z)')
  expect(travelBranch).toContain('lilyVortexPosition(position, aPart, aSeed, afterAge, aPortraitSeedData.z)')
  expect(material.fragmentShader).toContain('float featureAccent = mix(1.0, 1.8, smoothstep(0.1, 0.48, vPortraitContrast))')
  expect(1.1 * LILY_PORTRAIT_MIN_TONE_CONTRAST * LILY_PORTRAIT_MIN_FEATURE_ACCENT).toBeGreaterThan(1)
  expect(material.fragmentShader).toContain('portraitBrightness * sourceContrast')
  expect(LILY_FIELD).toContain('mix(petalStart, petalEnd, uLilyCenterDissolveAt) + radial * 0.18')
  expect(material.vertexShader).toContain('verticalRise * detach')
  expect(material.vertexShader).toContain('float fadeAge = aPortraitSeedData.z > 0.5 ? min(age, 7.0) : age')
  expect(material.vertexShader).toContain('float fade = 1.0 - smoothstep(7.0, 10.5, fadeAge)')
  expect(material.vertexShader).toContain('uLilySwirlSpeed * uLilyVortexSpeedMultiplier * mix(0.95, 1.05, seed)')
  expect(material.vertexShader).toContain('float depthWobble = 1.0 + 0.025 * sin')
  expect(material.vertexShader).toContain('float sizeAccent = mix(0.82, 1.08, pow(aSeed, 8.0))')
  expect(material.vertexShader).toContain('float pointMinSize = mix(1.0, uLilyPortraitPointMinSize, portraitMix)')
  expect(material.vertexShader).toContain('float pointMaxSize = mix(6.0, uLilyPortraitPointMaxSize, portraitMix)')
  expect(material.vertexShader).toContain('gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize)')
  expect(material.vertexShader).toContain('age / 10.5')
  expect(material.fragmentShader).toContain('mix(0.52, 1.5, pow(vSeed, 8.0))')
  expect(material.fragmentShader).toContain('gl_FragColor = vec4(color, min(0.9, glow * 0.58) * opacity)')
  expect(material.fragmentShader).not.toContain('color * min(1.7, uLilyParticleBrightness')
  expect(LILY_PARTICLE_FADE_START_SECONDS).toBe(7)
  expect(LILY_PARTICLE_TAIL_SECONDS).toBe(10.5)
  expect(LILY_PARTICLE_MAX_POINT_SIZE).toBe(6)
  expect(LILY_PARTICLE_MAX_SIZE_ACCENT).toBe(1.08)
  expect(LILY_VORTEX_RADIUS_CAP_OFFSET).toBe(0.25)
  expect(glslFloat(13)).toBe('13.0')
  expect(glslFloat(8.5)).toBe('8.5')
  updateLilyDissolve(uniforms, false, 3, 12, 0.035)
  expect(uniforms.uLilyActive.value).toBe(0)
  expect(uniforms.uLilyProgress.value).toBe(0)
  material.dispose()
})

it('keeps shared portrait appearance neutral by default and clamps optional appearance controls', () => {
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)

  expect(uniforms.uLilyPortraitPhotoColorMix.value).toBe(0)
  expect(uniforms.uLilyPortraitOpacity.value).toBe(1)
  expect(uniforms.uLilyPortraitGlow.value).toBe(1)
  expect(uniforms.uLilyPortraitMinimumBrightness.value).toBe(0)
  expect(uniforms.uLilyPortraitContrast.value).toBe(1)
  expect(uniforms.uLilyPortraitPointMinSize.value).toBe(1)
  expect(uniforms.uLilyPortraitPointMaxSize.value).toBe(6)
  expect(material.vertexShader).toContain('attribute vec3 aPortraitSourceColor')
  expect(material.fragmentShader).toContain('uLilyPortraitPhotoColorMix')
  expect(material.fragmentShader).toContain('uLilyPortraitOpacity')
  expect(material.fragmentShader).toContain('uLilyPortraitGlow')
  expect(material.fragmentShader).toContain('float portraitTone = clamp(0.5 + (vPortraitTone - 0.5) * uLilyPortraitContrast, uLilyPortraitMinimumBrightness, 1.0)')
  expect(material.fragmentShader).toContain('clamp(uLilyPortraitPhotoColorMix, 0.0, 1.0) * vPortraitMix')
  expect(material.fragmentShader).toContain('mix(1.0, uLilyPortraitGlow, vPortraitMix)')
  expect(material.fragmentShader).toContain('float opacity = mix(1.0, uLilyPortraitOpacity, vPortraitMix)')

  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
    sample: () => [0, 0, 0],
    sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
  }
  const geometry = createLilyParticleGeometry(source, 2)
  expect(Array.from(geometry.getAttribute('aPortraitSourceColor').array)).toEqual([1, 1, 1, 1, 1, 1])

  updateLilyPortraitAppearance(uniforms, {
    photoColorMix: 0.65, opacity: 0.75, glow: 1.5, minSize: 0.8, maxSize: 2.2, minimumBrightness: 0.42, contrast: 1.35,
  })
  expect(uniforms.uLilyPortraitPhotoColorMix.value).toBe(0.65)
  expect(uniforms.uLilyPortraitOpacity.value).toBe(0.75)
  expect(uniforms.uLilyPortraitGlow.value).toBe(1.5)
  expect(uniforms.uLilyPortraitMinimumBrightness.value).toBe(0.42)
  expect(uniforms.uLilyPortraitContrast.value).toBe(1.35)
  expect(uniforms.uLilyPortraitPointMinSize.value).toBe(0.8)
  expect(uniforms.uLilyPortraitPointMaxSize.value).toBe(2.2)

  updateLilyPortraitAppearance(uniforms, {
    photoColorMix: -1, opacity: 3, glow: Number.NaN, minSize: 2, maxSize: 0.2,
    minimumBrightness: 3, contrast: 0,
  })
  expect(uniforms.uLilyPortraitPhotoColorMix.value).toBe(0)
  expect(uniforms.uLilyPortraitOpacity.value).toBe(1)
  expect(uniforms.uLilyPortraitGlow.value).toBe(1)
  expect(uniforms.uLilyPortraitMinimumBrightness.value).toBe(0.7)
  expect(uniforms.uLilyPortraitContrast.value).toBe(0.5)
  expect(uniforms.uLilyPortraitPointMinSize.value).toBeLessThanOrEqual(uniforms.uLilyPortraitPointMaxSize.value)
  geometry.dispose()
  material.dispose()
})

it('keeps dark photo-derived portrait details visible within bounded emission', () => {
  const material = createLilyParticleMaterial(createLilyDissolveUniforms())

  expect(material.fragmentShader).toContain('float toneContrast = mix(0.95, 1.15, smoothstep(0.16, 0.82, portraitTone))')
  expect(material.fragmentShader).toContain('gl_FragColor = vec4(color, min(0.9, glow * 0.58) * opacity)')
  material.dispose()
})

it('raises the spiral above the petals with a bounded, monotonic rise curve', () => {
  expect(getLilyParticleVerticalRise(0, 0)).toBe(0)
  const lowRise = getLilyParticleVerticalRise(6, 0)
  const highRise = getLilyParticleVerticalRise(6, 1)
  expect(lowRise).toBeCloseTo(3.78, 5)
  expect(highRise).toBeGreaterThan(lowRise)
  expect(highRise).toBeCloseTo(3.96, 5)
  expect(getLilyParticleVerticalRise(8, 1)).toBe(5.2)
  expect(getLilyParticleVerticalRise(12, 1)).toBe(5.2)
  expect(getLilyParticleVerticalRise(20, 1)).toBe(5.2)
})

it('slows only capture-marked rise with C1 boundaries and holds its visible fade', () => {
  const start = LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE
  const end = start + LILY_PARTICLE_CAPTURE_SLOWDOWN_DURATION
  const delta = 0.0001
  const startLeftSpeed = (getLilyParticleCaptureRiseAge(start) - getLilyParticleCaptureRiseAge(start - delta)) / delta
  const startRightSpeed = (getLilyParticleCaptureRiseAge(start + delta) - getLilyParticleCaptureRiseAge(start)) / delta
  const endLeftSpeed = (getLilyParticleCaptureRiseAge(end) - getLilyParticleCaptureRiseAge(end - delta)) / delta
  const endRightSpeed = (getLilyParticleCaptureRiseAge(end + delta) - getLilyParticleCaptureRiseAge(end)) / delta

  expect(startLeftSpeed).toBeCloseTo(1, 3)
  expect(startRightSpeed).toBeCloseTo(1, 3)
  expect(endLeftSpeed).toBeCloseTo(LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE, 3)
  expect(endRightSpeed).toBeCloseTo(LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE, 3)
  expect(getLilyParticleCaptureRiseAge(end + 1)).toBeGreaterThan(getLilyParticleCaptureRiseAge(end))
  expect(getLilyParticleVerticalRise(getLilyParticleCaptureRiseAge(end + 1), 0.4))
    .toBeGreaterThan(getLilyParticleVerticalRise(getLilyParticleCaptureRiseAge(end), 0.4))
  expect(getLilyParticleFade(8, true)).toBe(1)
  expect(getLilyParticleFade(12, true)).toBe(1)
  expect(getLilyParticleFade(12, false)).toBe(0)
})

it('keeps source-to-portrait alpha continuous through the ShaderMaterial path', () => {
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)
  const duration = 1.2
  const reveal = 0.62
  const alpha = (age: number, elapsed: number, captureMotion: boolean) =>
    getLilyParticlePortraitAlpha(age, elapsed, duration, reveal, captureMotion)
  const beforeCapture = alpha(11.999, -0.001, true)
  const atCapture = alpha(12, 0, true)
  const afterCapture = alpha(12.001, 0.001, true)
  const beforeRelease = alpha(13.199, duration - 0.001, true)
  const atRelease = alpha(13.2, duration, true)
  const afterRelease = alpha(13.201, duration + 0.001, true)
  const arrivalTime = duration
  const settledAtArrival = getLilyParticlePortraitSettledProgress(arrivalTime, arrivalTime, true)
  const settledAfterArrival = getLilyParticlePortraitSettledProgress(arrivalTime + 0.001, arrivalTime, true)
  const settledAfterRamp = getLilyParticlePortraitSettledProgress(arrivalTime + LILY_PORTRAIT_SETTLED_RAMP_SECONDS, arrivalTime, true)
  const legacySettled = getLilyParticlePortraitSettledProgress(arrivalTime + 1, arrivalTime, false)
  const fragmentAlpha = (vertexAlpha: number, settled: number) => Math.min(0.9, vertexAlpha * (1 + 0.15 * settled) * 0.58)

  expect(beforeCapture).toBeCloseTo(atCapture, 3)
  expect(afterCapture).toBeCloseTo(atCapture, 3)
  expect(beforeRelease).toBeCloseTo(reveal, 3)
  expect(atRelease).toBe(reveal)
  expect(afterRelease).toBe(reveal)
  expect(settledAtArrival).toBe(0)
  expect(settledAfterArrival).toBeGreaterThan(0)
  expect(settledAfterRamp).toBe(1)
  expect(legacySettled).toBe(0)
  expect(Math.abs(fragmentAlpha(atRelease, settledAfterArrival) - fragmentAlpha(atRelease, settledAtArrival))).toBeLessThan(0.00001)
  expect(alpha(12, 0, false)).toBe(0)
  expect(material.vertexShader).toContain('float baseAlpha = birth * fade')
  expect(material.vertexShader).toContain('vAlpha = mix(baseAlpha, portraitReveal, portraitMix)')
  expect(material.vertexShader).toContain('float settledElapsed = max(0.0, uLilySceneTime - aPortraitMotion.x - travelDuration)')
  expect(material.vertexShader).toContain('portraitSettled = smoothstep(0.0, 0.35, settledElapsed)')
  expect(material.vertexShader).toContain('vPortraitSettled = aPortraitRoute > 0.5 ? portraitSettled : 0.0')
  expect(material.fragmentShader).toContain('* vAlpha *')
  expect(material.fragmentShader).toContain('float settledBrightness = mix(1.0, uLilyPortraitSettledBrightness, vPortraitSettled)')
  expect(material.fragmentShader).toContain('* sourceContrast * settledBrightness *')
  expect(material.fragmentShader).toContain('gl_FragColor = vec4(color, min(0.9, glow * 0.58) * opacity)')
  material.dispose()
})

it('caps vortex spread while keeping radius and vertical expansion controls effective', () => {
  expect(getLilyParticleOrbitRadius(0.5, 2.4, 2, 0.45, 1, 1, 1.5)).toBeCloseTo(1.75)
  expect(getLilyParticleOrbitRadius(0.5, 4.8, 2, 0.45, 1, 1, 3)).toBeCloseTo(3.25)
  expect(getLilyParticleOrbitRadius(0.5, 2, 0, 0.8, 1, 1, 1.5)).toBeCloseTo(1.5)
  expect(getLilyParticleOrbitRadius(1.2, 0.8, 0, 0.45, 0, 1, 0.8)).toBeCloseTo(1.2)
  const tight = getLilyParticleOrbitRadius(0.5, 1, 0.6, 0.2, 1, 1, 1.5)
  const expanded = getLilyParticleOrbitRadius(0.5, 1, 0.6, 0.8, 1, 1, 1.5)
  expect(expanded).toBeGreaterThan(tight)
  expect(expanded).toBeLessThan(1.75)
})

it('projects positive XZ swirl clockwise in the elevated camera view', () => {
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes
  const start = getBloomCloseupPose(settings.bloom)
  const end = getIdentityCameraMoveTarget(start, settings.identity)
  const camera = new PerspectiveCamera(38, 4 / 3, 0.1, 100)
  camera.position.set(end.x, end.y, end.z)
  camera.lookAt(end.tx, end.ty, end.tz)

  const center = new Vector3(start.tx, start.ty, start.tz)
  const material = createLilyParticleMaterial(createLilyDissolveUniforms())
  const radius = 0.5, angle = 0.15
  const atRight = center.clone().add(new Vector3(radius, 0, 0)).project(camera)
  const afterPositiveTurn = center.clone().add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)).project(camera)

  // With +X at screen-right, a clockwise turn moves the point down the image.
  expect(atRight.x).toBeGreaterThan(0)
  expect(afterPositiveTurn.y).toBeLessThan(atRight.y)
  expect(material.vertexShader).toContain('float angle = startAngle + turn * detach')
  expect(material.vertexShader).toContain('float turn = angularSpeed * age + 0.5 * uLilySwirlAcceleration * age * age')
  expect(material.vertexShader).toContain('float radiusCap = max(sourceRadius, uLilyRadius * (uLilyVortexRadius + riseAllowance))')
  material.dispose()
})

it('adds the common dissolve threshold to the original GLB material after morph transforms', () => {
  const material = new MeshStandardMaterial()
  const uniforms = createLilyDissolveUniforms()
  patchLilyMaterial(material, 0, uniforms)
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <alphatest_fragment>\n#include <emissivemap_fragment>' }
  material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as WebGLRenderer)
  expect(shader.vertexShader).toContain('modelMatrix * vec4(transformed, 1.0)')
  expect(shader.fragmentShader).toContain('lilyThreshold(vLilyWorld, uLilyPart)')
  expect(shader.uniforms).toHaveProperty('uLilyProgress', uniforms.uLilyProgress)
  expect(material.customProgramCacheKey()).toBe('lily-dissolve-v1-0')
  material.dispose()
})

it('adds deterministic portrait routes to the same point geometry and scrubs their clock absolutely', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
    sample: (index) => [0.4 + index * 0.01, 0, 0],
    sampleSurface: (index) => ({ position: [0.4 + index * 0.01, 0, 0], part: 0 }),
  }
  const targets = [
    { uv: [0.2, 0.3] as [number, number], stage: 0, tone: 0.2, contrast: 0.15, seed: 0.1 },
    { uv: [0.5, 0.5] as [number, number], stage: 1, tone: 0.5, contrast: 0.5, seed: 0.2 },
    { uv: [0.8, 0.7] as [number, number], stage: 3, tone: 0.8, contrast: 0.9, seed: 0.3 },
  ]
  const options = {
    targets,
    targetPositions: [[-1, 0, 0], [0, 1, 0], [1, 0, 0]] as [number, number, number][],
    fraction: 0.3, start: 12, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasis: createPortraitCameraBasis({ eye: [0, 0, 6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 }),
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 1, swirlAcceleration: 0.1, centerDissolveAt: 0.5 },
  }
  const first = createLilyParticleGeometry(source, 10, options)
  const replay = createLilyParticleGeometry(source, 10, options)
  const fallback = createLilyParticleGeometry(source, 10)
  const motion = first.getAttribute('aPortraitMotion'), target = first.getAttribute('aPortraitTarget')
  const routed: number[] = []
  for (let index = 0; index < motion.count; index++) if (motion.getW(index) > 0.5) routed.push(index)
  expect(routed).toHaveLength(3)
  expect(Array.from(motion.array)).toEqual(Array.from(replay.getAttribute('aPortraitMotion').array))
  expect(Array.from(target.array)).toEqual(Array.from(replay.getAttribute('aPortraitTarget').array))
  expect(Array.from(first.getAttribute('aPortraitRoute').array).every((route) => route === 0)).toBe(true)
  expect(new Set(routed.map((index) => target.getW(index)))).toEqual(new Set([0, 1, 3]))
  const contrastMarkers = routed.map((index) => motion.getW(index)).sort((a, b) => a - b)
  expect(contrastMarkers[0]).toBeCloseTo(1.15)
  expect(contrastMarkers[1]).toBeCloseTo(1.5)
  expect(contrastMarkers[2]).toBeCloseTo(1.9)
  const assignedPositions = routed.map((index) => [target.getX(index), target.getY(index), target.getZ(index)] as [number, number, number])
  const sortPositions = (positions: [number, number, number][]) => positions.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  expect(sortPositions(assignedPositions)).toEqual(sortPositions(options.targetPositions.slice()))
  for (let targetIndex = 0; targetIndex < options.targetPositions.length; targetIndex++) {
    const expectedPosition = options.targetPositions[targetIndex]!
    const assignedIndex = routed.find((index) => target.getX(index) === expectedPosition[0]
      && target.getY(index) === expectedPosition[1] && target.getZ(index) === expectedPosition[2])!
    expect(target.getW(assignedIndex)).toBe(targets[targetIndex]!.stage)
  }
  expect(Array.from(fallback.getAttribute('aPortraitMotion').array).filter((_, index) => index % 4 === 3).every((route) => route === 0)).toBe(true)

  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)
  updateLilyPortraitSettings(uniforms, 20.5, { portraitStart: 12, portraitDuration: 8.5, portraitBrightness: 1.25, portraitSize: 1 })
  expect(uniforms.uLilySceneTime.value).toBe(20.5)
  updateLilyPortraitSettings(uniforms, 12, { portraitStart: 12, portraitDuration: 8.5, portraitBrightness: 1.25, portraitSize: 1 })
  expect(uniforms.uLilySceneTime.value).toBe(12)
  expect(material.vertexShader).toContain('lilyPortraitHermite')
  expect(material.vertexShader).toContain('uLilySceneTime')
  expect(material.vertexShader).toContain('aPortraitTarget')
  material.dispose(); first.dispose(); replay.dispose(); fallback.dispose()
})

it('uses the shared vortex GLSL helper for the original particle path', () => {
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)
  const main = material.vertexShader.slice(material.vertexShader.indexOf('void main()'))

  expect(uniforms.uLilyPortraitBrightness.value).toBe(1.8)
  expect(uniforms.uLilyPortraitSize.value).toBe(1.8)
  expect(main).toContain('vec3 p = portraitLanded ? aPortraitTarget.xyz : lilyVortexPosition(position, aPart, aSeed, age, aPortraitSeedData.z);')
  expect(main).not.toContain('float detach = smoothstep(0.08, 0.72, age);')
  material.dispose()
})

it('applies one effective vortex speed multiplier in the CPU path and shader uniform', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: () => [1, 0.5, 0], sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
  }
  const settings = {
    particleBrightness: 1, vortexRadius: 1, vortexExpansion: 0,
    swirlSpeed: 1, swirlAcceleration: 0, centerDissolveAt: 0.5,
    dissolveDuration: 12, edgeWidth: 0.035,
  }
  const normalSpeed = getLilyParticleVortexPosition([1, 0.5, 0], 0, 0.4, 2, source, settings)
  const slowedSpeed = getLilyParticleVortexPosition([1, 0.5, 0], 0, 0.4, 2, source, { ...settings, vortexSpeedMultiplier: 0.5 })
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)

  expect(normalSpeed[2]).not.toBeCloseTo(slowedSpeed[2], 3)
  expect(uniforms.uLilyVortexSpeedMultiplier.value).toBe(1)
  expect(material.vertexShader).toContain('uLilySwirlSpeed * uLilyVortexSpeedMultiplier')
  expect(material.vertexShader).toContain('float riseAge = captureMotion > 0.5 ? lilyCaptureRiseAge(age) : age')
  expect(material.vertexShader).toContain('aPortraitSeedData.z > 0.5 ? min(age, 7.0) : age')
  material.dispose()
})

it('captures unique detached particles that are visible at their time-specific camera basis', () => {
  const particlePositions: Array<[number, number, number]> = [
    [1, 0.5, 0], [100, 0.5, 0], [1, 0.5, 0], [1, 0.5, 0],
    [1, 0.5, 0], [1, 0.5, 0], [1, 0.5, 0], [1, 0.5, 0],
  ]
  const particleParts = [0, 0, 2, 0, 0, 0, 0, 0]
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: (index) => particlePositions[index]!,
    sampleSurface: (index) => ({ position: particlePositions[index]!, part: particleParts[index]! }),
  }
  const targets = [
    { u: 0.5, v: 0.5, tone: 0.4, contrast: 0.7, featureWeight: 0.8, seed: 0.25, photoColorLinear: [0.2, 0.4, 0.6] as const },
    { u: 0.6, v: 0.4, tone: 0.7, contrast: 0.5, featureWeight: 0.3, seed: 0.75, photoColorLinear: [0.8, 0.5, 0.25] as const },
  ]
  const basis = createPortraitCameraBasis({ eye: [0, 0, 6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const cameraTimes: number[] = []
  const options = {
    targets,
    targetPositions: [[1, 2.25, 0], [1, 2.55, 0]] as [number, number, number][],
    fraction: 0.4, start: 2, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasis: basis,
    cameraBasisAtTime: (time: number) => { cameraTimes.push(time); return basis },
    capture: {
      portraitStartProgress: 0.3, portraitFraction: 0.4, portraitMinTurns: 0, portraitMaxTurns: 0,
      portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9,
    },
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 0, swirlAcceleration: 0, centerDissolveAt: 0.5 },
  } as unknown as NonNullable<Parameters<typeof createLilyParticleGeometry>[2]>
  const geometry = createLilyParticleGeometry(source, particlePositions.length, options)
  const motion = geometry.getAttribute('aPortraitMotion')
  const colors = geometry.getAttribute('aPortraitSourceColor')
  const selected: number[] = []
  for (let index = 0; index < motion.count; index++) if (motion.getW(index) > 0.5) selected.push(index)

  expect(selected.length).toBeGreaterThan(0)
  expect(selected.length).toBeLessThanOrEqual(2)
  expect(new Set(selected).size).toBe(selected.length)
  expect(selected.every((index) => ![1, 2].includes(index))).toBe(true)
  expect(selected.every((index) => motion.getX(index) >= 3.6)).toBe(true)
  expect(selected.every((index) => cameraTimes.some((time) => Math.abs(time - motion.getX(index)!) < 1e-5))).toBe(true)
  const selectedColors = selected.map((index) => [colors.getX(index), colors.getY(index), colors.getZ(index)])
    .sort((a, b) => a[0]! - b[0]!)
  expect(selectedColors.every((color) => [
    [0.2, 0.4, 0.6], [0.8, 0.5, 0.25],
  ].some((expected) => expected.every((channel, index) => Math.abs(channel - color[index]!) < 1e-6)))).toBe(true)
  expect(new Set(selected.map((index) => geometry.getAttribute('aPortraitSeedData').getX(index))).size).toBe(selected.length)
  expect(selected.every((index) => geometry.getAttribute('aPortraitRoute').getX(index) === 1)).toBe(true)
  expect(geometry.getAttribute('position').count).toBe(particlePositions.length)
  geometry.dispose()
})

it('assigns a limited number of visible routes across the whole portrait and keeps authored appearance', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: (index) => [1, index / 79, 0],
    sampleSurface: (index) => ({ position: [1, index / 79, 0], part: 0 }),
  }
  const targets = Array.from({ length: 1000 }, (_, index) => ({
    u: 0.5, v: index / 1000, tone: 0.5, contrast: 0.3, featureWeight: 0.4,
    seed: 0.25, photoColorLinear: [0.2, 0.4, 0.6] as const, artSize: 0.75, artBrightness: 0.45,
  }))
  const basis = createPortraitCameraBasis({ eye: [0, 0, 6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const options = {
    targets, targetPositions: targets.map((target) => [0.8, target.v, 0] as [number, number, number]),
    start: 2, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035, cameraBasisAtTime: () => basis,
    capture: { portraitStartProgress: 0, portraitFraction: 0.4, portraitMinTurns: 0, portraitMaxTurns: 0,
      portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9 },
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 0, swirlAcceleration: 0, centerDissolveAt: 0.5 },
  } as unknown as NonNullable<Parameters<typeof createLilyParticleGeometry>[2]>
  const geometry = createLilyParticleGeometry(source, 80, options)
  const route = geometry.getAttribute('aPortraitRoute'), target = geometry.getAttribute('aPortraitTarget')
  const selected = Array.from({ length: route.count }, (_, index) => index).filter((index) => route.getX(index) > 0.5)
  expect(selected.length).toBeGreaterThan(0)
  expect(selected.length).toBeLessThanOrEqual(32)
  expect(Math.min(...selected.map((index) => target.getY(index)))).toBeLessThan(0.3)
  expect(Math.max(...selected.map((index) => target.getY(index)))).toBeGreaterThan(0.8)
  expect(selected.every((index) => Math.abs(geometry.getAttribute('aArtSize').getX(index) - 0.75) < 1e-5)).toBe(true)
  expect(selected.every((index) => Math.abs(geometry.getAttribute('aArtBrightness').getX(index) - 0.45) < 1e-5)).toBe(true)
  geometry.dispose()
})

it('assigns unique nearby portrait stops measured from each particle vortex position', () => {
  const source: LilySurfaceSource = {
    center: [0, 0.5, 0], radius: 1, minY: 0, maxY: 1,
    sample: (index) => sampleRoute(index),
    sampleSurface: (index) => ({ position: sampleRoute(index), part: 0 }),
  }
  function sampleRoute(index: number): [number, number, number] {
    const angle = index * 2.399963229728653
    const radius = 0.28 + (index % 7) * 0.035
    return [Math.cos(angle) * radius, 0.38 + (index % 5) * 0.055, Math.sin(angle) * radius]
  }
  const targets = Array.from({ length: 48 }, (_, index) => ({
    u: (index % 8) / 8, v: Math.floor(index / 8) / 6, tone: 0.5, contrast: 0.4,
    featureWeight: 0.5, seed: (index + 0.5) / 48, photoColorLinear: [0.2, 0.4, 0.6] as const,
  }))
  const targetPositions = targets.map((_, index) => [
    (((index * 19) % 48) / 47 - 0.5) * 1.7,
    (((index * 13) % 48) / 47 - 0.5) * 1.3 + 0.45,
    (((index * 7) % 48) / 47 - 0.5) * 0.15,
  ] as [number, number, number])
  const basis = createPortraitCameraBasis({ eye: [0, 0.5, 6], lookAt: [0, 0.5, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const capture = {
    portraitStartProgress: 0.5, portraitFraction: 0.4, portraitMinTurns: 0, portraitMaxTurns: 0,
    portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9,
  }
  const settings = {
    particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45,
    swirlSpeed: 0, swirlAcceleration: 0, centerDissolveAt: 0.5,
  }
  const options = {
    targets, targetPositions, start: 12, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasisAtTime: () => basis, capture, settings,
  }
  const geometry = createLilyParticleGeometry(source, 48, options)
  const routeAttribute = geometry.getAttribute('aPortraitRoute')
  const motion = geometry.getAttribute('aPortraitMotion')
  const assignedTargets = geometry.getAttribute('aPortraitTarget')
  const seedData = geometry.getAttribute('aPortraitSeedData')
  const positions = geometry.getAttribute('position')
  const parts = geometry.getAttribute('aPart')
  const seeds = geometry.getAttribute('aSeed')
  const routed = Array.from({ length: routeAttribute.count }, (_, index) => index)
    .filter((index) => routeAttribute.getX(index) > 0.5)
    .sort((a, b) => motion.getX(a) - motion.getX(b) || a - b)
  const assignedTargetIndices = new Set<number>()
  expect(routed.length).toBeGreaterThan(0)
  for (const particleIndex of routed) {
    const origin: [number, number, number] = [positions.getX(particleIndex), positions.getY(particleIndex), positions.getZ(particleIndex)]
    const departure = getLilyParticleVortexPosition(origin, parts.getX(particleIndex), seeds.getX(particleIndex),
      motion.getX(particleIndex), source, { ...settings, vortexSpeedMultiplier: capture.vortexSpeedMultiplier, dissolveDuration: 12, edgeWidth: 0.035 }, seedData.getZ(particleIndex) > 0.5)
    const assignedSeed = seedData.getX(particleIndex)
    const assignedIndex = targets.findIndex((target) => Math.abs(target.seed - assignedSeed) < 1e-6)
    expect(assignedIndex).toBeGreaterThanOrEqual(0)
    expect(assignedTargetIndices.has(assignedIndex)).toBe(false)
    assignedTargetIndices.add(assignedIndex)
    const projectedDeparture = projectPortraitPoint(departure, basis)
    const projectedTarget = projectPortraitPoint(targetPositions[assignedIndex]!, basis)
    expect(Math.hypot(projectedDeparture.x - projectedTarget.x, projectedDeparture.y - projectedTarget.y)).toBeLessThanOrEqual(0.38)
    expect(assignedTargets.getW(particleIndex)).toBeGreaterThanOrEqual(0)
    expect(assignedTargets.getW(particleIndex)).toBeLessThanOrEqual(3)
  }
  geometry.dispose()
})

it('leaves a vortex particle in orbit when its portrait stop is too far away', () => {
  const source: LilySurfaceSource = {
    center: [0, 0.5, 0], radius: 1, minY: 0, maxY: 1,
    sample: () => [1, 0.5, 0], sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
  }
  const target = { u: 0.5, v: 0.5, tone: 0.5, contrast: 0.4, featureWeight: 0.5,
    seed: 0.5, photoColorLinear: [0.2, 0.4, 0.6] as const }
  const basis = createPortraitCameraBasis({ eye: [0, 0.5, 6], lookAt: [0, 0.5, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const geometry = createLilyParticleGeometry(source, 32, {
    targets: [target], targetPositions: [[0, -1, 0]], start: 2, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasisAtTime: () => basis,
    capture: { portraitStartProgress: 0.3, portraitFraction: 0.4, portraitMinTurns: 0, portraitMaxTurns: 0,
      portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9 },
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 0, swirlAcceleration: 0, centerDissolveAt: 0.5 },
  })
  const route = geometry.getAttribute('aPortraitRoute')

  expect(Array.from(route.array).some((value) => value > 0.5)).toBe(false)
  geometry.dispose()
})

it('does not assign positive-turn routes when swirl speed and acceleration are both zero', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: () => [1, 0.5, 0], sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
  }
  const targets = Array.from({ length: 4 }, (_, index) => ({
    u: 0.4 + index * 0.05, v: 0.45 + index * 0.03, tone: 0.5, contrast: 0.5,
    featureWeight: 0.5, seed: index / 4, photoColorLinear: [0.2, 0.4, 0.6] as const,
  }))
  const basis = createPortraitCameraBasis({ eye: [0, 0, 6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const options = {
    targets, targetPositions: [[0, 0, 0], [0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0]] as [number, number, number][],
    start: 2, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasisAtTime: () => basis,
    capture: {
      portraitStartProgress: 0.3, portraitFraction: 0.4, portraitMinTurns: 1, portraitMaxTurns: 2,
      portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9,
    },
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 0, swirlAcceleration: 0, centerDissolveAt: 0.5 },
  } as unknown as NonNullable<Parameters<typeof createLilyParticleGeometry>[2]>
  const geometry = createLilyParticleGeometry(source, 64, options)
  const motion = geometry.getAttribute('aPortraitMotion')

  expect(Array.from(motion.array).every((value) => value === 0)).toBe(true)
  geometry.dispose()
})

it('does not assign positive turns when nonzero angular speed cannot reach the requested phase', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: () => [1, 0.5, 0], sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
  }
  const targets = Array.from({ length: 4 }, (_, index) => ({
    u: 0.4 + index * 0.05, v: 0.45 + index * 0.03, tone: 0.5, contrast: 0.5,
    featureWeight: 0.5, seed: index / 4, photoColorLinear: [0.2, 0.4, 0.6] as const,
  }))
  const basis = createPortraitCameraBasis({ eye: [0, 5.3, 6], lookAt: [0, 5.3, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3 })
  const options = {
    targets, targetPositions: [[0, 0, 0], [0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0]] as [number, number, number][],
    start: 2, duration: 8.5, dissolveDuration: 12, edgeWidth: 0.035,
    cameraBasisAtTime: () => basis,
    capture: {
      portraitStartProgress: 0.3, portraitFraction: 0.4, portraitMinTurns: 1, portraitMaxTurns: 2,
      portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9,
    },
    settings: { particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45, swirlSpeed: 0.001, swirlAcceleration: 0, centerDissolveAt: 0.5 },
  } as unknown as NonNullable<Parameters<typeof createLilyParticleGeometry>[2]>
  const geometry = createLilyParticleGeometry(source, 64, options)
  const motion = geometry.getAttribute('aPortraitMotion')

  expect(Array.from(motion.array).every((value) => value === 0)).toBe(true)
  geometry.dispose()
})

it('keeps position and velocity continuous at capture and settles deterministically at the target', () => {
  const source: LilySurfaceSource = {
    center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
    sample: () => [1, 0.5, 0], sampleSurface: () => ({ position: [1, 0.5, 0], part: 0 }),
  }
  const settings = {
    particleBrightness: 1, vortexRadius: 1, vortexExpansion: 0.3,
    swirlSpeed: 0.9, swirlAcceleration: 0.08, centerDissolveAt: 0.5,
    vortexSpeedMultiplier: 0.9, dissolveDuration: 12, edgeWidth: 0.035,
  }
  const route = {
    origin: [1, 0.5, 0] as [number, number, number], part: 0, seed: 0.4,
    target: [2, 1, -1] as [number, number, number], launchTime: 4, travelDuration: 1.7, captureMotion: true,
  }
  const controls = { portraitSteering: 1.25, portraitBraking: 1.3 }
  const delta = 0.001
  const beforeLaunch = getLilyParticlePortraitPosition(route, route.launchTime - delta, source, settings, controls)
  const atLaunch = getLilyParticlePortraitPosition(route, route.launchTime, source, settings, controls)
  const afterLaunch = getLilyParticlePortraitPosition(route, route.launchTime + delta, source, settings, controls)
  const expectedLaunch = getLilyParticleVortexPosition(route.origin, route.part, route.seed, route.launchTime, source, settings, route.captureMotion)
  const leftVelocity = beforeLaunch.map((value, axis) => (atLaunch[axis]! - value) / delta)
  const rightVelocity = afterLaunch.map((value, axis) => (value - atLaunch[axis]!) / delta)
  const landingTime = route.launchTime + route.travelDuration * controls.portraitBraking
  const beforeLanding = getLilyParticlePortraitPosition(route, landingTime - delta, source, settings, controls)
  const landed = getLilyParticlePortraitPosition(route, landingTime, source, settings, controls)
  const afterLanding = getLilyParticlePortraitPosition(route, landingTime + delta, source, settings, controls)
  const repeatedSeek = getLilyParticlePortraitPosition(route, 4.7, source, settings, controls)
  getLilyParticlePortraitPosition(route, 9.2, source, settings, controls)

  expect(atLaunch).toEqual(expectedLaunch)
  expect(Math.max(...leftVelocity.map((value, axis) => Math.abs(value - rightVelocity[axis]!)))).toBeLessThan(0.06)
  expect(landed).toEqual(route.target)
  expect(Math.max(...beforeLanding.map((value, axis) => Math.abs((landed[axis]! - value) / delta)))).toBeLessThan(0.06)
  expect(afterLanding).toEqual(route.target)
  expect(getLilyParticlePortraitPosition(route, 4.7, source, settings, controls)).toEqual(repeatedSeek)
})

it('benchmarks the full default capture against a moving 4:3 lily camera', () => {
  const source: LilySurfaceSource = {
    center: [0, 1.28, 0], radius: 1.15, minY: -1.45, maxY: 2.25,
    sample: (index) => sampleBenchmarkLily(index).position,
    sampleSurface: sampleBenchmarkLily,
  }
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity
  const bloomPose = getBloomCloseupPose(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  const identityPose = getIdentityCameraMoveTarget(bloomPose, settings)
  const portraitBytes = readFileSync(resolve(process.cwd(), 'src/assets/scene04-portrait-approved-v2.bin'))
  const portraitBuffer = portraitBytes.buffer.slice(portraitBytes.byteOffset, portraitBytes.byteOffset + portraitBytes.byteLength) as ArrayBuffer
  const approvedPortrait = decodeApprovedPortrait(portraitBuffer)
  const targets = approvedPortrait.points
  const cameraBasisAtTime = (time: number) => {
    const progress = Math.min(1, Math.max(0, time / settings.cameraMoveDuration))
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress)
    const pose = {
      x: bloomPose.x + (identityPose.x - bloomPose.x) * eased,
      y: bloomPose.y + (identityPose.y - bloomPose.y) * eased,
      z: bloomPose.z + (identityPose.z - bloomPose.z) * eased,
      tx: bloomPose.tx + (identityPose.tx - bloomPose.tx) * eased,
      ty: bloomPose.ty + (identityPose.ty - bloomPose.ty) * eased,
      tz: bloomPose.tz + (identityPose.tz - bloomPose.tz) * eased,
    }
    return createPortraitCameraBasis({
      eye: [pose.x, pose.y, pose.z], lookAt: [pose.tx, pose.ty, pose.tz],
      aspect: 4 / 3, fovDegrees: 38, planeDistance: 3.4,
    })
  }
  const targetBasis = cameraBasisAtTime(settings.portraitStart)
  const targetPositions = placeLilyPortraitTargets(targets, approvedPortrait.width / approvedPortrait.height, targetBasis, APPROVED_PORTRAIT_SETTINGS)
  const geometryOptions = {
    targets, targetPositions, start: settings.portraitStart, duration: settings.portraitDuration,
    dissolveDuration: settings.dissolveDuration, edgeWidth: settings.edgeWidth, settings,
    cameraBasisAtTime,
    capture: {
      portraitStartProgress: settings.portraitStartProgress, portraitFraction: settings.portraitFraction,
      portraitMinTurns: settings.portraitMinTurns, portraitMaxTurns: settings.portraitMaxTurns,
      portraitSteering: settings.portraitSteering, portraitBraking: settings.portraitBraking,
      portraitSettledBrightness: settings.portraitSettledBrightness, vortexSpeedMultiplier: settings.vortexSpeedMultiplier,
    },
  }

  const startedAt = performance.now()
  const geometry = createLilyParticleGeometry(source, settings.particleCount, geometryOptions)
  const elapsedMs = performance.now() - startedAt
  const motion = geometry.getAttribute('aPortraitMotion')
  const positions = geometry.getAttribute('position')
  const parts = geometry.getAttribute('aPart')
  const seeds = geometry.getAttribute('aSeed')
  const assigned: number[] = []
  const launchTimes: number[] = []
  const captureFlags = geometry.getAttribute('aPortraitSeedData')
  const assignedTargetPositions = geometry.getAttribute('aPortraitTarget')
  for (let index = 0; index < motion.count; index++) {
    if (motion.getW(index) > 0.5) {
      assigned.push(index)
      launchTimes.push(motion.getX(index))
    }
  }
  const assignedTargetIndices = new Set<number>()
  const positionKey = (point: readonly number[]) => point.map(Math.fround).join(':')
  const targetIndexByPosition = new Map(targetPositions.map((point, index) => [positionKey(point), index]))
  const allPortraitCells = new Set<string>()
  const assignedPortraitCells = new Set<string>()
  const assignedRegions = { hairAndHead: 0, face: 0, lowerSilhouette: 0 }
  for (const target of targets) {
    const cell = `${Math.min(7, Math.floor(target.u * 8))}:${Math.min(7, Math.floor(target.v * 8))}`
    allPortraitCells.add(cell)
  }
  for (const index of assigned) {
    const targetIndex = targetIndexByPosition.get(positionKey([
      assignedTargetPositions.getX(index), assignedTargetPositions.getY(index), assignedTargetPositions.getZ(index),
    ]))
    if (targetIndex === undefined) continue
    const target = targets[targetIndex]
    if (!target) continue
    assignedTargetIndices.add(targetIndex)
    const cell = `${Math.min(7, Math.floor(target.u * 8))}:${Math.min(7, Math.floor(target.v * 8))}`
    assignedPortraitCells.add(cell)
    if (target.u >= 0.2 && target.u <= 0.85 && target.v >= 0.07 && target.v <= 0.62) assignedRegions.hairAndHead++
    if (target.u >= 0.46 && target.u <= 0.77 && target.v >= 0.16 && target.v <= 0.55) assignedRegions.face++
    if (target.v > 0.62) assignedRegions.lowerSilhouette++
  }
  console.log(`[lily portrait coverage] ${assignedPortraitCells.size}/${allPortraitCells.size} 8x8 occupied cells; regions ${JSON.stringify(assignedRegions)}`)
  const missedPortraitCells = [...allPortraitCells].filter((cell) => !assignedPortraitCells.has(cell))
  console.log(`[lily portrait coverage] unassigned 8x8 cells: ${missedPortraitCells.join(', ') || 'none'}`)
  const screenCorrectionDistances = assigned.map((index) => {
    const origin: [number, number, number] = [positions.getX(index), positions.getY(index), positions.getZ(index)]
    const departure = getLilyParticleVortexPosition(origin, parts.getX(index), seeds.getX(index), motion.getX(index), source,
      settings, captureFlags.getZ(index) > 0.5)
    const cameraBasis = cameraBasisAtTime(motion.getX(index))
    const projectedDeparture = projectPortraitPoint(departure, cameraBasis)
    const projectedTarget = projectPortraitPoint(
      [assignedTargetPositions.getX(index), assignedTargetPositions.getY(index), assignedTargetPositions.getZ(index)], cameraBasis,
    )
    return Math.hypot(projectedDeparture.x - projectedTarget.x, projectedDeparture.y - projectedTarget.y)
  })
  console.log(`[lily portrait correction] max ${Math.max(...screenCorrectionDistances).toFixed(3)} NDC; ${elapsedMs.toFixed(1)} ms preparation`)
  let intermediateScreenGapMax = { distance: 0, index: -1, time: 0, launchTime: 0 }
  let unconstrainedScreenGapMax = { distance: 0, index: -1, time: 0, launchTime: 0 }
  let staticCameraHermiteGap = 0
  let movingCameraZeroTangentGap = 0
  let movingCameraLaunchCount = 0
  let shortenedRoutes = 0
  let minimumTravelDuration = Infinity
  const finalCameraBasis = cameraBasisAtTime(settings.cameraMoveDuration)
  for (const index of assigned) {
    const origin: [number, number, number] = [positions.getX(index), positions.getY(index), positions.getZ(index)]
    const target: [number, number, number] = [assignedTargetPositions.getX(index), assignedTargetPositions.getY(index), assignedTargetPositions.getZ(index)]
    const route = { origin, part: parts.getX(index), seed: seeds.getX(index), target,
      launchTime: motion.getX(index), travelDuration: motion.getY(index), captureMotion: captureFlags.getZ(index) > 0.5,
    }
    const nominalTravelDuration = 0.75 + benchmarkPlannerRandom01(index, 0x510e527f) * 1.1
    const unconstrainedRoute = { ...route, travelDuration: nominalTravelDuration }
    if (route.travelDuration < nominalTravelDuration - 1e-4) shortenedRoutes++
    minimumTravelDuration = Math.min(minimumTravelDuration, route.travelDuration)
    const travelDuration = route.travelDuration * settings.portraitBraking
    const departure = getLilyParticleVortexPosition(origin, route.part, route.seed, route.launchTime, source,
      settings, route.captureMotion)
    const launchCameraMoving = route.launchTime < settings.cameraMoveDuration && route.launchTime + travelDuration > 0
    if (launchCameraMoving) movingCameraLaunchCount++
    for (let sample = 0; sample <= 96; sample++) {
      const time = route.launchTime + travelDuration * sample / 96
      const cameraBasis = cameraBasisAtTime(time)
      const position = getLilyParticlePortraitPosition(route, time, source, settings, {
        portraitBraking: settings.portraitBraking, portraitSteering: settings.portraitSteering,
      })
      const unconstrainedPosition = getLilyParticlePortraitPosition(unconstrainedRoute, time, source, settings, {
        portraitBraking: settings.portraitBraking, portraitSteering: settings.portraitSteering,
      })
      const projectedPosition = projectPortraitPoint(position, cameraBasis)
      const projectedTarget = projectPortraitPoint(target, cameraBasis)
      const screenGap = Math.hypot(projectedPosition.x - projectedTarget.x, projectedPosition.y - projectedTarget.y)
      if (screenGap > intermediateScreenGapMax.distance) {
        intermediateScreenGapMax = { distance: screenGap, index, time, launchTime: route.launchTime }
      }
      const unconstrainedProjected = projectPortraitPoint(unconstrainedPosition, cameraBasis)
      const unconstrainedGap = Math.hypot(unconstrainedProjected.x - projectedTarget.x, unconstrainedProjected.y - projectedTarget.y)
      if (unconstrainedGap > unconstrainedScreenGapMax.distance) {
        unconstrainedScreenGapMax = { distance: unconstrainedGap, index, time, launchTime: route.launchTime }
      }
      const fixedCameraPosition = projectPortraitPoint(unconstrainedPosition, finalCameraBasis)
      const fixedCameraTarget = projectPortraitPoint(target, finalCameraBasis)
      staticCameraHermiteGap = Math.max(staticCameraHermiteGap,
        Math.hypot(fixedCameraPosition.x - fixedCameraTarget.x, fixedCameraPosition.y - fixedCameraTarget.y))
      const travel = sample / 96
      const zeroTangentPosition = getPortraitHermitePosition(departure, [0, 0, 0], target, travel * travelDuration, travelDuration)
      const zeroTangentScreenPosition = projectPortraitPoint(zeroTangentPosition, cameraBasis)
      movingCameraZeroTangentGap = Math.max(movingCameraZeroTangentGap,
        Math.hypot(zeroTangentScreenPosition.x - projectedTarget.x, zeroTangentScreenPosition.y - projectedTarget.y))
    }
  }
  console.log(`[lily portrait transition] unconstrained ${unconstrainedScreenGapMax.distance.toFixed(3)} NDC at t=${unconstrainedScreenGapMax.time.toFixed(2)}s; constrained ${intermediateScreenGapMax.distance.toFixed(3)}; fixed-camera Hermite ${staticCameraHermiteGap.toFixed(3)}; moving-camera zero-tangent ${movingCameraZeroTangentGap.toFixed(3)}; shortened ${shortenedRoutes}, minimum duration ${minimumTravelDuration.toFixed(3)}s, camera-overlap launches ${movingCameraLaunchCount}`)
  const replayGeometry = createLilyParticleGeometry(source, settings.particleCount, geometryOptions)
  expect(Array.from(motion.array)).toEqual(Array.from(replayGeometry.getAttribute('aPortraitMotion').array))
  expect(Array.from(captureFlags.array)).toEqual(Array.from(replayGeometry.getAttribute('aPortraitSeedData').array))
  expect(Array.from(geometry.getAttribute('aPortraitRoute').array)).toEqual(Array.from(replayGeometry.getAttribute('aPortraitRoute').array))
  replayGeometry.dispose()
  const bins = new Set(launchTimes.map((time) => Math.floor(time / 2)))
  const observations = assigned.map((index) => {
    const position: [number, number, number] = [positions.getX(index), positions.getY(index), positions.getZ(index)]
    const birthTime = benchmarkBirthTime(position, parts.getX(index), source, settings.dissolveDuration, settings.edgeWidth, settings.centerDissolveAt)
    const initialTime = Math.max(settings.portraitStartProgress * settings.dissolveDuration, birthTime + 0.72)
      + benchmarkPlannerRandom01(index, 0x3c6ef372) * 0.55
    const initialAge = Math.max(0, initialTime - birthTime)
    const launchAge = motion.getX(index) - birthTime
    const angularSpeed = settings.swirlSpeed * settings.vortexSpeedMultiplier * (0.95 + 0.1 * seeds.getX(index))
    const phase = (age: number) => angularSpeed * age + 0.5 * settings.swirlAcceleration * age * age
    return {
      turns: (phase(launchAge) - phase(initialAge)) / (Math.PI * 2),
      fade: getLilyParticleFade(launchAge, captureFlags.getZ(index) > 0.5),
      captureMotion: captureFlags.getZ(index) > 0.5,
    }
  })
  const estimatedTurns = observations.map(({ turns }) => turns)
  const captureAssignments = assigned.filter((index) => captureFlags.getZ(index) > 0.5)
  const captureTurns = observations.filter(({ captureMotion }) => captureMotion).map(({ turns }) => turns)
  const minimumLaunchFade = Math.min(...observations.map(({ fade }) => fade))
  const turnBins = new Set(estimatedTurns.map((turns) => Math.floor(turns * 4)))
  const exactTurnStats = [1, 2].map((turns) => countBenchmarkTurnVisibility({
    geometry, source, settings, cameraBasisAtTime, turns,
  }))
  const exactCaptureTurnStats = [1, 2].map((turns) => countBenchmarkTurnVisibility({
    geometry, source, settings, cameraBasisAtTime, turns, captureMotion: true,
  }))
  console.log(`[lily capture benchmark] exact 1-turn paths: ${JSON.stringify(exactTurnStats[0])}; exact 2-turn paths: ${JSON.stringify(exactTurnStats[1])}; capture-rise 1/2-turn paths: ${JSON.stringify(exactCaptureTurnStats)}`)
  console.log(`[lily capture benchmark] assigned capture-rise routes: ${captureTurns.length}, actual turns ${Math.min(...captureTurns).toFixed(2)}–${Math.max(...captureTurns).toFixed(2)}`)

  console.log(`[lily capture benchmark] ${settings.particleCount} sources / ${targets.length} targets: ${assigned.length} unique visible assignments (${captureAssignments.length} capture-rise) in ${elapsedMs.toFixed(1)} ms; launch ${Math.min(...launchTimes).toFixed(2)}–${Math.max(...launchTimes).toFixed(2)} s across ${bins.size} two-second epochs; estimated turns ${Math.min(...estimatedTurns).toFixed(2)}–${Math.max(...estimatedTurns).toFixed(2)} across ${turnBins.size} quarter-turn bins`)
  expect(geometry.getAttribute('position').count).toBe(80_000)
  expect(assigned.length).toBeGreaterThan(12_800)
  expect(assigned.length).toBeLessThanOrEqual(32_000)
  expect(new Set(assigned).size).toBe(assigned.length)
  expect(assignedTargetIndices.size).toBe(assigned.length)
  expect(assignedPortraitCells.size).toBeGreaterThanOrEqual(Math.ceil(allPortraitCells.size * 0.9))
  expect(assignedRegions.hairAndHead).toBeGreaterThan(7_000)
  expect(assignedRegions.face).toBeGreaterThan(2_500)
  expect(assignedRegions.lowerSilhouette).toBeGreaterThan(2_000)
  expect(Math.max(...screenCorrectionDistances)).toBeLessThanOrEqual(0.38 + 1e-5)
  expect(intermediateScreenGapMax.distance).toBeLessThanOrEqual(0.38 + 1e-5)
  expect(shortenedRoutes).toBeGreaterThan(0)
  expect(minimumTravelDuration).toBeGreaterThanOrEqual(0.45 - 1e-6)
  expect(Math.min(...launchTimes)).toBeGreaterThanOrEqual(settings.portraitStartProgress * settings.dissolveDuration)
  expect(new Set(launchTimes).size / launchTimes.length).toBeGreaterThan(0.99)
  expect(bins.size).toBeGreaterThanOrEqual(3)
  expect(minimumLaunchFade).toBeGreaterThanOrEqual(0.15)
  expect(Math.min(...estimatedTurns)).toBeGreaterThan(-0.001)
  expect(Math.max(...estimatedTurns)).toBeLessThan(2.001)
  expect(Math.max(...estimatedTurns)).toBeGreaterThan(1)
  expect(Math.max(...estimatedTurns) - Math.min(...estimatedTurns)).toBeGreaterThan(0.8)
  expect(turnBins.size).toBeGreaterThanOrEqual(4)
  expect(exactCaptureTurnStats[0]!.meaningfulVisible).toBeGreaterThan(0)
  expect(exactCaptureTurnStats[1]!.meaningfulVisible).toBeGreaterThan(0)
  expect(captureAssignments.length).toBeGreaterThan(0)
  expect(captureAssignments.length).toBeLessThan(assigned.length * 0.3)
  expect(Math.min(...captureTurns)).toBeGreaterThanOrEqual(1.8)
  expect(Math.max(...captureTurns)).toBeLessThanOrEqual(2.001)
  if (exactTurnStats[1]!.meaningfulVisible > 0) expect(Math.max(...estimatedTurns)).toBeGreaterThan(1.8)
  geometry.dispose()
}, 60_000)

function sampleBenchmarkLily(index: number) {
  const partChoice = benchmarkUnit(index, 7)
  if (partChoice < 0.78) {
    const sector = Math.floor(benchmarkUnit(index, 11) * 6)
    const angle = sector * Math.PI / 3 + (benchmarkUnit(index, 13) - 0.5) * 0.48
    const radius = 0.16 + Math.sqrt(benchmarkUnit(index, 17)) * 0.98
    return { part: 0, position: [
      Math.cos(angle) * radius, 1.15 + radius * 0.22 + Math.sin(angle * 6) * 0.09,
      Math.sin(angle) * radius,
    ] as [number, number, number] }
  }
  if (partChoice < 0.86) {
    const angle = benchmarkUnit(index, 19) * Math.PI * 2
    const radius = Math.sqrt(benchmarkUnit(index, 23)) * 0.24
    return { part: 1, position: [Math.cos(angle) * radius, 1.3 + benchmarkUnit(index, 29) * 0.14,
      Math.sin(angle) * radius] as [number, number, number] }
  }
  const angle = benchmarkUnit(index, 31) * Math.PI * 2
  const radius = 0.2 + benchmarkUnit(index, 37) * 0.95
  const height = -1.45 + benchmarkUnit(index, 41) * 2.4
  return { part: 2, position: [Math.cos(angle) * radius * 0.7, height, Math.sin(angle) * radius * 0.7] as [number, number, number] }
}

function benchmarkUnit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function benchmarkBirthTime(position: readonly [number, number, number], part: number, source: LilySurfaceSource, duration: number, edgeWidth: number, centerDissolveAt: number) {
  const [x, y, z] = position
  const radial = Math.max(0, Math.min(1, Math.hypot(x - source.center[0], z - source.center[2]) / Math.max(source.radius, 0.001)))
  const height = Math.max(0, Math.min(1, (y - source.minY) / Math.max(source.maxY - source.minY, 0.001)))
  const noise = Math.sin(x * 11.7 + Math.sin(y * 8.3)) * Math.sin(z * 13.1 + y * 7.1) * 0.035
  const phase = part < 0.5 ? 0.08 + (1 - radial) * 0.62
    : part < 1.5 ? 0.08 + 0.62 * centerDissolveAt + radial * 0.18
      : 0.76 + (1 - height) * 0.18
  const front = Math.max(edgeWidth + 0.002, Math.min(0.998 - edgeWidth, phase + noise))
  return (front - edgeWidth) * duration
}

function benchmarkPlannerRandom01(index: number, salt: number) {
  let value = (Math.imul(index + 1, 0x9e3779b1) + salt) | 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

function countBenchmarkTurnVisibility(input: {
  geometry: BufferGeometry
  source: LilySurfaceSource
  settings: typeof DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity
  cameraBasisAtTime: (time: number) => ReturnType<typeof createPortraitCameraBasis>
  turns: number
  captureMotion?: boolean
}) {
  const positions = input.geometry.getAttribute('position')
  const parts = input.geometry.getAttribute('aPart')
  const seeds = input.geometry.getAttribute('aSeed')
  let detached = 0
  let withinTail = 0
  let visibleWithLegacyFade = 0
  let meaningfulFade = 0
  let meaningfulVisible = 0
  for (let index = 0; index < positions.count; index++) {
    const origin: [number, number, number] = [positions.getX(index), positions.getY(index), positions.getZ(index)]
    const part = parts.getX(index)
    const seed = seeds.getX(index)
    const birthTime = benchmarkBirthTime(origin, part, input.source, input.settings.dissolveDuration,
      input.settings.edgeWidth, input.settings.centerDissolveAt)
    const initialTime = Math.max(input.settings.portraitStartProgress * input.settings.dissolveDuration, birthTime + 0.72)
      + benchmarkPlannerRandom01(index, 0x3c6ef372) * 0.55
    const initialAge = Math.max(0, initialTime - birthTime)
    const angularSpeed = input.settings.swirlSpeed * input.settings.vortexSpeedMultiplier * (0.95 + 0.1 * seed)
    const age = benchmarkAgeAfterTurns(initialAge, input.turns, angularSpeed, input.settings.swirlAcceleration)
    if (age < 0.72) continue
    detached++
    if (age <= LILY_PARTICLE_TAIL_SECONDS) withinTail++
    if (age > LILY_PARTICLE_TAIL_SECONDS && !input.captureMotion) continue
    const fade = getLilyParticleFade(age, input.captureMotion)
    if (fade < 0.04) continue
    if (fade >= 0.15) meaningfulFade++
    const launchTime = birthTime + age
    const launchPosition = getLilyParticleVortexPosition(origin, part, seed, launchTime, input.source, {
      ...input.settings, vortexSpeedMultiplier: input.settings.vortexSpeedMultiplier,
    }, input.captureMotion)
    const projected = projectPortraitPoint(launchPosition, input.cameraBasisAtTime(launchTime))
    const inFrame = projected.depth > 0 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
      && Number.isFinite(projected.x) && Number.isFinite(projected.y)
    if (inFrame) {
      visibleWithLegacyFade++
      if (fade >= 0.15) meaningfulVisible++
    }
  }
  return { detached, withinTail, visibleWithLegacyFade, meaningfulFade, meaningfulVisible }
}

function benchmarkAgeAfterTurns(startAge: number, turns: number, angularSpeed: number, acceleration: number) {
  const targetPhase = angularSpeed * startAge + 0.5 * acceleration * startAge * startAge + turns * Math.PI * 2
  return acceleration > 0.000001
    ? (-angularSpeed + Math.sqrt(angularSpeed * angularSpeed + 2 * acceleration * targetPhase)) / acceleration
    : targetPhase / Math.max(0.001, angularSpeed)
}
