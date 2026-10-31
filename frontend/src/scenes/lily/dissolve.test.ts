import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3, type WebGLRenderer } from 'three'
import { expect, it } from 'vitest'
import { getBloomCloseupPose } from '../../engine/bloomCamera'
import { getIdentityCameraMoveTarget } from '../../engine/identityCamera'
import { createLilyGeometryParticleSource } from './particleSource'
import { createLilyDissolveUniforms, createLilyParticleGeometry, createLilyParticleMaterial, getLilyParticleOrbitRadius, getLilyParticleVerticalRise, glslFloat, LILY_FIELD, LILY_PARTICLE_FADE_START_SECONDS, LILY_PARTICLE_MAX_POINT_SIZE, LILY_PARTICLE_MAX_SIZE_ACCENT, LILY_PARTICLE_TAIL_SECONDS, LILY_PORTRAIT_MIN_FEATURE_ACCENT, LILY_PORTRAIT_MIN_TONE_CONTRAST, LILY_VORTEX_RADIUS_CAP_OFFSET, patchLilyMaterial, updateLilyDissolve, updateLilyParticleSettings, updateLilyPortraitSettings } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import { createPortraitCameraBasis } from './portraitTargets'
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
  expect(material.fragmentShader).toContain('float toneContrast = mix(0.95, 1.15, smoothstep(0.16, 0.82, vPortraitTone))')
  expect(material.vertexShader).toContain('vPortraitContrast = clamp(aPortraitMotion.w - 1.0, 0.0, 1.0)')
  expect(material.vertexShader).toContain('float featureSize = mix(0.92, 1.7, smoothstep(0.1, 0.48, vPortraitContrast))')
  expect(material.vertexShader).toContain('float portraitSize = mix(1.0, uLilyPortraitSize * featureSize, portraitMix)')
  expect(material.vertexShader).toContain('uLilySize * sizeAccent * portraitSize * uLilyDpr')
  expect(material.vertexShader).toMatch(/bool portraitLanded = .*;[\s\S]*?if \(travel >= 1\.0\) \{\s*p = aPortraitTarget\.xyz;/)
  const travelBranch = material.vertexShader.slice(material.vertexShader.indexOf('if (travel >= 1.0)'), material.vertexShader.indexOf('float stage ='))
  expect(travelBranch).toMatch(/\} else \{[\s\S]*lilyVortexPosition\(position, aPart, aSeed, departureAge\);[\s\S]*lilyVortexPosition\(position, aPart, aSeed, beforeAge\);[\s\S]*lilyVortexPosition\(position, aPart, aSeed, afterAge\);/)
  expect(material.fragmentShader).toContain('float featureAccent = mix(1.0, 1.8, smoothstep(0.1, 0.48, vPortraitContrast))')
  expect(1.1 * LILY_PORTRAIT_MIN_TONE_CONTRAST * LILY_PORTRAIT_MIN_FEATURE_ACCENT).toBeGreaterThan(1)
  expect(material.fragmentShader).toContain('portraitBrightness * sourceContrast')
  expect(LILY_FIELD).toContain('mix(petalStart, petalEnd, uLilyCenterDissolveAt) + radial * 0.18')
  expect(material.vertexShader).toContain('verticalRise * detach')
  expect(material.vertexShader).toContain('float fade = 1.0 - smoothstep(7.0, 10.5, age)')
  expect(material.vertexShader).toContain('uLilySwirlSpeed * mix(0.95, 1.05, seed)')
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

it('keeps dark photo-derived portrait details visible within bounded emission', () => {
  const material = createLilyParticleMaterial(createLilyDissolveUniforms())

  expect(material.fragmentShader).toContain('float toneContrast = mix(0.95, 1.15, smoothstep(0.16, 0.82, vPortraitTone))')
  expect(material.fragmentShader).toContain('gl_FragColor = vec4(color, min(0.9, glow * 0.58))')
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
  expect(main).toContain('vec3 p = portraitLanded ? aPortraitTarget.xyz : lilyVortexPosition(position, aPart, aSeed, age);')
  expect(main).not.toContain('float detach = smoothstep(0.08, 0.72, age);')
  material.dispose()
})
