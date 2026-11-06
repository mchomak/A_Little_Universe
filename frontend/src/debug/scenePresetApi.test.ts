import { expect, it } from 'vitest'
import { usesPackagedPresetStorage } from './scenePresetApi'

it('uses persistent packaged storage only for the trusted Electron origin', () => {
  expect(usesPackagedPresetStorage('app:', 'bundle')).toBe(true)
  expect(usesPackagedPresetStorage('https:', 'bundle')).toBe(false)
  expect(usesPackagedPresetStorage('app:', 'attacker')).toBe(false)
})
