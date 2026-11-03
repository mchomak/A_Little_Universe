import { expect, it } from 'vitest'
import { Group } from 'three'
import { TIMING } from '../../engine/filmConfig'
import { poseGrowingLily } from './lilyPose'

it('keeps the flower hidden through awakening and grows it only during the stem cue', () => {
  const lily = new Group()
  const [stemStart, stemEnd] = TIMING.growth.stem
  const stemMidpoint = (stemStart + stemEnd) / 2
  for (const reducedMotion of [false, true]) {
    for (const time of [0, 5.84, stemStart - 0.01]) {
      poseGrowingLily(lily, time, reducedMotion)
      expect(lily.visible, `flower at ${time}s; reducedMotion=${reducedMotion}`).toBe(false)
    }
    poseGrowingLily(lily, stemMidpoint, reducedMotion)
    expect(lily.visible).toBe(true)
    expect(lily.scale.x).toBeCloseTo(reducedMotion ? 1 : 0.5)
    poseGrowingLily(lily, stemEnd, reducedMotion)
    expect(lily.scale.x).toBe(1)
    poseGrowingLily(lily, TIMING.growth.duration, reducedMotion)
    expect(lily.scale.x).toBe(1)
  }
})
