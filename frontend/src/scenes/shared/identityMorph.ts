import { ramp, smooth } from './progress'
import { restorationGLSL } from './identityRestoration'

export type PortraitCell = readonly [delay: number, flight: number, reveal: number, structure: number]
const random = (i: number) => { const n = Math.sin(i * 127.1 + 27.7) * 43758.5453; return n - Math.floor(n) }

/** Actual photographic light/edges, never a guessed face silhouette or altered crop. */
export function portraitSample(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number): [number, number] {
  const light = (px: number, py: number) => {
    const i = (Math.max(0, Math.min(height - 1, py)) * width + Math.max(0, Math.min(width - 1, px))) * 4
    return ((pixels[i] ?? 0) * .2126 + (pixels[i + 1] ?? 0) * .7152 + (pixels[i + 2] ?? 0) * .0722) / 255
  }
  const l = light(x, y)
  const contrast = Math.max(Math.abs(l - light(x - 2, y)), Math.abs(l - light(x + 2, y)),
    Math.abs(l - light(x, y - 2)), Math.abs(l - light(x, y + 2)))
  return [l, contrast]
}

/** Shared delivery schedule for a travelling particle and its detailed destination cell. */
export function portraitCell(luminance: number, contrast: number, x: number, y: number): PortraitCell {
  const seed = random(x + y * 137)
  // The photo has a bright wall: brightness alone would assemble its rectangular
  // background first. Prefer real edges and midtones in hair/face instead.
  const structure = Math.min(1, Math.sqrt(contrast) * 1.8 + 4 * luminance * (1 - luminance) * .45)
  const delay = .06 + seed * .5 + (1 - structure) * .75
  const flight = 2.05 + (1 - structure) * .58 + random(x * 7 + y * 311) * .04
  return [delay, flight, 13 + delay + flight * .82, structure]
}

export function portraitReveal(time: number, cell: PortraitCell) {
  return smooth(ramp(time, [cell[2], Math.min(16.98, cell[2] + .62)]))
}

export const identityMorphGLSL = `
float identityMorphTravel(float time, vec4 cell) {
  return clamp((time - 13.0 - cell.x) / cell.y, 0.0, 1.0);
}
vec3 identityMorphPosition(vec3 source, vec3 target, float t, float seed, float motion) {
  float ease = t * t * (3.0 - 2.0 * t);
  // A closed, zero-velocity detour: no accumulated simulation to reset on seek.
  float envelope = 16.0 * t * t * (1.0 - t) * (1.0 - t);
  float phase = seed * 37.0;
  vec3 arc = vec3(cos(phase) * .52, sin(phase * 1.7) * .46, sin(phase * 2.3) * .95);
  vec3 turbulence = vec3(sin(phase + t * 9.0), cos(phase * 1.3 + t * 7.0), sin(phase + t * 6.0));
  return mix(source, target, ease) + (arc + turbulence * .13 * (1.0 - ease)) * envelope * motion;
}
`

/** The old detail plane only fills delivered cells; fully identical to 04.5 at 17s. */
export const portraitVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`
export const portraitFragment = `
uniform sampler2D uAscii;
uniform sampler2D uDelivery;
uniform float uTime;
uniform float opacity;
varying vec2 vUv;
${restorationGLSL}
void main() {
  vec2 schedule = texture2D(uDelivery, vec2(vUv.x, 1.0 - vUv.y)).rg * 4.0 + 13.0;
  float delivered = smoothstep(schedule.x, schedule.y, uTime);
  vec4 ink = texture2D(uAscii, vUv);
  float layer = opacity;
  if (uTime > 23.0 && uTime < 28.0) layer = 1.0 - photographicRecovery(vec2(vUv.x, 1.0 - vUv.y), uTime);
  gl_FragColor = vec4(ink.rgb, ink.a * layer * delivered);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
