import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3, type WebGLRenderer } from 'three'
import { expect, it } from 'vitest'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import { createLilyGeometryParticleSource } from './particleSource'
import { createLilyDissolveUniforms, createLilyParticleGeometry, createLilyParticleMaterial, getLilyParticleOrbitRadius, getLilyParticleVerticalRise, glslFloat, LILY_FIELD, LILY_PARTICLE_FADE_START_SECONDS, LILY_PARTICLE_MAX_POINT_SIZE, LILY_PARTICLE_MAX_SIZE_ACCENT, LILY_PARTICLE_TAIL_SECONDS, LILY_VORTEX_RADIUS_CAP_OFFSET, patchLilyMaterial, updateLilyDissolve, updateLilyParticleSettings } from './dissolve'
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
  expect(material.vertexShader).toContain('uLilyRadius * uLilyVortexRadius * mix(0.9, 1.08, aSeed)')
  expect(material.vertexShader).toContain('min(0.25, verticalRise * uLilyVortexExpansion)')
  expect(material.vertexShader).toContain('uLilyRadius * (uLilyVortexRadius + riseAllowance)')
  expect(material.vertexShader).toContain('verticalRise * uLilyVortexExpansion')
  expect(material.vertexShader).toContain('pow(aSeed, 8.0)')
  expect(material.fragmentShader).toContain('uLilyParticleBrightness * brightnessAccent')
  expect(LILY_FIELD).toContain('mix(petalStart, petalEnd, uLilyCenterDissolveAt) + radial * 0.18')
  expect(material.vertexShader).toContain('verticalRise * detach')
  expect(material.vertexShader).toContain('float fade = 1.0 - smoothstep(7.0, 10.5, age)')
  expect(material.vertexShader).toContain('uLilySwirlSpeed * mix(0.95, 1.05, aSeed)')
  expect(material.vertexShader).toContain('float depthWobble = 1.0 + 0.025 * sin')
  expect(material.vertexShader).toContain('float sizeAccent = mix(0.82, 1.08, pow(aSeed, 8.0))')
  expect(material.vertexShader).toContain('1.0, 6.0)')
  expect(material.vertexShader).toContain('age / 10.5')
  expect(material.fragmentShader).toContain('mix(0.52, 1.5, pow(vSeed, 8.0))')
  expect(material.fragmentShader).toContain('gl_FragColor = vec4(color, min(0.9, glow * 0.58))')
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
