import { describe, expect, it } from 'vitest'
import { getPhoneBackgroundPanPercent, getPhoneBackgroundProgress } from './phoneBackgroundMotion'

describe('phone background camera travel', () => {
  it('stays still until seed fall starts, then eases through the whole fall', () => {
    expect(getPhoneBackgroundProgress(3, [4, 12])).toBe(0)
    expect(getPhoneBackgroundProgress(8, [4, 12])).toBe(0.5)
    expect(getPhoneBackgroundProgress(12, [4, 12])).toBe(1)
  })

  it('keeps the image inside its zoom overscan while carrying the view downward', () => {
    expect(getPhoneBackgroundPanPercent(0, 1.8, 0)).toBe(0)
    expect(getPhoneBackgroundPanPercent(1, 1.8, 0)).toBe(-40)
    expect(getPhoneBackgroundPanPercent(0.5, 2.8, 0.5)).toBeCloseTo(-22.5)
    expect(getPhoneBackgroundPanPercent(1, 2.8, 1)).toBeCloseTo(-90)
  })

  it('handles non-finite clock values without jumping outside the image', () => {
    expect(getPhoneBackgroundProgress(Number.NaN, [4, 12])).toBe(0)
    expect(getPhoneBackgroundProgress(10, [12, 4])).toBe(0)
    expect(getPhoneBackgroundPanPercent(Number.NaN, Number.NaN, Number.NaN)).toBe(0)
  })
})
