import { ramp, smooth } from './progress'

/** Only 04.5 owns this treatment. Match the existing endpoints exactly. */
export function portraitPresence(time: number) {
  return smooth(ramp(time, [17, 17.65])) * (1 - smooth(ramp(time, [22.4, 23])))
}

/** Photo-specific landmarks in unflipped source UV; these gate light, never warp it. */
export function portraitStage(x: number, y: number, seed: number) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1
  let start = 17.35 // hair and silhouette fragments
  if (ellipse(.666, .365, .075, .039)) start = 18.05
  else if (ellipse(.696, .427, .045, .049)) start = 18.65
  else if (ellipse(.654, .493, .065, .035)) start = 19.12
  else if (ellipse(.65, .41, .13, .18)) start = 18.8
  else if (y > .59) start = 19.45 + (y - .59) * 1.8
  return start + seed * .38
}

export function portraitTone(light: number, contrast: number) {
  return Math.min(.94, .045 + Math.pow(light, 1.15) * .83 + contrast * .16)
}

export function portraitMotion(time: number, reduced = false) {
  return reduced ? 0 : 1 - smooth(ramp(time, [18, 21.3]))
}

export const portraitPointsVertex = `
attribute vec4 aInk;
attribute vec4 aLife;
uniform float uTime;
uniform float uPresence;
uniform float uMotion;
uniform float uPixelRatio;
uniform float uCellSize;
varying vec4 vInk;
varying float vReveal;
void main() {
  float reveal = smoothstep(aLife.x, aLife.x + .9, uTime);
  float settle = (1.0 - smoothstep(18.0, 21.3, uTime)) * uMotion;
  vec3 p = position;
  p.xy += vec2(sin(aLife.y * 43.0 + uTime * .7), cos(aLife.y * 29.0 + uTime * .6))
    * .012 * settle * (1.0 - aLife.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Depth without changing the photograph's projected facial proportions.
  float originalZ = mv.z;
  mv.z += aLife.z * uPresence;
  mv.xy *= mv.z / originalZ;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uCellSize * uPixelRatio * (5.6 / -mv.z) * mix(.88, 1.08, aLife.y)
    * (1.0 + aInk.w * (.35 + aLife.y * .55));
  vInk = aInk;
  vReveal = reveal * uPresence;
}`

export const portraitPointsFragment = `
uniform sampler2D uGlyphs;
varying vec4 vInk;
varying float vReveal;
void main() {
  float glyph = texture2D(uGlyphs, vec2((vInk.x + gl_PointCoord.x) / 16.0, 1.0 - gl_PointCoord.y)).a;
  vec3 color = mix(vec3(.85, .73, .74), vec3(1.0, .86, .77), vInk.w);
  gl_FragColor = vec4(color * vInk.y, glyph * vInk.z * vReveal);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export const portraitDetailFragment = `
uniform sampler2D uPhoto;
uniform sampler2D uPortraitMap;
uniform float uTime;
uniform float uPresence;
varying vec2 vUv;
void main() {
  vec4 map = texture2D(uPortraitMap, vec2(vUv.x, 1.0 - vUv.y));
  float reveal = smoothstep(17.0 + map.g * 5.0, 17.9 + map.g * 5.0, uTime);
  vec3 photo = texture2D(uPhoto, vUv).rgb;
  // Quiet photographic micro-detail; black shadows keep the glyphs dimensional.
  vec3 color = photo * vec3(1.0, .93, .91) + map.b * vec3(.2, .13, .11);
  gl_FragColor = vec4(color, map.r * reveal * uPresence * (.22 + map.a * .45));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
