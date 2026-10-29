import { describe, expect, it } from 'vitest'
import { focusCamera } from './camera'
describe('focus dolly', () => {
  it('approaches the exhibit with bounded movement and returns exactly to the corridor pose', () => {
    const start = [0, 0, 6] as const, exhibit = [-3, 0, -10] as const
    const focused = focusCamera(start, exhibit, 1)
    expect(focused.distance).toBeCloseTo(4.8)
    expect(focused.x).toBeLessThan(0); expect(focused.z).toBeLessThan(6)
    expect(focusCamera(start, exhibit, 0)).toEqual({ x: 0, y: 0, z: 6, distance: Math.hypot(3, 16) })
    expect(focusCamera(start, [3, 0, -80], 1).distance).toBeGreaterThan(70)
  })
})
