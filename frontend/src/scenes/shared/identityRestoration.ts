import { ramp, smooth } from './progress'
import { progressivePhotoRevealGLSL } from './progressivePhotoReveal'

/** Source UV (top down). Three travelling fronts share one immutable arrival map. */
export function restorationStart(u: number, v: number) {
  const wave = .18 * Math.sin(u * 15 + Math.sin(v * 12)) + .1 * Math.sin(v * 22 - u * 7)
  const face = Math.hypot((u - .66) * 1.05, v - .38) * 3.7 + .16
  const hair = Math.hypot(u - .48, (v - .18) * 1.2) * 3.8 + .6
  const shoulder = Math.hypot(u - .81, (v - .73) * 1.05) * 3.9 + 1.05
  const arrival = Math.max(.12, Math.min(3.05, Math.min(face, hair, shoulder) + wave))
  return 23 + Math.round(arrival / 4 * 255) / 255 * 4
}

export function restoredPixel(time: number, u: number, v: number) {
  const start = restorationStart(u, v)
  return smooth(ramp(time, [start, start + .6]))
}

export function restorationFrame(time: number) {
  const active = time > 23 && time < 28
  if (!active) return { active, quiet: 0, rim: 0 }
  return {
    active,
    quiet: smooth(ramp(time, [23, 23.8])) * (1 - smooth(ramp(time, [27.6, 28]))),
    rim: .13 * smooth(ramp(time, [25.5, 26.8])) * (1 - smooth(ramp(time, [27.5, 28]))),
  }
}

/** R is arrival time, quantized over four seconds. Allocated once, not on seek. */
export function restorationMap(size = 112) {
  const bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    bytes[(y * size + x) * 4] = Math.round((restorationStart((x + .5) / size, (y + .5) / size) - 23) / 4 * 255)
    bytes[(y * size + x) * 4 + 3] = 255
  }
  return bytes
}

export const restorationGLSL = `
uniform sampler2D uRestoration;
float photographicRecovery(vec2 sourceUv, float time) {
  float arrival = 23.0 + texture2D(uRestoration, clamp(sourceUv, 0.0, 1.0)).r * 4.0;
  return smoothstep(arrival, arrival + .6, time);
}`

export const restoredPhotoVertex = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`

export const restoredPhotoFragment = `
uniform sampler2D uPhoto;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
${restorationGLSL}
${progressivePhotoRevealGLSL}
void main() {
  vec3 original = texture2D(uPhoto, vUv).rgb;
  float alpha = uOpacity;
  if (uTime > 23.0 && uTime < 28.0) {
    float restored = photographicRecovery(vec2(vUv.x, 1.0 - vUv.y), uTime);
    // Fine photographic cells resolve only at the moving front. The final
    // sample is exactly the original UV: no warp, recolouring or resynthesis.
    original = progressivePhotoCellColor(vUv, restored, original);
    alpha = progressivePhotoRevealAlpha(restored);
  }
  gl_FragColor = vec4(original, alpha);
  #include <colorspace_fragment>
}`

export const restoredRimFragment = `
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float border = min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y));
  float line = smoothstep(.0, .004, border) * (1.0-smoothstep(.006, .014, border));
  gl_FragColor = vec4(.7,.7,.74,line*uOpacity);
  #include <colorspace_fragment>
}`
