import { describe, expect, it } from 'vitest'
import { createNeutralImportanceMask, paintImportanceMask } from './importanceMask'

describe('grayscale portrait importance mask', () => {
  it('starts neutral and applies soft brush intensity in image coordinates', () => {
    const mask = createNeutralImportanceMask(20, 20)
    paintImportanceMask(mask, 20, 20, { x: 10, y: 10, radius: 5, value: 255, softness: 0.5, intensity: 1, erase: false })

    expect(mask[10 * 20 + 10]).toBe(255)
    expect(mask[10 * 20 + 14]).toBeGreaterThan(128)
    expect(mask[10 * 20 + 19]).toBe(128)
  })

  it('returns painted values toward neutral with the eraser', () => {
    const mask = new Uint8Array(100).fill(255)
    paintImportanceMask(mask, 10, 10, { x: 5, y: 5, radius: 4, value: 0, softness: 0, intensity: 1, erase: true })

    expect(mask[55]).toBe(128)
    expect(mask[0]).toBe(255)
  })
})
