import { BufferAttribute, BufferGeometry, Color, Material, ShaderMaterial, Vector3, AdditiveBlending } from 'three'
import type { LilySurfaceSource } from './particleSource'

export const LILY_PARTICLE_FADE_START_SECONDS = 7
export const LILY_PARTICLE_TAIL_SECONDS = 10.5
export const LILY_PARTICLE_RISE_LINEAR = 0.18
export const LILY_PARTICLE_RISE_VARIATION = 0.03
export const LILY_PARTICLE_RISE_ACCELERATION = 0.075
export const LILY_PARTICLE_MAX_RISE = 5.2
export const LILY_PARTICLE_MAX_POINT_SIZE = 6
export const LILY_PARTICLE_MAX_SIZE_ACCENT = 1.08
export const LILY_VORTEX_RADIUS_CAP_OFFSET = 0.25

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
}

export interface LilyParticleSettings {
  particleBrightness: number
  vortexRadius: number
  vortexExpansion: number
  swirlSpeed: number
  swirlAcceleration: number
  centerDissolveAt: number
}

export function createLilyDissolveUniforms(): LilyDissolveUniforms {
  return { uLilyActive: { value: 0 }, uLilyProgress: { value: 0 }, uLilyEdge: { value: 0.035 },
    uLilyDuration: { value: 12 }, uLilyCenter: { value: new Vector3() }, uLilyRadius: { value: 1 },
    uLilyMinY: { value: 0 }, uLilyMaxY: { value: 1 }, uLilySize: { value: 2.3 }, uLilyDpr: { value: 1 },
    uLilyParticleBrightness: { value: 1.25 }, uLilyVortexRadius: { value: 0.8 },
    uLilyVortexExpansion: { value: 0.45 }, uLilySwirlSpeed: { value: 1 },
    uLilySwirlAcceleration: { value: 0.1 }, uLilyCenterDissolveAt: { value: 0.5 } }
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

export function updateLilyParticleSettings(uniforms: LilyDissolveUniforms, settings: LilyParticleSettings) {
  uniforms.uLilyParticleBrightness.value = settings.particleBrightness
  uniforms.uLilyVortexRadius.value = settings.vortexRadius
  uniforms.uLilyVortexExpansion.value = settings.vortexExpansion
  uniforms.uLilySwirlSpeed.value = settings.swirlSpeed
  uniforms.uLilySwirlAcceleration.value = settings.swirlAcceleration
  uniforms.uLilyCenterDissolveAt.value = settings.centerDissolveAt
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

export function createLilyParticleGeometry(source: LilySurfaceSource, count: number) {
  const positions = new Float32Array(count * 3), parts = new Float32Array(count), seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const sample = source.sampleSurface(i, count)
    positions.set(sample.position, i * 3); parts[i] = sample.part
    seeds[i] = ((i * 16807) % 65521) / 65521
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPart', new BufferAttribute(parts, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  return geometry
}

export function createLilyParticleMaterial(uniforms: LilyDissolveUniforms) {
  return new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { ...uniforms, uPearl: { value: new Color('#FFF4E8') }, uPink: { value: new Color('#F3CBD9') }, uGold: { value: new Color('#D7B77A') } },
    vertexShader: /* glsl */ `
      ${LILY_FIELD}
      uniform float uLilyProgress; uniform float uLilyDuration; uniform float uLilySize; uniform float uLilyDpr;
      uniform float uLilyVortexRadius; uniform float uLilyVortexExpansion;
      uniform float uLilySwirlSpeed; uniform float uLilySwirlAcceleration;
      attribute float aPart; attribute float aSeed; varying float vAlpha; varying float vSeed; varying float vPart;
      void main() {
        float front = lilyThreshold(position, aPart);
        float age = max(0.0, (uLilyProgress - front + uLilyEdge) * uLilyDuration);
        float birth = smoothstep(0.0, 0.16, age);
        float fade = 1.0 - smoothstep(${glslFloat(LILY_PARTICLE_FADE_START_SECONDS)}, ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, age);
        vAlpha = birth * fade; vSeed = aSeed; vPart = aPart;
        // Preserve the flower outline as particles form, then let every particle
        // join the same upward spiral. Positive XZ angular travel is clockwise
        // from above in Three.js world coordinates (+X right, +Z down-screen).
        float detach = smoothstep(0.08, 0.72, age);
        vec3 relative = position - uLilyCenter;
        float sourceRadius = length(relative.xz);
        float startAngle = sourceRadius > 0.001 ? atan(relative.z, relative.x) : aSeed * 6.2831853;
        float angularSpeed = uLilySwirlSpeed * mix(0.95, 1.05, aSeed);
        float turn = angularSpeed * age + 0.5 * uLilySwirlAcceleration * age * age;
        float verticalRise = min(${glslFloat(LILY_PARTICLE_MAX_RISE)}, age * (${glslFloat(LILY_PARTICLE_RISE_LINEAR)} + aSeed * ${glslFloat(LILY_PARTICLE_RISE_VARIATION)}) + ${glslFloat(LILY_PARTICLE_RISE_ACCELERATION)} * age * age);
        float seedRadius = uLilyRadius * uLilyVortexRadius * mix(0.9, 1.08, aSeed);
        float uncappedOrbitRadius = mix(sourceRadius, seedRadius + verticalRise * uLilyVortexExpansion, detach);
        float riseAllowance = min(${glslFloat(LILY_VORTEX_RADIUS_CAP_OFFSET)}, verticalRise * uLilyVortexExpansion);
        float radiusCap = max(sourceRadius, uLilyRadius * (uLilyVortexRadius + riseAllowance));
        float orbitRadius = min(uncappedOrbitRadius, radiusCap);
        float depthWobble = 1.0 + 0.025 * sin(aSeed * 37.0 + age * 0.65);
        float angle = startAngle + turn * detach;
        vec2 orbit = vec2(cos(angle), sin(angle)) * orbitRadius * depthWobble;
        vec3 p = position;
        p.xz = uLilyCenter.xz + orbit;
        p.y += verticalRise * detach;
        vec4 view = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        float sizeAccent = mix(0.82, ${LILY_PARTICLE_MAX_SIZE_ACCENT}, pow(aSeed, 8.0));
        gl_PointSize = clamp(uLilySize * sizeAccent * uLilyDpr * (1.0 - 0.5 * clamp(age / ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, 0.0, 1.0)) * 4.0 / max(0.5, -view.z), 1.0, ${glslFloat(LILY_PARTICLE_MAX_POINT_SIZE)});
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPearl; uniform vec3 uPink; uniform vec3 uGold; uniform float uLilyParticleBrightness;
      varying float vAlpha; varying float vSeed; varying float vPart;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float softCore = 1.0 - smoothstep(0.1, 0.95, r);
        float halo = exp(-r * r * 4.8) * 0.18;
        float brightnessAccent = mix(0.52, 1.5, pow(vSeed, 8.0));
        float glow = (softCore + halo) * vAlpha * uLilyParticleBrightness * brightnessAccent;
        if (glow < 0.004) discard;
        vec3 color = vPart > 0.5 && vPart < 1.5 ? mix(uPearl, uGold, 0.55) : mix(uPearl, uPink, vSeed * 0.55);
        gl_FragColor = vec4(color, min(0.9, glow * 0.58));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}
