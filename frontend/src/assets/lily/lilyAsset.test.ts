import { readFileSync } from 'node:fs'
import { AnimationClip, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { createLilyGrowthVfx } from '../../scenes/lily/lilyGrowthVfx'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'

interface GlbDocument {
  accessors: Array<{ max?: number[] }>
  animations: Array<{
    name: string
    samplers: Array<{ input: number }>
    channels: Array<{ target: { path: string } }>
  }>
}

it('preserves the archived approved GLB with the exact six source clips and expected durations', () => {
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

it('centroids only anther material groups for indexed and non-indexed meshes', () => {
  const growthFrames = getGrowthSceneFrames()
  const bloomFrames = getBloomSceneFrames()
  const pollenSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen
  const frame = {
    scene: 'bloom' as const, time: 16, clipTime: 0, clipDuration: 9,
    frames: growthFrames, bloomFrames, bloomClipTime: 16, bloomClipDuration: 16,
    bloomOpen: true, bloomElapsed: 0, pixelRatio: 1, reducedMotion: false, quality: 'standard' as const,
  }

  for (const indexed of [true, false]) {
    const model = new Group()
    const cup = new Group()
    cup.name = 'Flower_Interior'
    model.add(cup)
    const wrapper = new Group()
    wrapper.add(model)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 1, 0, 0.06, 1, 0, 0, 1.06, 0,
      9, 9, 9, 10, 9, 9, 9, 10, 9,
    ], 3))
    if (indexed) geometry.setIndex([0, 1, 2, 3, 4, 5])
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const materials = [new MeshBasicMaterial({ name: 'Anther_SoftGold' }), new MeshBasicMaterial({ name: 'Petal_Satin' })]
    model.add(new Mesh(geometry, materials))

    const effect = createLilyGrowthVfx(wrapper, model, new AnimationClip('Growth', 9, []))
    effect.update(frame, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, pollenSettings)
    const pollenStart = 30 + effect.particleSources.length + 1600
    const positions = effect.geometry.getAttribute('position')
    const firstInnerPollen = new Vector3(positions.getX(pollenStart), positions.getY(pollenStart), positions.getZ(pollenStart))

    expect(effect.geometry.getAttribute('aOpacity').getX(pollenStart)).toBeGreaterThan(0.015)
    expect(firstInnerPollen.distanceTo(new Vector3(0.02, 1.02, 0))).toBeLessThan(0.05)

    effect.dispose()
    geometry.dispose()
    materials.forEach(material => material.dispose())
  }
})
