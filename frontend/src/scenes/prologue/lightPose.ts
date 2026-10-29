import type { FilmState } from '../../engine/film'
import { getPrologueFrames } from '../../engine/filmConfig'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

type Settings = SceneComposerConfig['scenes']['prologue']
const smooth = (x: number) => { const a = Math.min(1, Math.max(0, x)); return a * a * (3 - 2 * a) }

/** Shared cinematic light pose, including the ownership transfer to the growing seed. */
export function getPrologueLightPose(time: number, presentation: number, mode: FilmState['mode'], settings: Settings, reduced: boolean, growth = false, touchDuration = settings.touchDuration) {
  const frames = getPrologueFrames(settings)
  const breathe = reduced ? 0 : settings.pulseAmplitude * (Math.sin(presentation * settings.pulseFrequency * Math.PI * 2) * .8 + Math.sin(presentation * .47 + .7) * .2)
  const phrase = Math.exp(-Math.pow((time - frames.second[1]) / 1.4, 2)) * settings.phraseResponse
  const invitation = Math.exp(-Math.pow((time - (frames.dissolve[1] + .3)) / .4, 2)) * .09
  const touch = mode === 'transitioning' && !growth ? Math.min(1, Math.max(0, (time - frames.duration) / touchDuration)) : growth ? 1 : 0
  const reaction = mode === 'transitioning' && !growth && touch < 1 ? Math.sin(Math.PI * touch) : 0
  const transfer = growth ? smooth(time / 1.15) : 0
  const activity = growth ? 0 : mode === 'transitioning' ? 1 - smooth(touch) : 1
  return {
    opacity: growth ? 1 - transfer : smooth(time / 2),
    gain: settings.coreIntensity * (1 + (breathe + phrase + invitation) * activity + reaction * settings.touchIntensity),
    radius: 1 + breathe * .55 * activity + reaction * .06,
    pearl: reaction * .55,
    wave: reduced ? 0 : reaction * settings.waveStrength,
    waveRadius: 7 + touch * settings.waveRadius,
    touch,
    transfer,
  }
}
