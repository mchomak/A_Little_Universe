import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getPrologueLightPose } from './lightPose'

const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue

it('keeps the first light dark at zero and fully born by two seconds', () => {
  expect(getPrologueLightPose(0, 0, 'playing', settings, false).opacity).toBe(0)
  expect(getPrologueLightPose(2, 2, 'playing', settings, false).opacity).toBe(1)
})

it('preserves the light at the scene boundary and transfers it continuously to the seed', () => {
  const end = getPrologueLightPose(18.85, 24.85, 'transitioning', settings, false)
  const entry = getPrologueLightPose(0, 0, 'playing', settings, false, true)
  expect(end.opacity).toBe(entry.opacity)
  expect(end.wave).toBeCloseTo(0)
  expect(entry.gain).toBe(end.gain)
  expect(getPrologueLightPose(1.15, 1.15, 'playing', settings, false, true).opacity).toBe(0)
})
