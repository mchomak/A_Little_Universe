import type { IrisColorGrading } from './config'

export type LinearSrgb = readonly [number, number, number]
export type Oklab = readonly [number, number, number]
export type Oklch = { l: number; c: number; h: number }
export type IrisZoneWeights = { inner: number; middle: number; outer: number; limbal: number }

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-9))
  return t * t * (3 - 2 * t)
}

/** Convert linear-sRGB to OKLab. The input is linear, not CSS/sRGB encoded. */
export function linearSrgbToOklab([r, g, b]: LinearSrgb): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lRoot = Math.cbrt(l), mRoot = Math.cbrt(m), sRoot = Math.cbrt(s)
  return [
    0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot,
  ]
}

/** Convert OKLab to linear-sRGB. Values may be outside the displayable gamut. */
export function oklabToLinearSrgb([L, a, b]: Oklab): [number, number, number] {
  const lRoot = L + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = L - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = L - 0.0894841775 * a - 1.2914855480 * b
  const l = lRoot * lRoot * lRoot, m = mRoot * mRoot * mRoot, s = sRoot * sRoot * sRoot
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

export function oklabToOklch([l, a, b]: Oklab): Oklch {
  const c = Math.hypot(a, b)
  return { l, c, h: c < 1e-8 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }
}

export function oklchToOklab({ l, c, h }: Oklch): Oklab {
  const angle = h * Math.PI / 180
  return [l, c * Math.cos(angle), c * Math.sin(angle)]
}

export function linearSrgbToOklch(rgb: LinearSrgb): Oklch {
  return oklabToOklch(linearSrgbToOklab(rgb))
}

/** Reduce chroma with a fixed OKLCH hue/lightness before the final epsilon clamp. */
export function gamutMapOklab(lab: Oklab): [number, number, number] {
  const direct = oklabToLinearSrgb(lab)
  if (direct.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1)) return direct

  const [lightness, a, b] = lab
  const chroma = Math.hypot(a, b)
  if (chroma < 1e-8) return oklabToLinearSrgb([clamp(lightness), 0, 0]).map((v) => clamp(v)) as [number, number, number]
  const hueA = a / chroma, hueB = b / chroma
  let low = 0, high = 1
  for (let iteration = 0; iteration < 14; iteration++) {
    const scale = (low + high) * 0.5
    const candidate = oklabToLinearSrgb([lightness, hueA * chroma * scale, hueB * chroma * scale])
    if (candidate.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1)) low = scale
    else high = scale
  }
  return oklabToLinearSrgb([lightness, hueA * chroma * low, hueB * chroma * low]).map((v) => clamp(v)) as [number, number, number]
}

export function oklchToHex(color: Oklch): string {
  const linear = gamutMapOklab(oklchToOklab(color))
  const encoded = linear.map(linearToSrgb)
  return `#${encoded.map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function hexToOklch(hex: string): Oklch {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Expected a six-digit hex color')
  const encoded: [number, number, number] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]
  return linearSrgbToOklch(encoded.map(srgbToLinear) as [number, number, number])
}

export function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}
export function linearToSrgb(channel: number) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.max(channel, 0) ** (1 / 2.4) - 0.055
}
function hueDistance(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

export function computeIrisZoneWeights(normalizedRadius: number, settings: Pick<IrisColorGrading, 'innerZoneRadius' | 'amberTransitionWidth' | 'outerZoneStart'>): IrisZoneWeights {
  const radius = clamp(normalizedRadius)
  const innerRadius = clamp(settings.innerZoneRadius, 0, 0.48)
  const transition = clamp(settings.amberTransitionWidth, 0.01, 0.16)
  const outerStart = clamp(Math.max(settings.outerZoneStart, innerRadius + transition * 2), innerRadius + transition * 2, 0.98)
  const inner = 1 - smoothstep(innerRadius, innerRadius + transition, radius)
  const middle = smoothstep(innerRadius, innerRadius + transition, radius) * (1 - smoothstep(outerStart - transition, outerStart + transition, radius))
  const outer = smoothstep(outerStart - transition, outerStart + transition, radius)
  return { inner, middle, outer, limbal: smoothstep(0.86, 0.94, radius) }
}

/** CPU reference for the fragment shader; rgb is linear-sRGB and radius is pupil-edge to iris-edge normalized. */
export function gradeIrisColor(rgb: LinearSrgb, normalizedRadius: number, config: IrisColorGrading): [number, number, number] {
  if (!config.enabled || config.strength <= 0) return [rgb[0], rgb[1], rgb[2]]
  const sourceLab = linearSrgbToOklab(rgb)
  const sourceLch = oklabToOklch(sourceLab)
  const zones = computeIrisZoneWeights(normalizedRadius, config)
  const grayConfidence = smoothstep(0.008, 0.042, sourceLch.c)
  const grayFactor = mix(config.grayRecolorStrength, 1, grayConfidence)
  const gradeStrength = clamp(config.strength)
  const amberHueMask = 1 - smoothstep(24, 52, hueDistance(sourceLch.h, config.amberHue))
  const amberColorMask = smoothstep(0.018, 0.055, sourceLch.c) * amberHueMask
  const amberMask = zones.inner * amberColorMask
  const amberProtectionEnd = clamp(config.innerZoneRadius + config.amberTransitionWidth * 2, 0, 1)
  const amberProtection = 1 - smoothstep(config.innerZoneRadius + config.amberTransitionWidth, amberProtectionEnd, clamp(normalizedRadius))
  const preservedAmber = amberProtection * amberColorMask * clamp(config.amberPreservation)

  const mainTarget = oklchToOklab({ l: sourceLab[0], c: config.blueChroma, h: config.targetBlueHue })
  const middleTarget = oklchToOklab({ l: sourceLab[0], c: config.middleBlueChroma, h: config.middleBlueHue })
  const outerTarget = oklchToOklab({ l: sourceLab[0], c: config.outerBlueChroma, h: config.outerBlueHue })
  const amberTarget = oklchToOklab({ l: sourceLab[0], c: config.amberChroma, h: config.amberHue })
  const ringTarget = oklchToOklab({ l: sourceLab[0], c: config.limbalRingChroma, h: config.limbalRingHue })

  let a = sourceLab[1], b = sourceLab[2]
  const middleAmount = gradeStrength * zones.middle * clamp(config.middleColorStrength) * grayFactor * (1 - preservedAmber)
  const outerAmount = gradeStrength * zones.outer * clamp(config.outerColorStrength) * grayFactor * (1 - preservedAmber)
  const middleA = mix(mainTarget[1], middleTarget[1], grayConfidence), middleB = mix(mainTarget[2], middleTarget[2], grayConfidence)
  a = mix(a, middleA, middleAmount); b = mix(b, middleB, middleAmount)
  a = mix(a, outerTarget[1], outerAmount); b = mix(b, outerTarget[2], outerAmount)

  const amberAmount = gradeStrength * amberMask * (1 - clamp(config.amberPreservation))
  a = mix(a, amberTarget[1], amberAmount); b = mix(b, amberTarget[2], amberAmount)

  const radialTargetL = mix(0.62, 0.49, zones.outer)
  let lightness = mix(radialTargetL, sourceLab[0], clamp(config.lightnessPreservation))
  lightness = mix(sourceLab[0], lightness, clamp(gradeStrength * Math.max(zones.middle * config.middleColorStrength, zones.outer * config.outerColorStrength)))
  const ringAmount = gradeStrength * zones.limbal * clamp(config.outerColorStrength) * grayFactor
  a = mix(a, ringTarget[1], ringAmount); b = mix(b, ringTarget[2], ringAmount)
  lightness *= 1 - clamp(config.limbalRingDarkness) * zones.limbal * gradeStrength * grayFactor
  lightness = (lightness - 0.5) * config.contrast + 0.5 + config.brightness
  return gamutMapOklab([clamp(lightness), a, b])
}
