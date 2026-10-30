import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

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
