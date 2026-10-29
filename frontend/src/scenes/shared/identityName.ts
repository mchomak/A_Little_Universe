import { ramp, smooth } from './progress'

// Assembly finishes by 9.34s: at least 3.66s of legible hold before 04.4.
const start = 8
const streamDelay = .13
const scatterDelay = .12
const flight = .68
const flightSpread = .28
const waveStart = 9.4
const waveDuration = 1.5

export function nameAssembly(time: number, stream: number, seed: number, motion = true) {
  const t = ramp(time, [start + stream * streamDelay + seed * scatterDelay,
    start + stream * streamDelay + seed * scatterDelay + flight + seed * flightSpread])
  const eased = t * t * (3 - 2 * t)
  if (t === 0 || t === 1) return t
  return motion ? 1 + 2.3 * (eased - 1) ** 3 + 1.3 * (eased - 1) ** 2 : eased
}

export function nameFocus(time: number) {
  return smooth(ramp(time, [8, 9.4])) * (1 - smooth(ramp(time, [13, 17])))
}

export function nameWave(time: number, x: number) {
  if (time <= waveStart || time >= waveStart + waveDuration) return 0
  const t = (time - waveStart) / waveDuration
  const distance = (x - (-3.2 + 6.4 * t)) / .28
  return Math.exp(-distance * distance) * Math.sin(t * Math.PI)
}

/** Exact legacy path outside the name; a closed organic detour between the letters. */
export function nameSparkPosition(time: number, scale = 1, motion = true): [number, number, number] {
  const end = ramp(time, [28, 34]), entry = ramp(time, [0, 4])
  const x = -1.4 + Math.min(time / 34, 1) * 2.75
  const y = Math.sin(time * .8) * .18 * (1 - end) - .27 * end
  const z = .35 - .25 * end
  const t = ramp(time, [8, 13]), envelope = motion ? Math.sin(Math.PI * t) ** 2 : 0
  return [.1 + (x - .1) * entry + Math.sin(t * Math.PI * 2 - 1.2) * 1.75 * envelope * scale,
    .16 + (y - .16) * entry + Math.sin(t * Math.PI * 3) * .19 * envelope,
    .1 + (z - .1) * entry + Math.sin(t * Math.PI * 4) * .38 * envelope]
}

/** The GPU and testable choreography use the same timing constants; no simulation state. */
export const identityNameGLSL = `
float identityNameFocus(float time) {
  return smoothstep(8.0, 9.4, time) * (1.0 - smoothstep(13.0, 17.0, time));
}
float identityNameAssembly(float time, float stream, float seed, float motion) {
  float delay = ${start.toFixed(2)} + stream * ${streamDelay} + seed * ${scatterDelay};
  float t = smoothstep(delay, delay + ${flight} + seed * ${flightSpread}, time);
  if (t <= 0.0 || t >= 1.0) return t;
  float q = t - 1.0;
  float spring = 1.0 + 2.3 * q * q * q + 1.3 * q * q;
  return mix(t, spring, motion);
}
float identityNameTravel(float time, float stream, float seed) {
  return clamp((time - ${start.toFixed(2)} - stream * ${streamDelay} - seed * ${scatterDelay}) / (${flight} + seed * ${flightSpread}), 0.0, 1.0);
}
float identityNameWave(float time, float x) {
  if (time <= ${waveStart} || time >= ${(waveStart + waveDuration).toFixed(2)}) return 0.0;
  float t = clamp((time - ${waveStart}) / ${waveDuration}, 0.0, 1.0);
  float d = (x - mix(-3.2, 3.2, t)) / .28;
  return exp(-d * d) * sin(t * 3.141593);
}
`
