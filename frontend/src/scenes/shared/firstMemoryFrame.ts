import { ramp, smooth } from './progress'
import type { CameraPose } from './galleryMotion'

/** One authored pose at both sides of 04.7 → 05.1, including direct DEV entry. */
export function firstMemoryFrame(time: number, reducedMotion = false) {
  const dolly = smooth(ramp(time, [31, 34]))
  const rotation: [number, number, number] = reducedMotion || dolly === 0 ? [0, 0, 0] : [-.022 * dolly, .065 * dolly, -.009 * dolly]
  return {
    scale: 1.3 - .3 * dolly,
    rotation,
    caption: smooth(ramp(time, reducedMotion ? [28.1, 28.65] : [28.6, 29.4])),
    particles: reducedMotion ? 0 : smooth(ramp(time, [28, 28.18])) * (1 - smooth(ramp(time, [29.05, 29.65]))),
    assembly: smooth(ramp(time, [28.12, 29.3])),
  }
}

export function firstMemoryCamera(time: number, reducedMotion = false): CameraPose {
  const dolly = reducedMotion ? 0 : smooth(ramp(time, [31, 34]))
  return { x: .14 * dolly, y: .04 * dolly, z: dolly === 1 ? 6.15 : 5.6 + .55 * dolly, tx: 0, ty: 0, tz: 0 }
}
