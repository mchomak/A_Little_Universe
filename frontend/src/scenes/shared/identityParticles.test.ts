import { describe, expect, it } from 'vitest'
import { createIdentityParticleData, mockLilyParticles } from './identityParticles'

const imagePixels = new Uint8ClampedArray([
  0, 0, 0, 255, 128, 128, 128, 255,
  255, 255, 255, 255, 32, 64, 96, 255,
])

describe('identity particle handoff', () => {
  it('maps stable lily samples into a bounded loose cloud and the matching photo frame', () => {
    const first = createIdentityParticleData(32, mockLilyParticles, imagePixels, 2, 2)
    const replay = createIdentityParticleData(32, mockLilyParticles, imagePixels, 2, 2)
    expect(first).toEqual(replay)
    expect(first.origin).toEqual(new Float32Array(Array.from({ length: 32 }, (_, i) => mockLilyParticles.sample(i, 32)).flat()))
    expect([...first.portrait].every((value) => Math.abs(value) <= 1.16)).toBe(true)
    expect([...first.cloud].every((value) => Math.abs(value) <= 2.0)).toBe(true)
    expect([...first.luminance].every((value) => value >= 0 && value <= 1)).toBe(true)
    expect([...first.reveal].every(Number.isFinite)).toBe(true)
  })

  it('keeps particle targets, tone samples and the face reveal on the source photo coordinates', () => {
    const width = 2
    const height = 2
    const data = createIdentityParticleData(32, mockLilyParticles, imagePixels, width, height)
    for (let index = 0; index < 32; index++) {
      const offset = index * 3
      const x = Math.round((data.portrait[offset]! / 2.15 + .5) * (width - 1))
      const y = Math.round((.5 - (data.portrait[offset + 1]! - .08) / 2.15) * (height - 1))
      const pixel = (y * width + x) * 4
      const expectedLuma = (imagePixels[pixel]! * .2126 + imagePixels[pixel + 1]! * .7152 + imagePixels[pixel + 2]! * .0722) / 255
      expect(data.luminance[index]).toBeCloseTo(expectedLuma)
      const u = x / (width - 1)
      const v = 1 - y / (height - 1)
      expect(data.reveal[index]).toBeCloseTo(Math.hypot((u - .59) / .62, (v - .62) / .66))
      expect(Math.abs(data.portrait[offset + 2]!)).toBeLessThanOrEqual(.018)
    }
  })

  it('rejects malformed pixel input before creating partial buffers', () => {
    expect(() => createIdentityParticleData(0, mockLilyParticles, imagePixels, 2, 2)).toThrow(RangeError)
    expect(() => createIdentityParticleData(1, mockLilyParticles, imagePixels.slice(0, 4), 2, 2)).toThrow(RangeError)
  })
})
