export const NEUTRAL_IMPORTANCE = 128

export type ImportanceBrush = {
  x: number
  y: number
  radius: number
  value: number
  softness: number
  intensity: number
  erase: boolean
}

export function createNeutralImportanceMask(width: number, height: number) {
  validateDimensions(width, height)
  return new Uint8Array(width * height).fill(NEUTRAL_IMPORTANCE)
}

/** Applies a feathered brush using photo pixel coordinates; the source mask remains grayscale. */
export function paintImportanceMask(mask: Uint8Array, width: number, height: number, brush: ImportanceBrush) {
  validateDimensions(width, height)
  if (mask.length !== width * height) throw new RangeError('Importance mask dimensions do not match its buffer.')
  const radius = clamp(brush.radius, 0.5, Math.max(width, height))
  const softness = clamp(brush.softness, 0, 1)
  const strength = clamp(brush.intensity, 0, 1)
  const target = brush.erase ? NEUTRAL_IMPORTANCE : Math.round(clamp(brush.value, 0, 255))
  const left = Math.max(0, Math.floor(brush.x - radius))
  const right = Math.min(width - 1, Math.ceil(brush.x + radius))
  const top = Math.max(0, Math.floor(brush.y - radius))
  const bottom = Math.min(height - 1, Math.ceil(brush.y + radius))
  const innerRadius = radius * (1 - softness)

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const distance = Math.hypot(x + 0.5 - brush.x, y + 0.5 - brush.y)
      if (distance > radius) continue
      const edge = softness === 0 || distance <= innerRadius ? 1 : 1 - smoothstep(innerRadius, radius, distance)
      const amount = edge * strength
      const index = y * width + x
      mask[index] = Math.round(mask[index]! + (target - mask[index]!) * amount)
    }
  }
}

function validateDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('Importance mask dimensions must be positive integers.')
  }
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = Math.min(1, Math.max(0, (value - edge0) / Math.max(0.0001, edge1 - edge0)))
  return amount * amount * (3 - 2 * amount)
}
