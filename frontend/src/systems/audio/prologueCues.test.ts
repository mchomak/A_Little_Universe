import { expect, it } from 'vitest'
import { getPrologueFrames } from '../../engine/filmConfig'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../scene-config/config'
import { getPrologueAudioCues } from './prologueCues'

it('places silent asset slots at the authored beats and follows configured phrase timing', () => {
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue
  expect(getPrologueAudioCues(getPrologueFrames(settings))).toEqual([
    { time: 0, cue: 'prologue-intro' },
    { time: 2, cue: 'prologue-first' },
    { time: 7, cue: 'prologue-second' },
    { time: 12.5, cue: 'prologue-dissolve' },
  ])
  const changed = getPrologueAudioCues(getPrologueFrames({ ...settings, interphraseInterval: 3 }))
  expect(changed.find(({ cue }) => cue === 'prologue-second')?.time).toBe(8.5)
  expect(changed.find(({ cue }) => cue === 'prologue-dissolve')?.time).toBe(13.5)
})
