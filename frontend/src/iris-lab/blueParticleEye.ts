export type IrisEllipseMask = { x: number; y: number; radiusX: number; radiusY: number; rotation: number }

export type BlueEyePixelSample = {
  uv: Float32Array
  color: Float32Array
  brightness: Float32Array
  random: Float32Array
  count: number
  width: number
  height: number
}

const srgbToLinear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4

/** Convert the decoded eye photograph to stable, color-managed pixel particles. */
export function processBlueEyePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maxPoints = Number.POSITIVE_INFINITY,
  random: () => number = Math.random,
): BlueEyePixelSample {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid RGBA pixel plane')
  if (!(maxPoints > 0)) throw new Error('Invalid particle limit')
  const stride = Number.isFinite(maxPoints) ? Math.max(1, Math.ceil(width * height / maxPoints)) : 1
  let count = 0
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) if (data[(y * width + x) * 4 + 3]! > 12) count++

  const uv = new Float32Array(count * 2), color = new Float32Array(count * 3), brightness = new Float32Array(count), randomValues = new Float32Array(count)
  let point = 0
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) {
    const offset = (y * width + x) * 4
    if (data[offset + 3]! <= 12) continue
    const i = point * 3
    const r = srgbToLinear(data[offset]! / 255), g = srgbToLinear(data[offset + 1]! / 255), b = srgbToLinear(data[offset + 2]! / 255)
    uv[point * 2] = (x + 0.5) / width
    uv[point * 2 + 1] = (y + 0.5) / height
    color[i] = r; color[i + 1] = g; color[i + 2] = b
    brightness[point] = r * 0.2126 + g * 0.7152 + b * 0.0722
    randomValues[point] = random()
    point++
  }
  return { uv, color, brightness, random: randomValues, count, width, height }
}

/** Ellipse distance in image UVs, with rotation applied before scaling. */
export function irisMaskDistance(point: { x: number; y: number }, ellipse: IrisEllipseMask): number {
  if (!(ellipse.radiusX > 0) || !(ellipse.radiusY > 0)) throw new Error('Ellipse radii must be positive')
  const dx = point.x - ellipse.x, dy = point.y - ellipse.y
  const cosine = Math.cos(ellipse.rotation), sine = Math.sin(ellipse.rotation)
  const x = (dx * cosine + dy * sine) / ellipse.radiusX
  const y = (-dx * sine + dy * cosine) / ellipse.radiusY
  return Math.hypot(x, y)
}

/** Keep a soft, compact halo at full focus; lower focus can reveal more of the source eye. */
export function supportRadiusForIrisFocus(focus: number, outerEyeFade: number): number {
  const f = Math.min(1, Math.max(0, focus)), fade = Math.min(1, Math.max(0, outerEyeFade))
  return 1.025 + (1 - f) * (1.1 + (1 - fade) * 1.2)
}
