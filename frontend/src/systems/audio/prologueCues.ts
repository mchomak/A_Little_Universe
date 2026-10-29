import type { PrologueFrames } from '../../engine/filmConfig'
import type { AudioCue } from './AudioDirector'

/** Asset slots only: near-silent atmosphere, soft piano phrase accents, almost inaudible air. */
export function getPrologueAudioCues(frames: PrologueFrames): readonly { time: number; cue: AudioCue }[] {
  return [
    { time: 0, cue: 'prologue-intro' },
    { time: frames.first[0], cue: 'prologue-first' },
    { time: frames.second[0], cue: 'prologue-second' },
    { time: frames.dissolve[0], cue: 'prologue-dissolve' },
  ]
}
