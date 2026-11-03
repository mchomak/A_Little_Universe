import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { getBloomCameraApproach, getBloomCameraMoveDuration, getBloomCloseupPose, getBloomEntryCameraPose } from './bloomCamera'

it('aims the bloom close-up at the flower cup using configured distance and height', () => {
  expect(getBloomCloseupPose(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)).toEqual({
    x: 0.27, y: 2.55, z: 2.3, tx: 0.27, ty: 1.25, tz: 0,
  })
})

it('finishes camera movement before the opening completes, including short durations', () => {
  const bloom = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom
  expect(getBloomCameraMoveDuration(bloom, [0, 16])).toBe(10.7)
  expect(getBloomCameraMoveDuration(bloom, [0, 6])).toBeCloseTo(5.7)
})

it('preserves the actual camera pose at the 02-to-03 handoff and on Bloom timeline rebuilds', () => {
  const growthExit = { x: 0.02, y: -0.04, z: 7.8, tx: 0.01, ty: -0.12, tz: 0 }
  const authoredEntry = { x: 0, y: -0.02, z: 7.8, tx: 0, ty: -0.12, tz: 0 }
  expect(getBloomEntryCameraPose('growth', growthExit, authoredEntry)).toBe(growthExit)
  expect(getBloomEntryCameraPose('bloom', growthExit, authoredEntry)).toBe(growthExit)
  expect(getBloomEntryCameraPose('prologue', growthExit, authoredEntry)).toBe(authoredEntry)
})

it('holds the 02-to-03 camera pose until the viewer touches the flower', () => {
  const bloom = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom
  expect(getBloomCameraApproach('waiting', bloom, [0, 16])).toBeNull()
  expect(getBloomCameraApproach('playing', bloom, [0, 16])).toEqual({
    pose: getBloomCloseupPose(bloom), duration: getBloomCameraMoveDuration(bloom, [0, 16]),
  })
})
