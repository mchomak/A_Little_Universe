import { readFileSync } from 'node:fs'
import { AnimationClip, Group, LoopOnce, LoopRepeat, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { expect, it } from 'vitest'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getGrowthClipTime, getSyncedBloomClipTime } from '../../scenes/lily/animationTiming'
import { LilyAnimationPlayer } from '../../scenes/lily/animationPlayer'
import { createLilyGeometryParticleSource } from '../../scenes/lily/particleSource'

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
  expect(growthPose(12.9)).toBeGreaterThan(0.1)
  const fullGrowth = growthPose(14.1)
  expect(fullGrowth).toBeCloseTo(1, 3)
  expect(growthPose(14.4)).toBeCloseTo(fullGrowth, 3)
  expect(growthPose(16)).toBeCloseTo(fullGrowth, 3)
  growthPose(12.9)
  expect(growthPose(16)).toBeCloseTo(fullGrowth, 3)

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
