import { TIMING } from '../../engine/filmConfig'
import { ramp } from './progress'

/** Scene-five accepts the first card at its existing centered world-space pose. */
export const IDENTITY_HANDOFF = Object.freeze({ photo: 1, frame: 1, scale: 1, x: 0, y: 0.08, z: 0 })

/** Pure absolute-time values keep seeks, replay and reverse scrubbing deterministic. */
export function identityFrame(time: number) {
  const frames = TIMING.identity
  const photoReveal = ramp(time, frames.photo)
  const photoUnderlay = frames.portraitUnderlayOpacity * ramp(time, frames.portraitUnderlay) * (1 - photoReveal)
  return {
    lily: 1 - ramp(time, frames.dissolve),
    disperse: ramp(time, frames.dissolve),
    particle: ramp(time, frames.dissolve) * (1 - ramp(time, frames.portrait)),
    reveal: ramp(time, frames.gather),
    ascii: ramp(time, frames.gather) * (1 - ramp(time, frames.photo)),
    // The exact monochrome source anchors features while ASCII holds; only the teaser is masked.
    photo: photoReveal,
    underlay: photoUnderlay,
    frame: ramp(time, frames.frame),
    caption: ramp(time, frames.caption),
    handoff: IDENTITY_HANDOFF,
  }
}
