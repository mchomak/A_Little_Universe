import { describe, expect, it } from 'vitest'
import { getPrologueFrames } from '../../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getPrologueAtmosphereFrame } from './atmosphereFrame'

describe('prologue atmosphere', () => {
  it('keeps the background atmosphere on its opening frame while both phrases appear', () => {
    const frames = getPrologueFrames(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
    const phraseTimes = [0, frames.first[0], frames.second[0], 9]

    expect(phraseTimes.map(getPrologueAtmosphereFrame)).toEqual(phraseTimes.map(() => ({ reveal: 0, time: 0 })))
  })
})
