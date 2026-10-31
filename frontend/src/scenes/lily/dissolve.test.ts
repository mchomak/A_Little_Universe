import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3, type WebGLRenderer } from 'three'
import { expect, it } from 'vitest'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import { createLilyGeometryParticleSource } from './particleSource'
import { createLilyDissolveUniforms, createLilyParticleGeometry, createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, patchLilyMaterial, updateLilyDissolve } from './dissolve'
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
  updateLilyDissolve(uniforms, true, 12, 12, 0.035)
  expect(uniforms.uLilyProgress.value).toBe(1)
  updateLilyDissolve(uniforms, true, 3, 12, 0.035)
  expect(uniforms.uLilyProgress.value).toBe(0.25)
  expect(material.vertexShader).toContain('float turn = angularSpeed * age + 0.5 * 0.34 * age * age')
  expect(material.vertexShader).toContain('verticalRise * detach')
  expect(material.vertexShader).toContain('float fade = 1.0 - smoothstep(4.5, 6.5, age)')
  expect(LILY_PARTICLE_TAIL_SECONDS).toBe(6.5)
  updateLilyDissolve(uniforms, false, 3, 12, 0.035)
  expect(uniforms.uLilyActive.value).toBe(0)
  expect(uniforms.uLilyProgress.value).toBe(0)
  material.dispose()
})

it('projects positive XZ swirl clockwise in the elevated camera view', () => {
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes
  const start = getBloomCloseupPose(settings.bloom)
  const end = getIdentityCameraMoveTarget(start, settings.identity)
  const camera = new PerspectiveCamera(38, 4 / 3, 0.1, 100)
  camera.position.set(end.x, end.y, end.z)
  camera.lookAt(end.tx, end.ty, end.tz)

  const center = new Vector3(start.tx, start.ty, start.tz)
  const radius = 0.5, angle = 0.15
  const atRight = center.clone().add(new Vector3(radius, 0, 0)).project(camera)
  const afterPositiveTurn = center.clone().add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)).project(camera)

  // With +X at screen-right, a clockwise turn moves the point down the image.
  expect(atRight.x).toBeGreaterThan(0)
  expect(afterPositiveTurn.y).toBeLessThan(atRight.y)
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
