import { ramp } from './progress'

/** Stateless frame values make seek, replay and reversed scrubbing deterministic. */
export function identityFrame(time: number) {
  return {
    lily: 1 - ramp(time, [0, 4]),
    ascii: ramp(time, [15, 20]) * (1 - ramp(time, [23, 28])),
    // A soft, unaltered photographic underlay preserves facial detail beneath the glyphs.
    photo: .35 * ramp(time, [17, 20]) + .65 * ramp(time, [23, 28]),
    frame: ramp(time, [28, 31]),
    gallery: ramp(time, [29, 34]),
    scale: 1.3 - .3 * ramp(time, [28, 34]),
    orbit: .24 * (1 - ramp(time, [14, 22])),
  }
}
