import { BufferAttribute, BufferGeometry, Color, Material, ShaderMaterial, Vector3, AdditiveBlending } from 'three'
import type { LilySurfaceSource } from './particleSource'

export const LILY_PARTICLE_TAIL_SECONDS = 6.5

/** The same world-space threshold drives the GLB fragments and its sampled particles. */
export const LILY_FIELD = /* glsl */ `
uniform vec3 uLilyCenter;
uniform float uLilyRadius;
uniform float uLilyMinY;
uniform float uLilyMaxY;
uniform float uLilyEdge;
float lilyThreshold(vec3 p, float part) {
  float radial = clamp(length(p.xz - uLilyCenter.xz) / max(uLilyRadius, 0.001), 0.0, 1.0);
  float height = clamp((p.y - uLilyMinY) / max(uLilyMaxY - uLilyMinY, 0.001), 0.0, 1.0);
  float noise = (sin(p.x * 11.7 + sin(p.y * 8.3)) * sin(p.z * 13.1 + p.y * 7.1)) * 0.035;
  float phase = part < 0.5 ? 0.08 + (1.0 - radial) * 0.62
    : part < 1.5 ? 0.61 + (1.0 - radial) * 0.19
    : 0.76 + (1.0 - height) * 0.18;
  return clamp(phase + noise, uLilyEdge + 0.002, 0.998 - uLilyEdge);
}
`

export interface LilyDissolveUniforms {
  uLilyActive: { value: number }; uLilyProgress: { value: number }; uLilyEdge: { value: number }
  uLilyDuration: { value: number }; uLilyCenter: { value: Vector3 }; uLilyRadius: { value: number }
  uLilyMinY: { value: number }; uLilyMaxY: { value: number }; uLilySize: { value: number }
  uLilyDpr: { value: number }
}

export function createLilyDissolveUniforms(): LilyDissolveUniforms {
  return { uLilyActive: { value: 0 }, uLilyProgress: { value: 0 }, uLilyEdge: { value: 0.035 },
    uLilyDuration: { value: 12 }, uLilyCenter: { value: new Vector3() }, uLilyRadius: { value: 1 },
    uLilyMinY: { value: 0 }, uLilyMaxY: { value: 1 }, uLilySize: { value: 2.3 }, uLilyDpr: { value: 1 } }
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
      attribute float aPart; attribute float aSeed; varying float vAlpha; varying float vSeed; varying float vPart;
      void main() {
        float front = lilyThreshold(position, aPart);
        float age = max(0.0, (uLilyProgress - front + uLilyEdge) * uLilyDuration);
        float birth = smoothstep(0.0, 0.16, age);
        float fade = 1.0 - smoothstep(4.5, ${LILY_PARTICLE_TAIL_SECONDS}, age);
        vAlpha = birth * fade; vSeed = aSeed; vPart = aPart;
        // Preserve the flower outline as particles form, then let every particle
        // join the same upward spiral. Positive XZ angular travel is clockwise
        // from above in Three.js world coordinates (+X right, +Z down-screen).
        float detach = smoothstep(0.08, 0.72, age);
        vec3 relative = position - uLilyCenter;
        float sourceRadius = length(relative.xz);
        float startAngle = sourceRadius > 0.001 ? atan(relative.z, relative.x) : aSeed * 6.2831853;
        float angularSpeed = 1.75 + aSeed * 0.65;
        float turn = angularSpeed * age + 0.5 * 0.34 * age * age;
        float targetRadius = uLilyRadius * (0.28 + aSeed * 0.42);
        float orbitRadius = mix(sourceRadius, targetRadius, detach);
        float verticalRise = age * (0.38 + aSeed * 0.1) + 0.045 * age * age;
        float funnel = mix(1.0, 0.62, smoothstep(1.2, 4.8, verticalRise));
        float angle = startAngle + turn * detach;
        vec2 orbit = vec2(cos(angle), sin(angle)) * orbitRadius * funnel;
        vec3 p = position;
        p.xz = uLilyCenter.xz + orbit;
        p.y += verticalRise * detach;
        vec4 view = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(uLilySize * uLilyDpr * (1.0 - 0.5 * clamp(age / ${LILY_PARTICLE_TAIL_SECONDS}, 0.0, 1.0)) * 4.0 / max(0.5, -view.z), 1.0, 12.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPearl; uniform vec3 uPink; uniform vec3 uGold;
      varying float vAlpha; varying float vSeed; varying float vPart;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float glow = (1.0 - smoothstep(0.0, 1.0, r)) * vAlpha;
        if (glow < 0.004) discard;
        vec3 color = vPart > 0.5 && vPart < 1.5 ? mix(uPearl, uGold, 0.55) : mix(uPearl, uPink, vSeed * 0.55);
        gl_FragColor = vec4(color, glow * 0.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}
