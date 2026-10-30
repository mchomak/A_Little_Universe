import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getGalaxyFogOpacity, getGalaxyLight, getGalaxyMotionPhase, getGalaxyRevealState } from './animation'

const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy

it('reveals distant stars first, grows the spiral by scene time, then settles the foreground fog', () => {
  expect(getGalaxyRevealState(0, settings).galaxy).toBe(0)
  expect(getGalaxyRevealState(settings.firstStarsAt + 0.65, settings).stars).toBeGreaterThan(0.4)
  expect(getGalaxyRevealState(settings.galaxyRevealAt + settings.revealDuration, settings).galaxy).toBe(1)
  expect(getGalaxyRevealState(settings.fogEnd + 0.5, settings).fogDissipation).toBe(1)
  expect(getGalaxyRevealState(settings.galaxyRevealAt + settings.revealDuration + settings.pauseDuration, settings).background).toBe(0)
})

it('keeps the galaxy motion phase continuous between scenes 07, 08 and 09', () => {
  const cosmosEnd = getGalaxyMotionPhase('cosmos', 26, settings, 26, 50)
  const greetingStart = getGalaxyMotionPhase('greeting', 0, settings, 26, 50)
  const greetingEnd = getGalaxyMotionPhase('greeting', 50, settings, 26, 50)
  const endingStart = getGalaxyMotionPhase('ending', 0, settings, 26, 50)
  expect(greetingStart).toBeCloseTo(cosmosEnd, 10)
  expect(endingStart).toBeCloseTo(greetingEnd, 10)
  expect(getGalaxyMotionPhase('cosmos', 9, settings, 26, 50, true)).toBe(0)
})

it('starts the light fade before the Scene 07 handoff and preserves both scene boundaries', () => {
  const cosmosEnd = getGalaxyLight('cosmos', 26, settings, 26)
  const greetingStart = getGalaxyLight('greeting', 0, settings, 26)
  const greetingSettled = getGalaxyLight('greeting', settings.backgroundTransition, settings, 26)
  const endingStart = getGalaxyLight('ending', 0, settings, 26)
  expect(cosmosEnd).toBeCloseTo(0.76, 10)
  expect(greetingStart).toBeCloseTo(cosmosEnd, 10)
  expect(greetingSettled).toBeCloseTo(endingStart, 10)
})

it('preserves residual fog through the reveal, then fades it continuously to the greeting boundary', () => {
  const revealComplete = getGalaxyFogOpacity('cosmos', settings.fogEnd, settings, 26)
  const handoffStart = getGalaxyFogOpacity('cosmos', 26 - settings.backgroundTransition, settings, 26)
  const beforeHandoff = getGalaxyFogOpacity('cosmos', 25.99, settings, 26)

  expect(revealComplete).toBeCloseTo(settings.fogDensity * (1 - settings.fogDissipation) + settings.fogAfterOpacity, 10)
  expect(handoffStart).toBeGreaterThan(0)
  expect(beforeHandoff).toBeLessThan(0.001)
  expect(getGalaxyFogOpacity('cosmos', 26, settings, 26)).toBe(0)
  expect(getGalaxyFogOpacity('greeting', 0, settings, 26)).toBe(0)
})
