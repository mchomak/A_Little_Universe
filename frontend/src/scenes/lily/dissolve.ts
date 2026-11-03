import { BufferAttribute, BufferGeometry, Color, Material, ShaderMaterial, Vector3, AdditiveBlending } from 'three'
import type { LilySurfaceSource } from './particleSource'
import { PORTRAIT_STAGE_OFFSETS, PORTRAIT_STAGE_WINDOW, getPortraitHermitePosition, projectPortraitPoint, selectPortraitCandidates, type PortraitCameraBasis, type PortraitTarget } from './portraitTargets'
import type { StarPortraitPoint } from './starPortraitTargets'

export const LILY_PARTICLE_FADE_START_SECONDS = 7
export const LILY_PARTICLE_TAIL_SECONDS = 10.5
export const LILY_PARTICLE_RISE_LINEAR = 0.18
export const LILY_PARTICLE_RISE_VARIATION = 0.03
export const LILY_PARTICLE_RISE_ACCELERATION = 0.075
export const LILY_PARTICLE_MAX_RISE = 5.2
export const LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE = 0.72
export const LILY_PARTICLE_CAPTURE_SLOWDOWN_DURATION = 2.4
export const LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE = 0.16
export const LILY_PORTRAIT_SETTLED_RAMP_SECONDS = 0.35
export const LILY_PARTICLE_MAX_POINT_SIZE = 6
export const LILY_PARTICLE_MAX_SIZE_ACCENT = 1.08
export const LILY_VORTEX_RADIUS_CAP_OFFSET = 0.25
export const LILY_PORTRAIT_MIN_TONE_CONTRAST = 0.95
export const LILY_PORTRAIT_MAX_TONE_CONTRAST = 1.15
export const LILY_PORTRAIT_MIN_FEATURE_ACCENT = 1
export const LILY_PORTRAIT_MAX_FEATURE_ACCENT = 1.8
const LILY_PORTRAIT_CAPTURE_MIN_FADE = 0.15
const LILY_PORTRAIT_CAPTURE_MIN_TURNS = 1.8
const LILY_PORTRAIT_CAPTURE_PARTICLE_FRACTION = 0.1

export function glslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value)
}

export function getLilyParticleVerticalRise(age: number, seed: number) {
  const elapsed = Math.max(0, age)
  const normalizedSeed = Math.min(1, Math.max(0, seed))
  const rise = elapsed * (LILY_PARTICLE_RISE_LINEAR + normalizedSeed * LILY_PARTICLE_RISE_VARIATION)
    + LILY_PARTICLE_RISE_ACCELERATION * elapsed * elapsed
  return Math.min(LILY_PARTICLE_MAX_RISE, rise)
}

/** Maps only capture-marked particles onto a C1 time-warped upward path. */
export function getLilyParticleCaptureRiseAge(age: number) {
  const elapsedAge = Math.max(0, Number.isFinite(age) ? age : 0)
  const elapsed = elapsedAge - LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE
  if (elapsed <= 0) return elapsedAge

  const duration = LILY_PARTICLE_CAPTURE_SLOWDOWN_DURATION
  const finalRate = LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE
  const t = clamp(elapsed / duration, 0, 1)
  const integratedRate = t - (1 - finalRate) * (t * t * t - 0.5 * t * t * t * t)
  const endAge = LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE + duration * (0.5 + 0.5 * finalRate)
  if (elapsed < duration) return LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE + duration * integratedRate
  return endAge + (elapsed - duration) * finalRate
}

/** Mirrors the shader fade; captured long-turn particles stop fading at the visible onset. */
export function getLilyParticleFade(age: number, captureMotion = false) {
  const fadeAge = Math.max(0, Number.isFinite(age) ? age : 0)
  return 1 - smoothstep(LILY_PARTICLE_FADE_START_SECONDS, LILY_PARTICLE_TAIL_SECONDS,
    captureMotion ? Math.min(fadeAge, LILY_PARTICLE_FADE_START_SECONDS) : fadeAge)
}

/** CPU mirror of the vertex material's transition from vortex alpha to portrait reveal. */
export function getLilyParticlePortraitAlpha(age: number, elapsedSinceLaunch: number, travelDuration: number, portraitReveal: number, captureMotion = false) {
  const normalizedAge = Math.max(0, Number.isFinite(age) ? age : 0)
  const baseAlpha = smoothstep(0, 0.16, normalizedAge) * getLilyParticleFade(normalizedAge, captureMotion)
  const duration = Math.max(0.05, Number.isFinite(travelDuration) ? travelDuration : 0.05)
  const elapsed = Number.isFinite(elapsedSinceLaunch) ? elapsedSinceLaunch : 0
  const travel = clamp(elapsed / duration, 0, 1)
  const reveal = clampFinite(portraitReveal, 0, 1, 0)
  const portraitMix = smoothstep(0, 1, travel)
  return baseAlpha * (1 - portraitMix) + reveal * portraitMix
}

/** Absolute-time settled brightness ramp, enabled only for visible portrait routes. */
export function getLilyParticlePortraitSettledProgress(time: number, arrivalTime: number, visiblePortraitRoute: boolean) {
  if (!visiblePortraitRoute) return 0
  const sceneTime = Number.isFinite(time) ? time : 0
  const settledAt = Number.isFinite(arrivalTime) ? arrivalTime : 0
  return smoothstep(0, LILY_PORTRAIT_SETTLED_RAMP_SECONDS, Math.max(0, sceneTime - settledAt))
}

export function getLilyParticleOrbitRadius(sourceRadius: number, targetRadius: number, rise: number, expansion: number, detach: number, flowerRadius: number, vortexRadius: number) {
  const blend = Math.min(1, Math.max(0, detach))
  const uncappedRadius = sourceRadius * (1 - blend) + (targetRadius + rise * expansion) * blend
  const riseAllowance = Math.min(LILY_VORTEX_RADIUS_CAP_OFFSET, Math.max(0, rise * expansion))
  const radiusCap = Math.max(sourceRadius, flowerRadius * (vortexRadius + riseAllowance))
  return Math.min(uncappedRadius, radiusCap)
}

/** The same world-space threshold drives the GLB fragments and its sampled particles. */
export const LILY_FIELD = /* glsl */ `
uniform vec3 uLilyCenter;
uniform float uLilyRadius;
uniform float uLilyMinY;
uniform float uLilyMaxY;
uniform float uLilyEdge;
uniform float uLilyCenterDissolveAt;
float lilyThreshold(vec3 p, float part) {
  float radial = clamp(length(p.xz - uLilyCenter.xz) / max(uLilyRadius, 0.001), 0.0, 1.0);
  float height = clamp((p.y - uLilyMinY) / max(uLilyMaxY - uLilyMinY, 0.001), 0.0, 1.0);
  float noise = (sin(p.x * 11.7 + sin(p.y * 8.3)) * sin(p.z * 13.1 + p.y * 7.1)) * 0.035;
  float petalStart = 0.08;
  float petalEnd = 0.70;
  float phase = part < 0.5 ? petalStart + (1.0 - radial) * (petalEnd - petalStart)
    : part < 1.5 ? mix(petalStart, petalEnd, uLilyCenterDissolveAt) + radial * 0.18
    : 0.76 + (1.0 - height) * 0.18;
  return clamp(phase + noise, uLilyEdge + 0.002, 0.998 - uLilyEdge);
}
`

export interface LilyDissolveUniforms {
  uLilyActive: { value: number }; uLilyProgress: { value: number }; uLilyEdge: { value: number }
  uLilyDuration: { value: number }; uLilyCenter: { value: Vector3 }; uLilyRadius: { value: number }
  uLilyMinY: { value: number }; uLilyMaxY: { value: number }; uLilySize: { value: number }
  uLilyDpr: { value: number }
  uLilyParticleBrightness: { value: number }; uLilyVortexRadius: { value: number }
  uLilyVortexExpansion: { value: number }; uLilySwirlSpeed: { value: number }
  uLilyVortexSpeedMultiplier: { value: number }
  uLilyPortraitSteering: { value: number }; uLilyPortraitBraking: { value: number }; uLilyPortraitSettledBrightness: { value: number }
  uLilySwirlAcceleration: { value: number }; uLilyCenterDissolveAt: { value: number }
  uLilySceneTime: { value: number }; uLilyPortraitStart: { value: number }; uLilyPortraitDuration: { value: number }
  uLilyPortraitBrightness: { value: number }; uLilyPortraitSize: { value: number }
  uLilyPortraitPhotoColorMix: { value: number }; uLilyPortraitOpacity: { value: number }
  uLilyPortraitMinimumBrightness: { value: number }; uLilyPortraitContrast: { value: number }
  uLilyPortraitGlow: { value: number }; uLilyPortraitPointMinSize: { value: number }; uLilyPortraitPointMaxSize: { value: number }
}

export interface LilyParticleSettings {
  particleBrightness: number
  vortexRadius: number
  vortexExpansion: number
  swirlSpeed: number
  swirlAcceleration: number
  centerDissolveAt: number
  vortexSpeedMultiplier?: number
  portraitSteering?: number
  portraitBraking?: number
  portraitSettledBrightness?: number
}

interface LilyPortraitGeometrySharedOptions {
  targetPositions: readonly [number, number, number][]
  start: number
  duration: number
  dissolveDuration: number
  edgeWidth: number
  settings: LilyParticleSettings
}

export interface LilyPortraitCaptureSettings {
  portraitStartProgress: number
  portraitFraction: number
  portraitMinTurns: number
  portraitMaxTurns: number
  portraitSteering: number
  portraitBraking: number
  portraitSettledBrightness: number
  vortexSpeedMultiplier: number
}

export interface LilyVisiblePortraitGeometryOptions extends LilyPortraitGeometrySharedOptions {
  targets: readonly StarPortraitPoint[]
  cameraBasisAtTime: (time: number) => PortraitCameraBasis
  capture: LilyPortraitCaptureSettings
}

/** The old static-basis route remains supported for the DEV laboratory. */
export type LilyPortraitGeometryOptions = LilyVisiblePortraitGeometryOptions | (LilyPortraitGeometrySharedOptions & {
  targets: readonly PortraitTarget[]
  fraction: number
  cameraBasis: PortraitCameraBasis
  cameraBasisAtTime?: never
  capture?: never
})

export interface LilyPortraitAppearanceSettings {
  photoColorMix: number
  opacity: number
  glow: number
  minSize: number
  maxSize: number
  minimumBrightness?: number
  contrast?: number
}

export function createLilyDissolveUniforms(): LilyDissolveUniforms {
  return { uLilyActive: { value: 0 }, uLilyProgress: { value: 0 }, uLilyEdge: { value: 0.035 },
    uLilyDuration: { value: 12 }, uLilyCenter: { value: new Vector3() }, uLilyRadius: { value: 1 },
    uLilyMinY: { value: 0 }, uLilyMaxY: { value: 1 }, uLilySize: { value: 2.3 }, uLilyDpr: { value: 1 },
    uLilyParticleBrightness: { value: 1.25 }, uLilyVortexRadius: { value: 0.8 },
    uLilyVortexExpansion: { value: 0.45 }, uLilySwirlSpeed: { value: 1 },
    uLilyVortexSpeedMultiplier: { value: 1 },
    uLilyPortraitSteering: { value: 1 }, uLilyPortraitBraking: { value: 1 }, uLilyPortraitSettledBrightness: { value: 1.15 },
    uLilySwirlAcceleration: { value: 0.1 }, uLilyCenterDissolveAt: { value: 0.5 },
    uLilySceneTime: { value: 0 }, uLilyPortraitStart: { value: 12 }, uLilyPortraitDuration: { value: 8.5 },
    uLilyPortraitBrightness: { value: 1.8 }, uLilyPortraitSize: { value: 1.8 },
    uLilyPortraitPhotoColorMix: { value: 0 }, uLilyPortraitOpacity: { value: 1 },
    uLilyPortraitMinimumBrightness: { value: 0 }, uLilyPortraitContrast: { value: 1 },
    uLilyPortraitGlow: { value: 1 }, uLilyPortraitPointMinSize: { value: 1 }, uLilyPortraitPointMaxSize: { value: LILY_PARTICLE_MAX_POINT_SIZE } }
}

export function setLilySurfaceBounds(uniforms: LilyDissolveUniforms, surface: LilySurfaceSource) {
  uniforms.uLilyCenter.value.set(...surface.center)
  uniforms.uLilyRadius.value = surface.radius
  uniforms.uLilyMinY.value = surface.minY
  uniforms.uLilyMaxY.value = surface.maxY
}

export function updateLilyDissolve(uniforms: LilyDissolveUniforms, active: boolean, time: number, duration: number, edge: number) {
  uniforms.uLilyActive.value = active ? 1 : 0
  uniforms.uLilyDuration.value = duration
  uniforms.uLilyEdge.value = edge
  uniforms.uLilyProgress.value = active ? Math.max(0, time / duration) : 0
}

export function updateLilyParticleSize(uniforms: LilyDissolveUniforms, size: number, dpr: number) {
  uniforms.uLilySize.value = size
  uniforms.uLilyDpr.value = dpr
}

/** Applies DEV portrait styling while keeping existing Scene 04 defaults unchanged. */
export function updateLilyPortraitAppearance(uniforms: LilyDissolveUniforms, settings: LilyPortraitAppearanceSettings) {
  uniforms.uLilyPortraitPhotoColorMix.value = clampFinite(settings.photoColorMix, 0, 1, 0)
  uniforms.uLilyPortraitOpacity.value = clampFinite(settings.opacity, 0.2, 1, 1)
  uniforms.uLilyPortraitGlow.value = clampFinite(settings.glow, 0, 2, 1)
  uniforms.uLilyPortraitMinimumBrightness.value = clampFinite(settings.minimumBrightness ?? 0, 0, 0.7, 0)
  uniforms.uLilyPortraitContrast.value = clampFinite(settings.contrast ?? 1, 0.5, 2, 1)

  const maxSize = clampFinite(settings.maxSize, 0.8, 3, 1.55)
  const minSize = Math.min(clampFinite(settings.minSize, 0.4, 1.6, 0.65), maxSize)
  uniforms.uLilyPortraitPointMinSize.value = minSize
  uniforms.uLilyPortraitPointMaxSize.value = maxSize
}

export function updateLilyParticleSettings(uniforms: LilyDissolveUniforms, settings: LilyParticleSettings) {
  uniforms.uLilyParticleBrightness.value = settings.particleBrightness
  uniforms.uLilyVortexRadius.value = settings.vortexRadius
  uniforms.uLilyVortexExpansion.value = settings.vortexExpansion
  uniforms.uLilySwirlSpeed.value = settings.swirlSpeed
  uniforms.uLilyVortexSpeedMultiplier.value = clampFinite(settings.vortexSpeedMultiplier ?? 1, 0, 2, 1)
  uniforms.uLilyPortraitSteering.value = clampFinite(settings.portraitSteering ?? 1, 0, 2, 1)
  uniforms.uLilyPortraitBraking.value = clampFinite(settings.portraitBraking ?? 1, 0.25, 2, 1)
  uniforms.uLilyPortraitSettledBrightness.value = clampFinite(settings.portraitSettledBrightness ?? 1.15, 0.5, 2, 1.15)
  uniforms.uLilySwirlAcceleration.value = settings.swirlAcceleration
  uniforms.uLilyCenterDissolveAt.value = settings.centerDissolveAt
}

export function updateLilyPortraitSettings(uniforms: LilyDissolveUniforms, time: number, settings: {
  portraitStart: number
  portraitDuration: number
  portraitBrightness: number
  portraitSize: number
}) {
  uniforms.uLilySceneTime.value = Number.isFinite(time) ? Math.max(0, time) : 0
  uniforms.uLilyPortraitStart.value = settings.portraitStart
  uniforms.uLilyPortraitDuration.value = settings.portraitDuration
  uniforms.uLilyPortraitBrightness.value = settings.portraitBrightness
  uniforms.uLilyPortraitSize.value = settings.portraitSize
}

/** Adapt the reference's emissive edge/discard technique without replacing GLB materials. */
export function patchLilyMaterial(material: Material, part: number, uniforms: LilyDissolveUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uLilyPart: { value: part } })
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLilyWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLilyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLilyWorld;\nuniform float uLilyActive;\nuniform float uLilyProgress;\nuniform float uLilyPart;\n${LILY_FIELD}`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        float lilyFront = lilyThreshold(vLilyWorld, uLilyPart);
        float lilyGone = uLilyActive * smoothstep(lilyFront - uLilyEdge, lilyFront + uLilyEdge, uLilyProgress);
        float lilyDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (lilyGone > lilyDither) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lilyEdgeLight = uLilyActive * exp(-pow((uLilyProgress - lilyFront) / max(uLilyEdge, 0.002), 2.0));
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.56) * lilyEdgeLight * 0.32;`)
  }
  material.customProgramCacheKey = () => `lily-dissolve-v1-${part}`
  material.needsUpdate = true
}

export function createLilyParticleGeometry(source: LilySurfaceSource, count: number, portrait?: LilyPortraitGeometryOptions) {
  const positions = new Float32Array(count * 3), parts = new Float32Array(count), seeds = new Float32Array(count)
  const portraitTargets = new Float32Array(count * 4), portraitMotion = new Float32Array(count * 4)
  const portraitSourceColors = new Float32Array(count * 3)
  const portraitSeedData = new Float32Array(count * 3)
  const portraitRoute = new Float32Array(count)
  const artSize = new Float32Array(count), artBrightness = new Float32Array(count)
  artSize.fill(1); artBrightness.fill(1)
  portraitSourceColors.fill(1)
  for (let i = 0; i < count; i++) {
    const sample = source.sampleSurface(i, count)
    positions.set(sample.position, i * 3); parts[i] = sample.part
    seeds[i] = ((i * 16807) % 65521) / 65521
    portraitSeedData[i * 3] = 0.5
    portraitSeedData[i * 3 + 1] = 0.5
  }
  if (portrait) {
    if (isVisiblePortraitGeometry(portrait)) {
      const routes = planVisiblePortraitRoutes(positions, parts, seeds, count, source, portrait)
      const totalTargets = Math.min(portrait.targets.length, portrait.targetPositions.length)
      const targetIndices = selectRepresentativePortraitTargets(portrait.targets.slice(0, totalTargets), routes.length)
      const capture = normalizePortraitCaptureSettings(portrait.capture)
      const routeSettings = { ...portrait.settings, vortexSpeedMultiplier: capture.vortexSpeedMultiplier,
        dissolveDuration: Math.max(0.001, portrait.dissolveDuration), edgeWidth: portrait.edgeWidth }
      const targetTrees = createPortraitTargetTrees(targetIndices, portrait.targetPositions)
      for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
        const route = routes[routeIndex]!
        // Keep each reveal stage in its authored part of the portrait, while
        // choosing the closest unused point to the particle's current orbit.
        const stage = Math.min(3, Math.floor(routeIndex / Math.max(1, routes.length) * 4))
        const origin: [number, number, number] = [positions[route.index * 3]!, positions[route.index * 3 + 1]!, positions[route.index * 3 + 2]!]
        const departure = getLilyParticleVortexPosition(origin, parts[route.index]!, seeds[route.index]!, route.launchTime,
          source, routeSettings, route.captureMotion)
        const targetIndex = takeNearestPortraitTarget(targetTrees.get(stage), departure)
        if (targetIndex === undefined) continue
        const target = portrait.targets[targetIndex]!
        const targetPosition = portrait.targetPositions[targetIndex]!
        const index = route.index, i3 = index * 3, i4 = index * 4
        portraitTargets.set([targetPosition[0], targetPosition[1], targetPosition[2], stage], i4)
        portraitMotion.set([route.launchTime, route.travelDuration, clampFinite(target.tone, 0, 1, 0.5), 1 + clampFinite(target.contrast, 0, 1, 0)], i4)
        portraitSourceColors.set(target.photoColorLinear.map((channel) => clampFinite(channel, 0, 1, 1)), i3)
        portraitSeedData.set([clampFinite(target.seed, 0, 1, 0.5), clampFinite(target.featureWeight, 0, 1, 0.5), route.captureMotion ? 1 : 0], index * 3)
        artSize[index] = clampFinite(target.artSize ?? 1, 0, 3, 1)
        artBrightness[index] = clampFinite(target.artBrightness ?? 1, 0, 4, 1)
        portraitRoute[index] = 1
      }
    } else {
      const requested = Math.min(portrait.targets.length, portrait.targetPositions.length,
        Math.floor(count * Math.min(0.35, Math.max(0.05, portrait.fraction))))
      const settings = { ...portrait.settings, dissolveDuration: portrait.dissolveDuration, edgeWidth: portrait.edgeWidth }
      const beforeTime = Math.max(0, portrait.start - 0.32), afterTime = Math.max(0, portrait.start - 0.04)
      const routeCandidates = Array.from({ length: count }, (_, index) => {
        const i3 = index * 3
        const point: [number, number, number] = [positions[i3]!, positions[i3 + 1]!, positions[i3 + 2]!]
        const before = getLilyParticleVortexPosition(point, parts[index]!, seeds[index]!, beforeTime, source, settings)
        const after = getLilyParticleVortexPosition(point, parts[index]!, seeds[index]!, afterTime, source, settings)
        const projectedBefore = projectPortraitPoint(before, portrait.cameraBasis)
        const projectedAfter = projectPortraitPoint(after, portrait.cameraBasis)
        return { index, screenDeltaX: projectedAfter.x - projectedBefore.x, depth: projectedAfter.depth }
      })
      const selected = selectPortraitCandidates(routeCandidates, requested)
      selected.forEach((index, targetIndex) => {
        const target = portrait.targets[targetIndex]!
        const targetPosition = portrait.targetPositions[targetIndex]!
        const stage = Math.min(3, Math.max(0, Math.floor(target.stage)))
        const routeStart = portrait.start + PORTRAIT_STAGE_OFFSETS[stage]! * portrait.duration + target.seed * 0.12
        const travelDuration = Math.min(1.35, Math.max(0.55, portrait.duration * 0.16))
        const i4 = index * 4
        portraitTargets.set([targetPosition[0], targetPosition[1], targetPosition[2], stage], i4)
        portraitMotion.set([routeStart, travelDuration, target.tone, 1 + clamp(target.contrast ?? 0, 0, 1)], i4)
      })
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPart', new BufferAttribute(parts, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aPortraitTarget', new BufferAttribute(portraitTargets, 4))
  geometry.setAttribute('aPortraitMotion', new BufferAttribute(portraitMotion, 4))
  geometry.setAttribute('aPortraitSourceColor', new BufferAttribute(portraitSourceColors, 3))
  geometry.setAttribute('aPortraitSeedData', new BufferAttribute(portraitSeedData, 3))
  geometry.setAttribute('aPortraitRoute', new BufferAttribute(portraitRoute, 1))
  geometry.setAttribute('aArtSize', new BufferAttribute(artSize, 1))
  geometry.setAttribute('aArtBrightness', new BufferAttribute(artBrightness, 1))
  return geometry
}

/** Preserve the full reveal-ordered portrait and retain rare authored layers. */
export function selectRepresentativePortraitTargets(targets: readonly StarPortraitPoint[], requested: number): number[] {
  const count = Math.max(0, Math.min(targets.length, Math.floor(requested)))
  if (count === 0) return []
  const contours = targets.flatMap((point, index) => point.type === 'contour' ? [index] : [])
  const others = targets.flatMap((point, index) => point.type === 'contour' ? [] : [index])
  // The hand-authored eye, nose and mouth accents are scarce; ordinary
  // downsampling can remove almost all of them even with thousands of routes.
  const contourCount = Math.max(count - others.length, count >= contours.length + 3 ? contours.length : Math.min(contours.length, Math.max(1, Math.floor(count * 0.2))))
  const selected = Array.from({ length: contourCount }, (_, index) => contours[Math.floor((index + 0.5) * contours.length / contourCount)]!)
  const remaining = count - selected.length
  for (let index = 0; index < remaining; index++) selected.push(others[Math.floor((index + 0.5) * others.length / remaining)]!)
  const kinds = ['contour', 'flow', 'support', 'fill'] as const
  const present = kinds.filter((kind) => targets.some((point) => (point.type ?? 'fill') === kind))
  if (count >= present.length) {
    for (const kind of present) {
      if (selected.some((index) => (targets[index]!.type ?? 'fill') === kind)) continue
      const candidates = targets.flatMap((point, index) => (point.type ?? 'fill') === kind ? [index] : [])
      const replacement = candidates[Math.floor(candidates.length / 2)]!
      const counts = new Map<string, number>()
      for (const index of selected) { const type = targets[index]!.type ?? 'fill'; counts.set(type, (counts.get(type) ?? 0) + 1) }
      let best = -1, distance = Infinity
      selected.forEach((index, position) => {
        const type = targets[index]!.type ?? 'fill'
        if (type !== 'contour' && (counts.get(type) ?? 0) > 1 && Math.abs(index - replacement) < distance) { best = position; distance = Math.abs(index - replacement) }
      })
      if (best >= 0) selected[best] = replacement
    }
  }
  return selected.sort((a, b) => a - b)
}

interface PlannedPortraitRoute { index: number; launchTime: number; travelDuration: number; captureMotion: boolean }

interface PortraitTargetKdNode {
  index: number
  point: readonly [number, number, number]
  axis: number
  boundsMin: [number, number, number]
  boundsMax: [number, number, number]
  activeCount: number
  active: boolean
  parent?: PortraitTargetKdNode
  left?: PortraitTargetKdNode
  right?: PortraitTargetKdNode
}

function createPortraitTargetTrees(targetIndices: readonly number[], targetPositions: readonly [number, number, number][]) {
  const groups = new Map<number, { index: number; point: readonly [number, number, number] }[]>()
  targetIndices.forEach((index, ordinal) => {
    const stage = Math.min(3, Math.floor(ordinal / Math.max(1, targetIndices.length) * 4))
    const group = groups.get(stage) ?? []
    group.push({ index, point: targetPositions[index]! })
    groups.set(stage, group)
  })
  return new Map(Array.from(groups, ([stage, points]) => [stage, buildPortraitTargetTree(points)]))
}

function buildPortraitTargetTree(points: { index: number; point: readonly [number, number, number] }[], depth = 0, parent?: PortraitTargetKdNode): PortraitTargetKdNode | undefined {
  if (points.length === 0) return undefined
  const axis = depth % 3
  points.sort((a, b) => a.point[axis]! - b.point[axis]! || a.index - b.index)
  const middle = Math.floor(points.length / 2)
  const entry = points[middle]!
  const node: PortraitTargetKdNode = { ...entry, axis, boundsMin: [...entry.point], boundsMax: [...entry.point], activeCount: 1, active: true,
    ...(parent ? { parent } : {}) }
  const left = buildPortraitTargetTree(points.slice(0, middle), depth + 1, node)
  const right = buildPortraitTargetTree(points.slice(middle + 1), depth + 1, node)
  if (left) node.left = left
  if (right) node.right = right
  for (const child of [node.left, node.right]) {
    if (!child) continue
    node.activeCount += child.activeCount
    for (let coordinate = 0; coordinate < 3; coordinate++) {
      node.boundsMin[coordinate] = Math.min(node.boundsMin[coordinate]!, child.boundsMin[coordinate]!)
      node.boundsMax[coordinate] = Math.max(node.boundsMax[coordinate]!, child.boundsMax[coordinate]!)
    }
  }
  return node
}

function takeNearestPortraitTarget(tree: PortraitTargetKdNode | undefined, position: readonly [number, number, number]): number | undefined {
  let bestNode: PortraitTargetKdNode | undefined
  let bestDistance = Infinity
  const distanceToBounds = (node: PortraitTargetKdNode) => {
    let distance = 0
    for (let axis = 0; axis < 3; axis++) {
      const delta = position[axis]! < node.boundsMin[axis]! ? node.boundsMin[axis]! - position[axis]!
        : position[axis]! > node.boundsMax[axis]! ? position[axis]! - node.boundsMax[axis]! : 0
      distance += delta * delta
    }
    return distance
  }
  const visit = (node: PortraitTargetKdNode | undefined) => {
    if (!node || node.activeCount === 0 || distanceToBounds(node) > bestDistance) return
    const dx = position[0] - node.point[0], dy = position[1] - node.point[1], dz = position[2] - node.point[2]
    const distance = dx * dx + dy * dy + dz * dz
    if (node.active && (distance < bestDistance || (distance === bestDistance && (bestNode === undefined || node.index < bestNode.index)))) {
      bestDistance = distance
      bestNode = node
    }
    const leftDistance = node.left ? distanceToBounds(node.left) : Infinity
    const rightDistance = node.right ? distanceToBounds(node.right) : Infinity
    if (leftDistance <= rightDistance) { visit(node.left); visit(node.right) }
    else { visit(node.right); visit(node.left) }
  }
  visit(tree)
  if (!bestNode) return undefined
  bestNode.active = false
  for (let node: PortraitTargetKdNode | undefined = bestNode; node; node = node.parent) node.activeCount -= 1
  return bestNode.index
}

function isVisiblePortraitGeometry(options: LilyPortraitGeometryOptions): options is LilyVisiblePortraitGeometryOptions {
  return 'capture' in options && 'cameraBasisAtTime' in options && typeof options.cameraBasisAtTime === 'function'
}

function planVisiblePortraitRoutes(
  positions: Float32Array,
  parts: Float32Array,
  seeds: Float32Array,
  count: number,
  source: LilySurfaceSource,
  options: LilyVisiblePortraitGeometryOptions,
): PlannedPortraitRoute[] {
  const controls = normalizePortraitCaptureSettings(options.capture)
  const targetCount = Math.min(options.targets.length, options.targetPositions.length,
    Math.floor(count * controls.portraitFraction))
  if (targetCount === 0) return []

  const dissolveDuration = Math.max(0.001, options.dissolveDuration)
  const settings = { ...options.settings, vortexSpeedMultiplier: controls.vortexSpeedMultiplier,
    dissolveDuration, edgeWidth: options.edgeWidth }
  const gateTime = controls.portraitStartProgress * dissolveDuration
  const candidates: PlannedPortraitRoute[] = []
  const turnRange = controls.portraitMaxTurns - controls.portraitMinTurns
  const visibilitySamples = turnRange > 0.000001 ? 8 : 1
  const longTurnCaptureAvailable = controls.portraitMaxTurns >= LILY_PORTRAIT_CAPTURE_MIN_TURNS

  for (let index = 0; index < count; index++) {
    const i3 = index * 3
    const position: [number, number, number] = [positions[i3]!, positions[i3 + 1]!, positions[i3 + 2]!]
    const seed = seeds[index]!
    const front = getLilyParticleDissolveFront(position, parts[index]!, source, options.settings, options.edgeWidth)
    const birthTime = (front - options.edgeWidth) * dissolveDuration
    const detachedTime = Math.max(0, birthTime + 0.72)
    const initialTime = Math.max(gateTime, detachedTime) + random01(index, 0x3c6ef372) * 0.55
    const initialAge = Math.max(0, initialTime - birthTime)
    const angularSpeed = options.settings.swirlSpeed * controls.vortexSpeedMultiplier * (0.95 + 0.1 * seed)
    const turnOffset = random01(index, 0x1f83d9ab)
    let visibleRoute: PlannedPortraitRoute | undefined
    const captureEligible = longTurnCaptureAvailable
      && random01(index, 0x5be0cd19) < LILY_PORTRAIT_CAPTURE_PARTICLE_FRACTION
    const searchCaptureMotion = [false, true].filter((captureMotion) => captureMotion ? captureEligible : true)

    // Keep the ordinary proposal search first. A small deterministic subset
    // gets an additional long-turn pass with capture-only rise/fade behavior.
    for (const captureMotion of searchCaptureMotion) {
      for (let sample = 0; sample < visibilitySamples; sample++) {
        const turns = controls.portraitMinTurns + turnRange * fract(turnOffset + sample * 0.6180339887498949)
        if (captureMotion && turns < LILY_PORTRAIT_CAPTURE_MIN_TURNS) continue
        const age = getLilyParticleAgeAfterTurns(initialAge, turns, angularSpeed, options.settings.swirlAcceleration)
        if (age === undefined) continue
        if (age < 0.72 || (!captureMotion && age > LILY_PARTICLE_TAIL_SECONDS)) continue
        if (getLilyParticleFade(age, captureMotion) < LILY_PORTRAIT_CAPTURE_MIN_FADE) continue

        const launchTime = birthTime + age
        const launchPosition = getLilyParticleVortexPosition(position, parts[index]!, seed, launchTime, source, settings, captureMotion)
        const projected = projectPortraitPoint(launchPosition, options.cameraBasisAtTime(launchTime))
        if (projected.depth <= 0 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1
          || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue
        visibleRoute = { index, launchTime, travelDuration: 0.75 + random01(index, 0x510e527f) * 1.1, captureMotion }
        break
      }
      if (visibleRoute) break
    }

    if (visibleRoute) {
      candidates.push(visibleRoute)
    }
  }

  candidates.sort((a, b) => a.launchTime - b.launchTime || a.index - b.index)
  if (candidates.length <= targetCount) return candidates

  // Keep the complete viable time range represented when more sources are
  // visible than the target field can hold.
  return Array.from({ length: targetCount }, (_, targetIndex) =>
    candidates[Math.floor((targetIndex + 0.5) * candidates.length / targetCount)]!,
  )
}

function normalizePortraitCaptureSettings(settings: LilyPortraitCaptureSettings): LilyPortraitCaptureSettings {
  const minTurns = clampFinite(settings.portraitMinTurns, 0, 4, 0)
  const maxTurns = clampFinite(settings.portraitMaxTurns, minTurns, 4, Math.max(2, minTurns))
  return {
    portraitStartProgress: clampFinite(settings.portraitStartProgress, 0, 1, 0.3),
    portraitFraction: clampFinite(settings.portraitFraction, 0, 0.499999, 0.4),
    portraitMinTurns: minTurns,
    portraitMaxTurns: maxTurns,
    portraitSteering: clampFinite(settings.portraitSteering, 0, 2, 1),
    portraitBraking: clampFinite(settings.portraitBraking, 0.25, 2, 1),
    portraitSettledBrightness: clampFinite(settings.portraitSettledBrightness, 0.5, 2, 1.15),
    vortexSpeedMultiplier: clampFinite(settings.vortexSpeedMultiplier, 0, 2, 0.9),
  }
}

function getLilyParticleAgeAfterTurns(startAge: number, turns: number, angularSpeed: number, acceleration: number): number | undefined {
  if (turns <= 0) return startAge
  if (angularSpeed <= 0 && acceleration <= 0) return undefined
  const phaseAt = (age: number) => angularSpeed * age + 0.5 * acceleration * age * age
  const targetPhase = phaseAt(startAge) + turns * Math.PI * 2
  let low = startAge
  let high = Math.max(startAge + 0.25, startAge + turns * Math.PI * 2 / Math.max(0.1, angularSpeed + acceleration * startAge))
  for (let attempt = 0; attempt < 20 && phaseAt(high) < targetPhase; attempt++) high = Math.min(40, high * 1.5 + 0.25)
  if (phaseAt(high) < targetPhase) return undefined
  for (let attempt = 0; attempt < 18; attempt++) {
    const middle = (low + high) * 0.5
    if (phaseAt(middle) < targetPhase) low = middle
    else high = middle
  }
  return high
}

function getLilyParticleDissolveFront(position: readonly [number, number, number], part: number, source: LilySurfaceSource, settings: LilyParticleSettings, edgeWidth: number) {
  const [x, y, z] = position, cx = source.center[0], cz = source.center[2]
  const radial = clamp(Math.hypot(x - cx, z - cz) / Math.max(source.radius, 0.001), 0, 1)
  const height = clamp((y - source.minY) / Math.max(source.maxY - source.minY, 0.001), 0, 1)
  const noise = Math.sin(x * 11.7 + Math.sin(y * 8.3)) * Math.sin(z * 13.1 + y * 7.1) * 0.035
  const phase = part < 0.5 ? 0.08 + (1 - radial) * (0.70 - 0.08)
    : part < 1.5 ? 0.08 + (0.70 - 0.08) * settings.centerDissolveAt + radial * 0.18
      : 0.76 + (1 - height) * 0.18
  return clamp(phase + noise, edgeWidth + 0.002, 0.998 - edgeWidth)
}

/** CPU mirror of the analytic shader path, used once to route screen-space candidates. */
export function getLilyParticleVortexPosition(
  position: readonly [number, number, number],
  part: number,
  seed: number,
  time: number,
  source: LilySurfaceSource,
  settings: LilyParticleSettings & { dissolveDuration: number; edgeWidth: number },
  captureMotion = false,
): [number, number, number] {
  const [x, y, z] = position, cx = source.center[0], cz = source.center[2]
  const radial = clamp(Math.hypot(x - cx, z - cz) / Math.max(source.radius, 0.001), 0, 1)
  const height = clamp((y - source.minY) / Math.max(source.maxY - source.minY, 0.001), 0, 1)
  const noise = Math.sin(x * 11.7 + Math.sin(y * 8.3)) * Math.sin(z * 13.1 + y * 7.1) * 0.035
  const phase = part < 0.5 ? 0.08 + (1 - radial) * (0.70 - 0.08)
    : part < 1.5 ? 0.08 + (0.70 - 0.08) * settings.centerDissolveAt + radial * 0.18
      : 0.76 + (1 - height) * 0.18
  const front = clamp(phase + noise, settings.edgeWidth + 0.002, 0.998 - settings.edgeWidth)
  const dissolveDuration = Math.max(0.001, settings.dissolveDuration)
  const age = Math.max(0, (time / dissolveDuration - front + settings.edgeWidth) * dissolveDuration)
  const detach = smoothstep(0.08, 0.72, age)
  const relativeX = x - cx, relativeZ = z - cz
  const sourceRadius = Math.hypot(relativeX, relativeZ)
  const startAngle = sourceRadius > 0.001 ? Math.atan2(relativeZ, relativeX) : seed * Math.PI * 2
  const angularSpeed = settings.swirlSpeed * clampFinite(settings.vortexSpeedMultiplier ?? 1, 0, 2, 1) * (0.95 + 0.1 * seed)
  const turn = angularSpeed * age + 0.5 * settings.swirlAcceleration * age * age
  const riseAge = captureMotion ? getLilyParticleCaptureRiseAge(age) : age
  const rise = getLilyParticleVerticalRise(riseAge, seed)
  const seedRadius = source.radius * settings.vortexRadius * (0.9 + 0.18 * seed)
  const orbitRadius = getLilyParticleOrbitRadius(sourceRadius, seedRadius, rise, settings.vortexExpansion, detach, source.radius, settings.vortexRadius)
  const depthWobble = 1 + 0.025 * Math.sin(seed * 37 + age * 0.65)
  const angle = startAngle + turn * detach
  return [cx + Math.cos(angle) * orbitRadius * depthWobble, y + rise * detach, cz + Math.sin(angle) * orbitRadius * depthWobble]
}

export interface LilyPortraitRouteState {
  origin: readonly [number, number, number]
  part: number
  seed: number
  target: readonly [number, number, number]
  launchTime: number
  travelDuration: number
  captureMotion?: boolean
}

/** CPU mirror of the GLSL route; it is absolute-time and safe to seek in either direction. */
export function getLilyParticlePortraitPosition(
  route: LilyPortraitRouteState,
  time: number,
  source: LilySurfaceSource,
  settings: LilyParticleSettings & { dissolveDuration: number; edgeWidth: number },
  controls: Partial<Pick<LilyPortraitCaptureSettings, 'portraitSteering' | 'portraitBraking'>> = {},
): [number, number, number] {
  const absoluteTime = Number.isFinite(time) ? Math.max(0, time) : 0
  if (absoluteTime < route.launchTime) {
    return getLilyParticleVortexPosition(route.origin, route.part, route.seed, absoluteTime, source, settings, route.captureMotion)
  }
  const step = 0.005
  const departure = getLilyParticleVortexPosition(route.origin, route.part, route.seed, route.launchTime, source, settings, route.captureMotion)
  const beforeTime = Math.max(0, route.launchTime - step)
  const afterTime = route.launchTime + step
  const before = getLilyParticleVortexPosition(route.origin, route.part, route.seed, beforeTime, source, settings, route.captureMotion)
  const after = getLilyParticleVortexPosition(route.origin, route.part, route.seed, afterTime, source, settings, route.captureMotion)
  const velocity = departure.map((_, axis) => (after[axis]! - before[axis]!) / Math.max(0.001, afterTime - beforeTime)) as [number, number, number]
  const braking = clampFinite(controls.portraitBraking ?? 1, 0.25, 2, 1)
  const steering = clampFinite(controls.portraitSteering ?? 1, 0, 2, 1)
  const duration = Math.max(0.05, route.travelDuration * braking)
  const elapsed = clamp(absoluteTime - route.launchTime, 0, duration)
  const travel = elapsed / duration
  const position = getPortraitHermitePosition(departure, velocity, route.target, elapsed, duration)
  const bend = (steering - 1) * 0.16 * 16 * travel * travel * (1 - travel) * (1 - travel)
  return position.map((value, axis) => value + (route.target[axis]! - departure[axis]!) * bend) as [number, number, number]
}

export function createLilyParticleMaterial(uniforms: LilyDissolveUniforms) {
  return new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { ...uniforms, uPearl: { value: new Color('#FFF4E8') }, uPink: { value: new Color('#F3CBD9') }, uGold: { value: new Color('#D7B77A') } },
    vertexShader: /* glsl */ `
      ${LILY_FIELD}
      uniform float uLilyProgress; uniform float uLilyDuration; uniform float uLilySize; uniform float uLilyDpr;
      uniform float uLilyVortexRadius; uniform float uLilyVortexExpansion;
      uniform float uLilySwirlSpeed; uniform float uLilyVortexSpeedMultiplier; uniform float uLilySwirlAcceleration;
      uniform float uLilySceneTime; uniform float uLilyPortraitStart; uniform float uLilyPortraitDuration;
      uniform float uLilyPortraitBrightness; uniform float uLilyPortraitSize;
      uniform float uLilyPortraitSteering; uniform float uLilyPortraitBraking;
      uniform float uLilyPortraitPointMinSize; uniform float uLilyPortraitPointMaxSize;
      attribute float aPart; attribute float aSeed; attribute vec4 aPortraitTarget; attribute vec4 aPortraitMotion; attribute vec3 aPortraitSourceColor; attribute vec3 aPortraitSeedData; attribute float aPortraitRoute;
      varying float vAlpha; varying float vSeed; varying float vPart; varying float vPortraitMix; varying float vPortraitTone; varying float vPortraitContrast; varying float vPortraitSettled;
      varying float vPortraitTargetSeed; varying float vPortraitFeatureWeight;
      varying vec3 vPortraitSourceColor;
      float lilyCaptureRiseAge(float age) {
        float elapsed = age - ${glslFloat(LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE)};
        if (elapsed <= 0.0) return age;
        float duration = ${glslFloat(LILY_PARTICLE_CAPTURE_SLOWDOWN_DURATION)};
        float finalRate = ${glslFloat(LILY_PARTICLE_CAPTURE_FINAL_RISE_RATE)};
        float t = clamp(elapsed / duration, 0.0, 1.0);
        float integratedRate = t - (1.0 - finalRate) * (t * t * t - 0.5 * t * t * t * t);
        float endAge = ${glslFloat(LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE)} + duration * (0.5 + 0.5 * finalRate);
        return elapsed < duration
          ? ${glslFloat(LILY_PARTICLE_CAPTURE_SLOWDOWN_START_AGE)} + duration * integratedRate
          : endAge + (elapsed - duration) * finalRate;
      }
      vec3 lilyVortexPosition(vec3 origin, float part, float seed, float age, float captureMotion) {
        // Positive XZ angular travel is clockwise from above in Three.js world
        // coordinates (+X right, +Z down-screen).
        float detach = smoothstep(0.08, 0.72, age);
        vec3 relative = origin - uLilyCenter;
        float sourceRadius = length(relative.xz);
        float startAngle = sourceRadius > 0.001 ? atan(relative.z, relative.x) : seed * 6.2831853;
        float angularSpeed = uLilySwirlSpeed * uLilyVortexSpeedMultiplier * mix(0.95, 1.05, seed);
        float turn = angularSpeed * age + 0.5 * uLilySwirlAcceleration * age * age;
        float riseAge = captureMotion > 0.5 ? lilyCaptureRiseAge(age) : age;
        float verticalRise = min(${glslFloat(LILY_PARTICLE_MAX_RISE)}, riseAge * (${glslFloat(LILY_PARTICLE_RISE_LINEAR)} + seed * ${glslFloat(LILY_PARTICLE_RISE_VARIATION)}) + ${glslFloat(LILY_PARTICLE_RISE_ACCELERATION)} * riseAge * riseAge);
        float seedRadius = uLilyRadius * uLilyVortexRadius * mix(0.9, 1.08, seed);
        float uncappedOrbitRadius = mix(sourceRadius, seedRadius + verticalRise * uLilyVortexExpansion, detach);
        float riseAllowance = min(${glslFloat(LILY_VORTEX_RADIUS_CAP_OFFSET)}, verticalRise * uLilyVortexExpansion);
        float radiusCap = max(sourceRadius, uLilyRadius * (uLilyVortexRadius + riseAllowance));
        float orbitRadius = min(uncappedOrbitRadius, radiusCap);
        float depthWobble = 1.0 + 0.025 * sin(seed * 37.0 + age * 0.65);
        float angle = startAngle + turn * detach;
        vec2 orbit = vec2(cos(angle), sin(angle)) * orbitRadius * depthWobble;
        vec3 point = origin;
        point.xz = uLilyCenter.xz + orbit;
        point.y += verticalRise * detach;
        return point;
      }
      vec3 lilyPortraitHermite(vec3 start, vec3 velocity, vec3 target, float t, float duration) {
        float t2 = t * t, t3 = t2 * t;
        return (2.0*t3 - 3.0*t2 + 1.0) * start
          + (t3 - 2.0*t2 + t) * duration * velocity
          + (-2.0*t3 + 3.0*t2) * target;
      }
      void main() {
        float front = lilyThreshold(position, aPart);
        float age = max(0.0, (uLilyProgress - front + uLilyEdge) * uLilyDuration);
        float birth = smoothstep(0.0, 0.16, age);
        float fadeAge = aPortraitSeedData.z > 0.5 ? min(age, ${glslFloat(LILY_PARTICLE_FADE_START_SECONDS)}) : age;
        float fade = 1.0 - smoothstep(${glslFloat(LILY_PARTICLE_FADE_START_SECONDS)}, ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, fadeAge);
        float baseAlpha = birth * fade;
        float portraitMix = 0.0;
        float portraitReveal = 0.0;
        vPortraitTone = aPortraitMotion.z;
        vPortraitContrast = clamp(aPortraitMotion.w - 1.0, 0.0, 1.0);
        float travelDuration = max(0.05, aPortraitMotion.y * clamp(uLilyPortraitBraking, 0.25, 2.0));
        bool portraitLanded = aPortraitMotion.w > 0.5 && uLilySceneTime >= aPortraitMotion.x + travelDuration;
        vec3 p = portraitLanded ? aPortraitTarget.xyz : lilyVortexPosition(position, aPart, aSeed, age, aPortraitSeedData.z);
        if (aPortraitMotion.w > 0.5 && uLilySceneTime >= aPortraitMotion.x) {
          float travel = clamp((uLilySceneTime - aPortraitMotion.x) / travelDuration, 0.0, 1.0);
          if (travel >= 1.0) {
            p = aPortraitTarget.xyz;
          } else {
            float beforeTime = max(0.0, aPortraitMotion.x - 0.005);
            float afterTime = aPortraitMotion.x + 0.005;
            float departureAge = max(0.0, (aPortraitMotion.x / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            float beforeAge = max(0.0, (beforeTime / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            float afterAge = max(0.0, (afterTime / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            vec3 departure = lilyVortexPosition(position, aPart, aSeed, departureAge, aPortraitSeedData.z);
            vec3 beforePoint = lilyVortexPosition(position, aPart, aSeed, beforeAge, aPortraitSeedData.z);
            vec3 afterPoint = lilyVortexPosition(position, aPart, aSeed, afterAge, aPortraitSeedData.z);
            vec3 velocity = (afterPoint - beforePoint) / max(0.001, afterTime - beforeTime);
            float bend = (clamp(uLilyPortraitSteering, 0.0, 2.0) - 1.0) * 0.16 * 16.0 * travel * travel * (1.0 - travel) * (1.0 - travel);
            p = lilyPortraitHermite(departure, velocity, aPortraitTarget.xyz, travel, travelDuration)
              + (aPortraitTarget.xyz - departure) * bend;
          }
          float stage = aPortraitTarget.w;
          float stageOffset = stage < 0.5 ? 0.0 : stage < 1.5 ? ${glslFloat(PORTRAIT_STAGE_OFFSETS[1])}
            : stage < 2.5 ? ${glslFloat(PORTRAIT_STAGE_OFFSETS[2])} : ${glslFloat(PORTRAIT_STAGE_OFFSETS[3])};
          float stageStart = uLilyPortraitStart + stageOffset * uLilyPortraitDuration + travelDuration * 0.2;
          float stageEnd = stage > 2.5 ? uLilyPortraitStart + uLilyPortraitDuration
            : stageStart + uLilyPortraitDuration * ${glslFloat(PORTRAIT_STAGE_WINDOW)};
          portraitReveal = smoothstep(stageStart, max(stageStart + 0.001, stageEnd), uLilySceneTime);
          portraitMix = smoothstep(0.0, 1.0, travel);
        }
        vAlpha = mix(baseAlpha, portraitReveal, portraitMix);
        vPortraitMix = portraitMix;
        float settledElapsed = max(0.0, uLilySceneTime - aPortraitMotion.x - travelDuration);
        float portraitSettled = smoothstep(0.0, ${glslFloat(LILY_PORTRAIT_SETTLED_RAMP_SECONDS)}, settledElapsed);
        vPortraitSettled = aPortraitRoute > 0.5 ? portraitSettled : 0.0;
        vPortraitTargetSeed = aPortraitSeedData.x; vPortraitFeatureWeight = aPortraitSeedData.y;
        vSeed = aSeed; vPart = aPart; vPortraitSourceColor = aPortraitSourceColor;
        vec4 view = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        float sizeAccent = mix(0.82, ${LILY_PARTICLE_MAX_SIZE_ACCENT}, pow(aSeed, 8.0));
        float featureSize = mix(0.92, 1.7, smoothstep(0.1, 0.48, vPortraitContrast));
        float targetSeedSize = mix(0.96, 1.04, vPortraitTargetSeed);
        float portraitSize = mix(1.0, uLilyPortraitSize * featureSize * targetSeedSize, portraitMix);
        float pointSize = uLilySize * sizeAccent * portraitSize * uLilyDpr * (1.0 - 0.5 * clamp(age / ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, 0.0, 1.0)) * 4.0 / max(0.5, -view.z);
        float pointMinSize = mix(1.0, uLilyPortraitPointMinSize, portraitMix);
        float pointMaxSize = mix(${glslFloat(LILY_PARTICLE_MAX_POINT_SIZE)}, uLilyPortraitPointMaxSize, portraitMix);
        gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPearl; uniform vec3 uPink; uniform vec3 uGold; uniform float uLilyParticleBrightness; uniform float uLilyPortraitBrightness; uniform float uLilyPortraitSettledBrightness;
      uniform float uLilyPortraitPhotoColorMix; uniform float uLilyPortraitOpacity; uniform float uLilyPortraitGlow;
      uniform float uLilyPortraitMinimumBrightness; uniform float uLilyPortraitContrast;
      varying float vAlpha; varying float vSeed; varying float vPart; varying float vPortraitMix; varying float vPortraitTone; varying float vPortraitContrast; varying float vPortraitSettled;
      varying float vPortraitTargetSeed; varying float vPortraitFeatureWeight;
      varying vec3 vPortraitSourceColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float softCore = 1.0 - smoothstep(0.1, 0.95, r);
        float portraitCore = 1.0 - smoothstep(0.1, 0.72, r);
        float core = mix(softCore, portraitCore, vPortraitMix);
        float halo = exp(-r * r * 4.8) * 0.18 * mix(1.0, uLilyPortraitGlow, vPortraitMix);
        float haloScale = mix(1.0, 0.55, vPortraitMix);
        float brightnessAccent = mix(0.52, 1.5, pow(vSeed, 8.0));
        float featureAccent = mix(${glslFloat(LILY_PORTRAIT_MIN_FEATURE_ACCENT)}, ${glslFloat(LILY_PORTRAIT_MAX_FEATURE_ACCENT)}, smoothstep(0.1, 0.48, vPortraitContrast));
        float targetFeatureAccent = mix(0.95, 1.05, vPortraitFeatureWeight);
        float portraitBrightness = mix(1.0, uLilyPortraitBrightness * featureAccent * targetFeatureAccent, vPortraitMix);
        float portraitTone = clamp(0.5 + (vPortraitTone - 0.5) * uLilyPortraitContrast, uLilyPortraitMinimumBrightness, 1.0);
        float toneContrast = mix(${glslFloat(LILY_PORTRAIT_MIN_TONE_CONTRAST)}, ${glslFloat(LILY_PORTRAIT_MAX_TONE_CONTRAST)}, smoothstep(0.16, 0.82, portraitTone));
        float sourceContrast = mix(1.0, toneContrast, vPortraitMix);
        float settledBrightness = mix(1.0, uLilyPortraitSettledBrightness, vPortraitSettled);
        float targetSeedAccent = mix(0.98, 1.02, vPortraitTargetSeed);
        float glow = (core + halo * haloScale) * vAlpha * uLilyParticleBrightness * brightnessAccent * portraitBrightness * sourceContrast * settledBrightness * targetSeedAccent;
        if (glow < 0.004) discard;
        vec3 vortexColor = vPart > 0.5 && vPart < 1.5 ? mix(uPearl, uGold, 0.55) : mix(uPearl, uPink, vSeed * 0.55);
        vec3 sourceTone = mix(mix(uGold, uPink, 0.58), uPearl, smoothstep(0.16, 0.9, portraitTone));
        vec3 color = mix(vortexColor, sourceTone, vPortraitMix);
        color = mix(color, vPortraitSourceColor, clamp(uLilyPortraitPhotoColorMix, 0.0, 1.0) * vPortraitMix);
        float opacity = mix(1.0, uLilyPortraitOpacity, vPortraitMix);
        gl_FragColor = vec4(color, min(0.9, glow * 0.58) * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }
function clampFinite(value: number, min: number, max: number, fallback: number) {
  return clamp(Number.isFinite(value) ? value : fallback, min, max)
}
function fract(value: number) { return value - Math.floor(value) }
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
function random01(index: number, salt: number) {
  let value = (Math.imul(index + 1, 0x9e3779b1) + salt) | 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}
