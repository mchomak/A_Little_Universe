import { expect, it } from 'vitest'
import { Group } from 'three'
import { poseGrowingLily } from './lilyPose'

it('keeps the flower hidden through awakening and grows it only during the stem cue', () => {
  const lily = new Group()
  for (const reducedMotion of [false, true]) {
    for (const time of [0, 7, 9, 10.99]) {
      poseGrowingLily(lily, time, reducedMotion)
      expect(lily.visible, `flower at ${time}s; reducedMotion=${reducedMotion}`).toBe(false)
    }
    poseGrowingLily(lily, 14.5, reducedMotion)
    expect(lily.visible).toBe(true)
    expect(lily.scale.x).toBeCloseTo(reducedMotion ? 1 : 0.5)
    poseGrowingLily(lily, 18, reducedMotion)
    expect(lily.scale.x).toBe(1)
    poseGrowingLily(lily, 23, reducedMotion)
    expect(lily.scale.x).toBe(1)
  }
})
