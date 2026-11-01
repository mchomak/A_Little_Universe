import { BufferAttribute, BufferGeometry, Color, Material, ShaderMaterial, Vector3, AdditiveBlending } from 'three'
import type { LilySurfaceSource } from './particleSource'
import { PORTRAIT_STAGE_OFFSETS, PORTRAIT_STAGE_WINDOW, projectPortraitPoint, selectPortraitCandidates, type PortraitCameraBasis, type PortraitTarget } from './portraitTargets'

export const LILY_PARTICLE_FADE_START_SECONDS = 7
export const LILY_PARTICLE_TAIL_SECONDS = 10.5
export const LILY_PARTICLE_RISE_LINEAR = 0.18
export const LILY_PARTICLE_RISE_VARIATION = 0.03
export const LILY_PARTICLE_RISE_ACCELERATION = 0.075
export const LILY_PARTICLE_MAX_RISE = 5.2
export const LILY_PARTICLE_MAX_POINT_SIZE = 6
export const LILY_PARTICLE_MAX_SIZE_ACCENT = 1.08
export const LILY_VORTEX_RADIUS_CAP_OFFSET = 0.25
export const LILY_PORTRAIT_MIN_TONE_CONTRAST = 0.95
export const LILY_PORTRAIT_MAX_TONE_CONTRAST = 1.15
export const LILY_PORTRAIT_MIN_FEATURE_ACCENT = 1
export const LILY_PORTRAIT_MAX_FEATURE_ACCENT = 1.8

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
  uLilySwirlAcceleration: { value: number }; uLilyCenterDissolveAt: { value: number }
  uLilySceneTime: { value: number }; uLilyPortraitStart: { value: number }; uLilyPortraitDuration: { value: number }
  uLilyPortraitBrightness: { value: number }; uLilyPortraitSize: { value: number }
  uLilyPortraitPhotoColorMix: { value: number }; uLilyPortraitOpacity: { value: number }
  uLilyPortraitGlow: { value: number }; uLilyPortraitPointMinSize: { value: number }; uLilyPortraitPointMaxSize: { value: number }
}

export interface LilyParticleSettings {
  particleBrightness: number
  vortexRadius: number
  vortexExpansion: number
  swirlSpeed: number
  swirlAcceleration: number
  centerDissolveAt: number
}

export interface LilyPortraitGeometryOptions {
  targets: readonly PortraitTarget[]
  targetPositions: readonly [number, number, number][]
  fraction: number
  start: number
  duration: number
  dissolveDuration: number
  edgeWidth: number
  cameraBasis: PortraitCameraBasis
  settings: LilyParticleSettings
}

export interface LilyPortraitAppearanceSettings {
  photoColorMix: number
  opacity: number
  glow: number
  minSize: number
  maxSize: number
}

export function createLilyDissolveUniforms(): LilyDissolveUniforms {
  return { uLilyActive: { value: 0 }, uLilyProgress: { value: 0 }, uLilyEdge: { value: 0.035 },
    uLilyDuration: { value: 12 }, uLilyCenter: { value: new Vector3() }, uLilyRadius: { value: 1 },
    uLilyMinY: { value: 0 }, uLilyMaxY: { value: 1 }, uLilySize: { value: 2.3 }, uLilyDpr: { value: 1 },
    uLilyParticleBrightness: { value: 1.25 }, uLilyVortexRadius: { value: 0.8 },
    uLilyVortexExpansion: { value: 0.45 }, uLilySwirlSpeed: { value: 1 },
    uLilySwirlAcceleration: { value: 0.1 }, uLilyCenterDissolveAt: { value: 0.5 },
    uLilySceneTime: { value: 0 }, uLilyPortraitStart: { value: 12 }, uLilyPortraitDuration: { value: 8.5 },
    uLilyPortraitBrightness: { value: 1.8 }, uLilyPortraitSize: { value: 1.8 },
    uLilyPortraitPhotoColorMix: { value: 0 }, uLilyPortraitOpacity: { value: 1 },
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
  portraitSourceColors.fill(1)
  for (let i = 0; i < count; i++) {
    const sample = source.sampleSurface(i, count)
    positions.set(sample.position, i * 3); parts[i] = sample.part
    seeds[i] = ((i * 16807) % 65521) / 65521
  }
  if (portrait) {
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
      // The fourth lane keeps the route marker in its integer part and stores
      // sampled photo contrast in its fractional part without another buffer.
      portraitMotion.set([routeStart, travelDuration, target.tone, 1 + clamp(target.contrast ?? 0, 0, 1)], i4)
    })
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPart', new BufferAttribute(parts, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aPortraitTarget', new BufferAttribute(portraitTargets, 4))
  geometry.setAttribute('aPortraitMotion', new BufferAttribute(portraitMotion, 4))
  geometry.setAttribute('aPortraitSourceColor', new BufferAttribute(portraitSourceColors, 3))
  return geometry
}

/** CPU mirror of the analytic shader path, used once to route screen-space candidates. */
export function getLilyParticleVortexPosition(
  position: readonly [number, number, number],
  part: number,
  seed: number,
  time: number,
  source: LilySurfaceSource,
  settings: LilyParticleSettings & { dissolveDuration: number; edgeWidth: number },
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
  const angularSpeed = settings.swirlSpeed * (0.95 + 0.1 * seed)
  const turn = angularSpeed * age + 0.5 * settings.swirlAcceleration * age * age
  const rise = getLilyParticleVerticalRise(age, seed)
  const seedRadius = source.radius * settings.vortexRadius * (0.9 + 0.18 * seed)
  const orbitRadius = getLilyParticleOrbitRadius(sourceRadius, seedRadius, rise, settings.vortexExpansion, detach, source.radius, settings.vortexRadius)
  const depthWobble = 1 + 0.025 * Math.sin(seed * 37 + age * 0.65)
  const angle = startAngle + turn * detach
  return [cx + Math.cos(angle) * orbitRadius * depthWobble, y + rise * detach, cz + Math.sin(angle) * orbitRadius * depthWobble]
}

export function createLilyParticleMaterial(uniforms: LilyDissolveUniforms) {
  return new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { ...uniforms, uPearl: { value: new Color('#FFF4E8') }, uPink: { value: new Color('#F3CBD9') }, uGold: { value: new Color('#D7B77A') } },
    vertexShader: /* glsl */ `
      ${LILY_FIELD}
      uniform float uLilyProgress; uniform float uLilyDuration; uniform float uLilySize; uniform float uLilyDpr;
      uniform float uLilyVortexRadius; uniform float uLilyVortexExpansion;
      uniform float uLilySwirlSpeed; uniform float uLilySwirlAcceleration;
      uniform float uLilySceneTime; uniform float uLilyPortraitStart; uniform float uLilyPortraitDuration;
      uniform float uLilyPortraitBrightness; uniform float uLilyPortraitSize;
      uniform float uLilyPortraitPointMinSize; uniform float uLilyPortraitPointMaxSize;
      attribute float aPart; attribute float aSeed; attribute vec4 aPortraitTarget; attribute vec4 aPortraitMotion; attribute vec3 aPortraitSourceColor;
      varying float vAlpha; varying float vSeed; varying float vPart; varying float vPortraitMix; varying float vPortraitTone; varying float vPortraitContrast;
      varying vec3 vPortraitSourceColor;
      vec3 lilyVortexPosition(vec3 origin, float part, float seed, float age) {
        // Positive XZ angular travel is clockwise from above in Three.js world
        // coordinates (+X right, +Z down-screen).
        float detach = smoothstep(0.08, 0.72, age);
        vec3 relative = origin - uLilyCenter;
        float sourceRadius = length(relative.xz);
        float startAngle = sourceRadius > 0.001 ? atan(relative.z, relative.x) : seed * 6.2831853;
        float angularSpeed = uLilySwirlSpeed * mix(0.95, 1.05, seed);
        float turn = angularSpeed * age + 0.5 * uLilySwirlAcceleration * age * age;
        float verticalRise = min(${glslFloat(LILY_PARTICLE_MAX_RISE)}, age * (${glslFloat(LILY_PARTICLE_RISE_LINEAR)} + seed * ${glslFloat(LILY_PARTICLE_RISE_VARIATION)}) + ${glslFloat(LILY_PARTICLE_RISE_ACCELERATION)} * age * age);
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
        float fade = 1.0 - smoothstep(${glslFloat(LILY_PARTICLE_FADE_START_SECONDS)}, ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, age);
        float baseAlpha = birth * fade;
        float portraitMix = 0.0;
        float portraitReveal = 0.0;
        vPortraitTone = aPortraitMotion.z;
        vPortraitContrast = clamp(aPortraitMotion.w - 1.0, 0.0, 1.0);
        bool portraitLanded = aPortraitMotion.w > 0.5 && uLilySceneTime >= aPortraitMotion.x + aPortraitMotion.y;
        vec3 p = portraitLanded ? aPortraitTarget.xyz : lilyVortexPosition(position, aPart, aSeed, age);
        if (aPortraitMotion.w > 0.5 && uLilySceneTime >= aPortraitMotion.x) {
          float travelDuration = max(0.05, aPortraitMotion.y);
          float travel = clamp((uLilySceneTime - aPortraitMotion.x) / travelDuration, 0.0, 1.0);
          if (travel >= 1.0) {
            p = aPortraitTarget.xyz;
          } else {
            float departureAge = max(0.0, (aPortraitMotion.x / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            float beforeTime = max(0.0, aPortraitMotion.x - 0.015);
            float afterTime = aPortraitMotion.x + 0.015;
            float beforeAge = max(0.0, (beforeTime / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            float afterAge = max(0.0, (afterTime / uLilyDuration - front + uLilyEdge) * uLilyDuration);
            vec3 departure = lilyVortexPosition(position, aPart, aSeed, departureAge);
            vec3 beforePoint = lilyVortexPosition(position, aPart, aSeed, beforeAge);
            vec3 afterPoint = lilyVortexPosition(position, aPart, aSeed, afterAge);
            vec3 velocity = (afterPoint - beforePoint) / max(0.03, afterTime - beforeTime);
            p = lilyPortraitHermite(departure, velocity, aPortraitTarget.xyz, travel, travelDuration);
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
        vSeed = aSeed; vPart = aPart; vPortraitSourceColor = aPortraitSourceColor;
        vec4 view = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        float sizeAccent = mix(0.82, ${LILY_PARTICLE_MAX_SIZE_ACCENT}, pow(aSeed, 8.0));
        float featureSize = mix(0.92, 1.7, smoothstep(0.1, 0.48, vPortraitContrast));
        float portraitSize = mix(1.0, uLilyPortraitSize * featureSize, portraitMix);
        float pointSize = uLilySize * sizeAccent * portraitSize * uLilyDpr * (1.0 - 0.5 * clamp(age / ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, 0.0, 1.0)) * 4.0 / max(0.5, -view.z);
        float pointMinSize = mix(1.0, uLilyPortraitPointMinSize, portraitMix);
        float pointMaxSize = mix(${glslFloat(LILY_PARTICLE_MAX_POINT_SIZE)}, uLilyPortraitPointMaxSize, portraitMix);
        gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPearl; uniform vec3 uPink; uniform vec3 uGold; uniform float uLilyParticleBrightness; uniform float uLilyPortraitBrightness;
      uniform float uLilyPortraitPhotoColorMix; uniform float uLilyPortraitOpacity; uniform float uLilyPortraitGlow;
      varying float vAlpha; varying float vSeed; varying float vPart; varying float vPortraitMix; varying float vPortraitTone; varying float vPortraitContrast;
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
        float portraitBrightness = mix(1.0, uLilyPortraitBrightness * featureAccent, vPortraitMix);
        float toneContrast = mix(${glslFloat(LILY_PORTRAIT_MIN_TONE_CONTRAST)}, ${glslFloat(LILY_PORTRAIT_MAX_TONE_CONTRAST)}, smoothstep(0.16, 0.82, vPortraitTone));
        float sourceContrast = mix(1.0, toneContrast, vPortraitMix);
        float glow = (core + halo * haloScale) * vAlpha * uLilyParticleBrightness * brightnessAccent * portraitBrightness * sourceContrast;
        if (glow < 0.004) discard;
        vec3 vortexColor = vPart > 0.5 && vPart < 1.5 ? mix(uPearl, uGold, 0.55) : mix(uPearl, uPink, vSeed * 0.55);
        vec3 sourceTone = mix(mix(uGold, uPink, 0.58), uPearl, smoothstep(0.16, 0.9, vPortraitTone));
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
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
