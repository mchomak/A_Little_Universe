import { readFileSync } from 'node:fs'
import { AnimationClip, Group, LoopOnce, LoopRepeat, Mesh, Vector3, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { expect, it } from 'vitest'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getGrowthClipTime, getSyncedBloomClipTime } from '../../scenes/lily/animationTiming'
import { LilyAnimationPlayer } from '../../scenes/lily/animationPlayer'
import { createLilyGrowthVfx, getGrowthVfxBirthTime } from '../../scenes/lily/lilyGrowthVfx'
import { createLilyGeometryParticleSource } from '../../scenes/lily/particleSource'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'

interface GlbDocument {
  accessors: Array<{ max?: number[] }>
  animations: Array<{
    name: string
    samplers: Array<{ input: number }>
    channels: Array<{ target: { path: string } }>
  }>
}

it('ships the approved GLB with the exact six source clips and expected durations', () => {
  const bytes = readFileSync(new URL('./lily_004_final.glb', import.meta.url))
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
  expect(bytes.readUInt32LE(4)).toBe(2)
  expect(bytes.readUInt32LE(8)).toBe(bytes.byteLength)
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a)
  const jsonLength = bytes.readUInt32LE(12)
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as GlbDocument
  const clips = Object.fromEntries(document.animations.map((animation) => [animation.name, animation]))

  expect(Object.keys(clips).sort()).toEqual(['Bloom', 'DissolveReady', 'Growth', 'IdleClosed', 'IdleOpen', 'TouchResponse'].sort())
  expect(Object.fromEntries(Object.entries(clips).map(([name, clip]) => [name,
    Math.max(...clip.samplers.map(({ input }) => document.accessors[input]?.max?.[0] ?? 0)),
  ]))).toEqual({ Growth: 9, IdleClosed: 8, TouchResponse: 2, Bloom: 16, IdleOpen: 8, DissolveReady: 1 })
  for (const name of ['Growth', 'IdleClosed', 'Bloom']) {
    expect(clips[name]!.channels.length).toBeGreaterThan(0)
    expect(clips[name]!.channels.every(({ target }) => ['translation', 'rotation', 'scale', 'weights'].includes(target.path))).toBe(true)
  }
})

it('keeps the actual Growth and Bloom clip poses stable across endpoint, forward, and backward seeks', async () => {
  const source = readFileSync(new URL('./lily_004_final.glb', import.meta.url))
  const gltf = await parseAnimationFixture(source)
  const player = new LilyAnimationPlayer(gltf.scene, gltf.animations)
  const growthClip = gltf.animations.find(({ name }) => name === 'Growth')!
  const bloomClip = gltf.animations.find(({ name }) => name === 'Bloom')!
  const growthFrames = getGrowthSceneFrames()
  const bloomFrames = getBloomSceneFrames()
  const head = gltf.scene.getObjectByName('Head_Root')!
  const petals = gltf.scene.getObjectByName('Petals') as Object3D & { morphTargetInfluences?: number[] }

  player.play('Growth', LoopOnce, 1)
  const growthPose = (time: number) => {
    player.seek(getGrowthClipTime(time, growthFrames, growthClip.duration))
    return head.scale.x
  }
  expect(growthPose(growthFrames.model[0] + 7.8)).toBeGreaterThan(0.1)
  const fullGrowth = growthPose(growthFrames.model[1])
  expect(fullGrowth).toBeCloseTo(1, 3)
  expect(growthPose(growthFrames.model[1] + 0.3)).toBeCloseTo(fullGrowth, 3)
  expect(growthPose(growthFrames.duration)).toBeCloseTo(fullGrowth, 3)
  growthPose(growthFrames.model[0] + 7.8)
  expect(growthPose(growthFrames.duration)).toBeCloseTo(fullGrowth, 3)

  player.play('Bloom', LoopOnce, 1)
  const bloomPose = (time: number) => {
    player.seek(getSyncedBloomClipTime(time, bloomFrames.opening, bloomClip.duration, false, 10.7, 0.67))
    return petals.morphTargetInfluences?.[6] ?? 0
  }
  player.seek(getSyncedBloomClipTime(10.7, bloomFrames.opening, bloomClip.duration, false, 10.7, 0.67))
  const closedWeights = petals.morphTargetInfluences!.slice(0, 6)
  const visualOpenness = 1 - closedWeights.reduce((sum, value) => sum + value, 0) / closedWeights.length
  expect(visualOpenness).toBeGreaterThan(0.65)
  expect(visualOpenness).toBeLessThan(0.7)
  expect(bloomPose(15.7)).toBeGreaterThan(0.98)
  const fullyOpen = bloomPose(16)
  expect(fullyOpen).toBeCloseTo(1, 3)
  expect(bloomPose(16.1)).toBeCloseTo(fullyOpen, 3)
  expect(bloomPose(20.9)).toBeCloseTo(fullyOpen, 3)
  bloomPose(4)
  expect(bloomPose(20.9)).toBeCloseTo(fullyOpen, 3)
  player.dispose()
})

it('samples the actual open GLB morph and maps its vertices into the identity scene coordinates', async () => {
  const source = readFileSync(new URL('./lily_004_final.glb', import.meta.url))
  const gltf = await parseAnimationFixture(source)
  const player = new LilyAnimationPlayer(gltf.scene, gltf.animations)
  const bloomClip = gltf.animations.find(({ name }) => name === 'Bloom')!
  player.play('IdleClosed', LoopRepeat, Infinity)
  player.seek(0)
  const closed = createLilyGeometryParticleSource(gltf.scene)
  player.play('Bloom', LoopOnce, 1)
  player.seek(bloomClip.duration)

  const open = createLilyGeometryParticleSource(gltf.scene)
  const parts = new Set(Array.from({ length: 2048 }, (_, index) => open.sampleSurface(index, 2048).part))
  expect(parts).toEqual(new Set([0, 1, 2]))
  expect(open.radius).toBeGreaterThan(0)
  expect(open.maxY).toBeGreaterThan(open.minY)
  const first = open.sample(0, 1024)
  expect(first).toEqual(open.sample(0, 1024))
  expect(first).toHaveLength(3)
  expect(first.every(Number.isFinite)).toBe(true)
  expect(open.sample(1, 1024)).not.toEqual(first)
  const changedByBloom = Array.from({ length: 128 }, (_, index) => {
    const a = closed.sample(index, 128), b = open.sample(index, 128)
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  }).filter((distance) => distance > 0.05)
  expect(changedByBloom.length).toBeGreaterThan(64)

  const world = new Group()
  world.position.set(0, -1.45, 0)
  world.scale.setScalar(3)
  world.add(clone(gltf.scene))
  const worldPlayer = new LilyAnimationPlayer(world, gltf.animations)
  worldPlayer.play('Bloom', LoopOnce, 1)
  worldPlayer.seek(bloomClip.duration)
  const worldOpen = createLilyGeometryParticleSource(world)
  const worldSample = worldOpen.sample(0, 1024)
  expect(worldSample[0]).toBeCloseTo(first[0] * 3, 4)
  expect(worldSample[1]).toBeCloseTo(-1.45 + first[1] * 3, 4)
  expect(worldSample[2]).toBeCloseTo(first[2] * 3, 4)
  player.dispose()
  worldPlayer.dispose()
})

it('samples actual Growth geometry deterministically after forward and backward timeline seeks', async () => {
  const source = readFileSync(new URL('./lily_004_final.glb', import.meta.url))
  const gltf = await parseAnimationFixture(source)
  const model = clone(gltf.scene) as Group
  const wrapper = new Group()
  wrapper.position.set(0, -1.45, 0)
  wrapper.scale.setScalar(3)
  wrapper.add(model)
  const player = new LilyAnimationPlayer(model, gltf.animations)
  const clip = gltf.animations.find(({ name }) => name === 'Growth')!
  const parentChildCount = wrapper.children.length
  const effect = createLilyGrowthVfx(wrapper, model, clip)
  let geometryDisposeCount = 0
  let materialDisposeCount = 0
  effect.geometry.addEventListener('dispose', () => { geometryDisposeCount++ })
  effect.material.addEventListener('dispose', () => { materialDisposeCount++ })
  expect(wrapper.children).toHaveLength(parentChildCount + 1)
  const stemBirth = getGrowthVfxBirthTime(clip, 'stem', 0.5)
  const secondLeafBirth = getGrowthVfxBirthTime(clip, 'leafB', 0.5)
  const firstLeafBirth = getGrowthVfxBirthTime(clip, 'leafA', 0.5)
  const budBirth = getGrowthVfxBirthTime(clip, 'bud', 0.5)
  expect(stemBirth).toBeLessThan(secondLeafBirth)
  expect(secondLeafBirth).toBeLessThan(firstLeafBirth)
  expect(firstLeafBirth).toBeLessThan(budBirth)
  const frames = getGrowthSceneFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
  const sample = (time: number, settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth) => {
    const clipTime = getGrowthClipTime(time, frames, clip.duration)
    player.play('Growth', LoopOnce, 1)
    player.seek(clipTime)
    effect.update({ scene: 'growth', time, clipTime, clipDuration: clip.duration, frames, pixelRatio: 1.5, reducedMotion: false, quality: 'standard' }, settings)
    const opacity = Array.from(effect.geometry.getAttribute('aOpacity').array)
    const points = Array.from(effect.geometry.getAttribute('position').array)
    const glow = Array.from(effect.geometry.getAttribute('aGlow').array)
    const stemMesh = model.getObjectByName('Stem') as Mesh
    const stemPoint = new Vector3()
    let stemMinY = Infinity, stemMaxY = -Infinity
    const stemPosition = stemMesh.geometry.getAttribute('position')
    for (let index = 0; index < stemPosition.count; index++) {
      stemMesh.getVertexPosition(index, stemPoint)
      stemMesh.localToWorld(stemPoint)
      wrapper.worldToLocal(stemPoint)
      stemMinY = Math.min(stemMinY, stemPoint.y); stemMaxY = Math.max(stemMaxY, stemPoint.y)
    }
    const visibleStemY: number[] = [], visibleLeafY: number[] = [], visibleBudY: number[] = []
    for (let index = 30; index < glow.length; index++) {
      if (glow[index]! <= 0) continue
      const source = effect.particleSources[index - 30]
      if (opacity[index]! <= 0.1) continue
      const y = points[index * 3 + 1] ?? 0
      if (source === 'stem') visibleStemY.push(y)
      else if (source === 'leafA' || source === 'leafB') visibleLeafY.push(y)
      else if (source === 'bud') visibleBudY.push(y)
    }
    return {
      positions: points,
      opacity,
      particlePositions: points.slice(30 * 3),
      particleOpacity: opacity.slice(30),
      pulsePositions: points.slice(0, 28 * 3),
      pulseOpacity: opacity.slice(0, 28),
      pulseColors: Array.from(effect.geometry.getAttribute('color').array).slice(0, 28 * 3),
      sizes: Array.from(effect.geometry.getAttribute('aSize').array),
      colors: Array.from(effect.geometry.getAttribute('color').array),
      glowStrength: effect.material.uniforms.uGlowStrength!.value as number,
      visibleParticles: opacity.slice(30)
        .reduce((total, value, index) => total + (value > 0.1 && effect.geometry.getAttribute('aGlow').getX(index + 30) > 0 ? 1 : 0), 0),
      visibleHeight: visibleStemY.length > 1 ? Math.max(...visibleStemY) - Math.min(...visibleStemY) : 0,
      stemHeight: stemMaxY - stemMinY,
      lowerStemParticles: visibleStemY.filter(y => y < (stemMinY + stemMaxY) * 0.5).length,
      upperStemParticles: visibleStemY.filter(y => y >= (stemMinY + stemMaxY) * 0.5).length,
      visibleLeafParticles: visibleLeafY.length,
      visibleBudParticles: visibleBudY.length,
    }
  }

  // Keep particle checks at stable offsets from model start when seed-fall
  // duration changes the model's absolute scene time.
  const earlyTime = frames.model[0] + 1.7
  const leafStageTime = frames.model[0] + 5
  const budStageTime = frames.model[0] + 7.7
  const early = sample(earlyTime)
  expect(early.visibleParticles).toBeGreaterThanOrEqual(40)
  expect(early.visibleParticles).toBeLessThanOrEqual(80)
  expect(early.visibleHeight / early.stemHeight).toBeGreaterThan(0.35)
  expect(early.lowerStemParticles).toBeGreaterThan(25)
  expect(early.upperStemParticles).toBeGreaterThan(25)
  expect(Math.min(early.lowerStemParticles, early.upperStemParticles) / Math.max(early.lowerStemParticles, early.upperStemParticles)).toBeGreaterThan(0.35)
  const earlyLowerDensity = sample(earlyTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleCount: 220 })
  expect(earlyLowerDensity.visibleParticles).toBeLessThan(early.visibleParticles)
  const leafStage = sample(leafStageTime)
  expect(leafStage.visibleParticles).toBeGreaterThan(5)
  expect(leafStage.visibleLeafParticles).toBeGreaterThan(5)
  const budStage = sample(budStageTime)
  expect(budStage.visibleParticles).toBeGreaterThan(5)
  expect(budStage.visibleBudParticles).toBeGreaterThan(5)
  const speedChanged = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseSpeed: 1.6 })
  const leafBoosted = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseLeafBoost: 1.5 })
  const budBoosted = sample(budStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseBudBoost: 1.5 })
  const pulseDisabled = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseEnabled: false })
  const pulseBrighter = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseBrightness: 2.5 })
  const pulseNarrower = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseWidth: 0.05 })
  const pulseFade = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseTrailFade: 2.8 })
  const pulseTinted = sample(leafStageTime, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxPulseColor: '#D8C994' })
  expect(speedChanged.pulsePositions).not.toEqual(sample(leafStageTime).pulsePositions)
  expect(speedChanged.particlePositions).toEqual(sample(leafStageTime).particlePositions)
  expect(speedChanged.particleOpacity).toEqual(sample(leafStageTime).particleOpacity)
  expect(leafBoosted.pulseOpacity).not.toEqual(sample(leafStageTime).pulseOpacity)
  expect(budBoosted.pulseOpacity).not.toEqual(budStage.pulseOpacity)
  expect(pulseDisabled.pulseOpacity.every(value => value === 0)).toBe(true)
  expect(pulseBrighter.pulseOpacity).not.toEqual(sample(leafStageTime).pulseOpacity)
  expect(pulseNarrower.pulsePositions).not.toEqual(sample(leafStageTime).pulsePositions)
  expect(pulseFade.pulseOpacity).not.toEqual(sample(leafStageTime).pulseOpacity)
  expect(pulseTinted.pulseColors).not.toEqual(sample(leafStageTime).pulseColors)
  const middle = sample(frames.handoff[1] + 1.2)
  const held = sample(frames.handoff[1] + 1.2)
  expect(held).toEqual(middle)
  const later = sample(frames.model[1] - 0.3)
  expect(later.positions).not.toEqual(middle.positions)
  const rewind = sample(frames.handoff[1] + 1.2)
  expect(rewind).toEqual(middle)
  expect(rewind.opacity.some(value => value > 0)).toBe(true)
  const lowerCount = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleCount: 80 })
  expect(lowerCount.visibleParticles).toBeLessThan(middle.visibleParticles)
  const larger = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleSize: 6 })
  expect(larger.sizes).not.toEqual(middle.sizes)
  const uniformSizes = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleSizeVariation: 0 })
  expect(uniformSizes.sizes).not.toEqual(middle.sizes)
  const dimmer = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleBrightness: 0.35 })
  expect(dimmer.opacity).not.toEqual(middle.opacity)
  const noGlow = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleGlow: 0 })
  expect(noGlow.sizes).not.toEqual(middle.sizes)
  expect(noGlow.glowStrength).toBe(0)
  expect(middle.glowStrength).toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleGlow)
  const shorterLife = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleLifetime: 0.3 })
  expect(shorterLife.opacity).not.toEqual(middle.opacity)
  const slower = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleSpeed: 0.2 })
  expect(slower.positions).not.toEqual(middle.positions)
  const narrow = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleSpread: 0 })
  expect(narrow.positions).not.toEqual(middle.positions)
  const tinted = sample(frames.handoff[1] + 1.2, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, vfxParticleTint: '#B4D8AE' })
  expect(tinted.colors).not.toEqual(middle.colors)
  effect.dispose()
  expect(wrapper.children).toHaveLength(parentChildCount)
  expect(geometryDisposeCount).toBe(1)
  expect(materialDisposeCount).toBe(1)
  effect.dispose()
  expect(geometryDisposeCount).toBe(1)
  expect(materialDisposeCount).toBe(1)
  player.dispose()
})

async function parseAnimationFixture(source: Buffer): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  // The real model is parsed without texture and material payloads so this node test
  // exercises its animation channels without requiring browser image APIs.
  const sourceJsonLength = source.readUInt32LE(12)
  const document = JSON.parse(source.toString('utf8', 20, 20 + sourceJsonLength)) as {
    images?: unknown[]
    textures?: unknown[]
    materials?: unknown[]
    meshes?: Array<{ primitives?: Array<{ material?: number }> }>
  }
  delete document.images
  delete document.textures
  delete document.materials
  for (const mesh of document.meshes ?? []) for (const primitive of mesh.primitives ?? []) delete primitive.material

  const json = Buffer.from(JSON.stringify(document))
  const paddedJsonLength = (json.length + 3) & ~3
  const binaryChunkOffset = 20 + sourceJsonLength
  const binaryLength = source.readUInt32LE(binaryChunkOffset)
  const binary = source.subarray(binaryChunkOffset + 8, binaryChunkOffset + 8 + binaryLength)
  const fixture = Buffer.alloc(12 + 8 + paddedJsonLength + 8 + binaryLength)
  fixture.write('glTF', 0)
  fixture.writeUInt32LE(2, 4)
  fixture.writeUInt32LE(fixture.length, 8)
  fixture.writeUInt32LE(paddedJsonLength, 12)
  fixture.writeUInt32LE(0x4e4f534a, 16)
  json.copy(fixture, 20)
  fixture.fill(0x20, 20 + json.length, 20 + paddedJsonLength)
  const binaryHeaderOffset = 20 + paddedJsonLength
  fixture.writeUInt32LE(binaryLength, binaryHeaderOffset)
  fixture.writeUInt32LE(0x004e4942, binaryHeaderOffset + 4)
  binary.copy(fixture, binaryHeaderOffset + 8)

  return new Promise((resolve, reject) => {
    const arrayBuffer = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength)
    new GLTFLoader().parse(arrayBuffer, '', (gltf) => resolve(gltf), reject)
  })
}
