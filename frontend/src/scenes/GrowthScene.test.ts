import { expect, it } from 'vitest'
import { getGrowthFrames, getSeedPose } from './growth/seedProcedure'
import { getConfig } from '../systems/scene-config/config'

it('keeps the seed visible at landing until the shoot handoff', () => {
  const settings = getConfig().scenes.growth
  const frames = getGrowthFrames(settings)
  expect(getSeedPose(frames.fall[1] + 0.2, 3.82, false, settings).seedOpacity).toBeGreaterThan(0.95)
  expect(getSeedPose(frames.handoff[1], 3.82, false, settings).seedOpacity).toBe(0)
})
