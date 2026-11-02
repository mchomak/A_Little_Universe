import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import metadata from '../../assets/scene04-portrait-approved-v2.json'
import { APPROVED_PORTRAIT_SETTINGS, applyApprovedPortraitAppearance, createApprovedPortraitGate, decodeApprovedPortrait } from './approvedPortrait'
import { createLilyDissolveUniforms, createLilyParticleMaterial, selectRepresentativePortraitTargets } from './dissolve'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { initialFilmState } from '../../engine/film'

const bytes = readFileSync(resolve(process.cwd(), 'src/assets/scene04-portrait-approved-v2.bin'))
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

describe('approved Scene 04 portrait', () => {
  it('applies authored appearance to the actual shader without altering the vortex seed', () => {
    const material = createLilyParticleMaterial(createLilyDissolveUniforms())
    applyApprovedPortraitAppearance(material)
    expect(material.vertexShader).toContain('vSeed = mix(aSeed, aPortraitSeedData.x, portraitMix)')
    expect(material.vertexShader).toContain('pointSize * mix(1.0, aArtSize, portraitMix)')
    expect(material.vertexShader).toContain('vArtBrightness = mix(1.0, aArtBrightness, portraitMix)')
    expect(material.vertexShader).toContain('lilyVortexPosition(position, aPart, aSeed, age, aPortraitSeedData.z)')
    expect(material.fragmentShader).toContain('glow *= vArtBrightness')
    material.dispose()
  })
  it('holds a seeked scene during delayed loading, failure and retry, releasing only after geometry commits', async () => {
    const runtime = createFilmRuntime()
    const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const }
    const clock = createFilmClock({ state, runtime, dispatch: () => {} })
    const portrait = { width: 640, height: 640, points: [] }
    let resolveLoad!: (value: typeof portrait) => void
    const delayed = new Promise<typeof portrait>((resolve) => { resolveLoad = resolve })
    const load = vi.fn().mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(delayed)
    const onReady = vi.fn(), onError = vi.fn()
    const gate = createApprovedPortraitGate(runtime, onReady, onError, load)
    gate.load()
    clock.timeline.time(12)
    expect(runtime.held).toBe(true)
    expect(clock.timeline.paused()).toBe(true)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(runtime.held).toBe(true)
    gate.load()
    resolveLoad(portrait)
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith(portrait))
    expect(runtime.held).toBe(true)
    gate.committed()
    expect(runtime.held).toBe(false)
    expect(runtime.time).toBeCloseTo(12)
    gate.dispose()
    clock.dispose()
  })

  it('releases the hold on unmount and ignores a late fetch result', async () => {
    const runtime = createFilmRuntime()
    let resolveLoad!: (value: { width: number; height: number; points: [] }) => void
    const pending = new Promise<{ width: number; height: number; points: [] }>((resolve) => { resolveLoad = resolve })
    const onReady = vi.fn(), onError = vi.fn()
    const gate = createApprovedPortraitGate(runtime, onReady, onError, () => pending)
    gate.load()
    gate.dispose()
    resolveLoad({ width: 640, height: 640, points: [] })
    await pending
    await Promise.resolve()
    expect(runtime.held).toBe(false)
    expect(onReady).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
  it('decodes the committed asset and preserves the approved point data and settings', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(metadata.binarySha256)
    const { width, height, points } = decodeApprovedPortrait(buffer)
    expect([width, height, points.length]).toEqual([640, 640, 32000])
    expect(APPROVED_PORTRAIT_SETTINGS).toMatchObject({ seed: 20903, count: 32000, scale: 0.95, brightness: 2 })
    expect(points[0]).toMatchObject({ type: 'support', artBrightness: expect.closeTo(0.46, 5) })
    expect(points[0]!.u).toBeCloseTo(0.595726857544845, 6)
    expect(Object.fromEntries(['fill', 'contour', 'flow', 'support'].map((type) => [type, points.filter((point) => point.type === type).length])))
      .toEqual({ fill: 29923, contour: 113, flow: 1479, support: 485 })
  })

  it('keeps the full silhouette and rare authored types when fewer particles can land', () => {
    const { points } = decodeApprovedPortrait(buffer)
    for (const budget of [64, 400, 4000, 16000]) {
      const indices = selectRepresentativePortraitTargets(points, budget)
      const selected = indices.map((index) => points[index]!)
      expect(indices).toHaveLength(budget)
      expect(new Set(indices).size).toBe(budget)
      expect(new Set(selected.map((point) => point.type))).toEqual(new Set(['fill', 'contour', 'flow', 'support']))
      expect(Math.min(...selected.map((point) => point.v))).toBeLessThan(0.2)
      expect(Math.max(...selected.map((point) => point.v))).toBeGreaterThan(0.8)
      if (budget >= 400) expect(selected.filter((point) => point.type === 'contour')).toHaveLength(113)
      expect(indices).toEqual(selectRepresentativePortraitTargets(points, budget))
    }
  })

  it('rejects truncated and malformed portrait data', () => {
    expect(() => decodeApprovedPortrait(buffer.slice(0, -4))).toThrow()
    const invalid = buffer.slice(0)
    new DataView(invalid).setUint32(0, 0)
    expect(() => decodeApprovedPortrait(invalid)).toThrow()
  })
})
