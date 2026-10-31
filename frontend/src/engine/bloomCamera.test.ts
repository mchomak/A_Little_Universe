import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { getBloomCameraMoveDuration, getBloomCloseupPose } from './bloomCamera'

it('aims the bloom close-up at the flower cup using configured distance and height', () => {
  expect(getBloomCloseupPose(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)).toEqual({
    x: 0.27, y: 2.3, z: 2.3, tx: 0.27, ty: 1.25, tz: 0,
  })
})

it('finishes camera movement before the opening completes, including short durations', () => {
  const bloom = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom
  expect(getBloomCameraMoveDuration(bloom, [0, 16])).toBe(10.7)
  expect(getBloomCameraMoveDuration(bloom, [0, 6])).toBeCloseTo(5.7)
})
