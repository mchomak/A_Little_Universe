export type PixelPlane = { data: Uint8ClampedArray; width: number; height: number; depthData?: Uint8ClampedArray; depthScale?: number; worldSpan?: number }
export type MemorySignalSettings = { backgroundThreshold: number; alphaThreshold: number; brightnessThreshold: number; maxPoints: number }
export type MemorySignalSample = { positions: Float32Array; colors: Float32Array; brightness: Float32Array; random: Float32Array; edgeFactor: Float32Array; relief: Float32Array; count: number }

const srgbToLinear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
const luminance = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

/**
 * Builds a bounded point cloud from RGBA pixels. Transparent areas are always
 * removed. For opaque photos, a connected border flood fill suppresses a flat
 * background without cutting enclosed dark features such as the pupil.
 */
export function sampleMemorySignalPixels(plane: PixelPlane, settings: MemorySignalSettings): MemorySignalSample {
  const { data, width, height } = plane
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4 || (plane.depthData && plane.depthData.length !== width * height * 4)) throw new Error('Invalid RGBA pixel plane')
  const { backgroundThreshold, alphaThreshold, brightnessThreshold, maxPoints } = settings
  if (![backgroundThreshold, alphaThreshold, brightnessThreshold, maxPoints].every(Number.isFinite) || backgroundThreshold < 0 || alphaThreshold < 0 || brightnessThreshold < 0 || maxPoints < 1) throw new Error('Invalid Memory Signal settings')

  const pixels = width * height
  const edgeSamples: [number, number, number][] = []
  for (let x = 0; x < width; x++) {
    edgeSamples.push(rgbAt(data, x), rgbAt(data, (height - 1) * width + x))
  }
  for (let y = 1; y < height - 1; y++) {
    edgeSamples.push(rgbAt(data, y * width), rgbAt(data, y * width + width - 1))
  }
  const background = [0, 1, 2].map((channel) => median(edgeSamples.map((pixel) => pixel[channel]!))) as [number, number, number]
  const bgMask = new Uint8Array(pixels)
  const queue = new Int32Array(pixels)
  let head = 0, tail = 0
  const thresholdSq = backgroundThreshold * backgroundThreshold * 3 * 255 * 255
  const addBackground = (index: number) => {
    if (bgMask[index] || data[index * 4 + 3]! / 255 <= alphaThreshold) return
    const [r, g, b] = rgbAt(data, index)
    const dr = r - background[0], dg = g - background[1], db = b - background[2]
    if (dr * dr + dg * dg + db * db > thresholdSq) return
    bgMask[index] = 1
    queue[tail++] = index
  }
  // Only flood fill from the edge; enclosed low-luminance pupil pixels survive.
  for (let x = 0; x < width; x++) { addBackground(x); addBackground((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { addBackground(y * width); addBackground(y * width + width - 1) }
  while (head < tail) {
    const at = queue[head++]!
    const x = at % width, y = Math.floor(at / width)
    if (x > 0) addBackground(at - 1)
    if (x + 1 < width) addBackground(at + 1)
    if (y > 0) addBackground(at - width)
    if (y + 1 < height) addBackground(at + width)
  }

  const sampleStep = Math.max(1, Math.floor(Math.sqrt(pixels / maxPoints)))
  const candidateGridCount = Math.ceil(width / sampleStep) * Math.ceil(height / sampleStep)
  const candidateCount = Math.min(maxPoints, candidateGridCount)
  const selectionProbability = candidateCount / candidateGridCount
  const positions = new Float32Array(candidateCount * 3), colors = new Float32Array(candidateCount * 3)
  const brightness = new Float32Array(candidateCount), random = new Float32Array(candidateCount), edgeFactor = new Float32Array(candidateCount), relief = new Float32Array(candidateCount)
  const visible = (index: number) => data[index * 4 + 3]! / 255 > alphaThreshold && !bgMask[index]
  let count = 0
  const scale = (plane.worldSpan ?? 2.2) / Math.max(width, height)
  for (let y = 0; y < height; y += sampleStep) for (let x = 0; x < width; x += sampleStep) {
    const index = y * width + x
    if (count >= candidateCount || hash01(index) > selectionProbability || !visible(index)) continue
    const offset = index * 4, r = data[offset]!, g = data[offset + 1]!, b = data[offset + 2]!, lum = luminance(r, g, b)
    const p = count * 3
    positions[p] = (x + sampleStep * 0.5 - width * 0.5) * scale
    positions[p + 1] = -(y + sampleStep * 0.5 - height * 0.5) * scale
    positions[p + 2] = plane.depthData && plane.depthData[offset + 3]! > 0
      ? (plane.depthData[offset]! / 255 + plane.depthData[offset + 1]! / (255 * 255)) * (plane.depthScale ?? 1.5)
      : 0
    colors[p] = srgbToLinear(r / 255); colors[p + 1] = srgbToLinear(g / 255); colors[p + 2] = srgbToLinear(b / 255)
    // Low values stay as dark particles (so a pupil stays legible) while the
    // threshold controls their relief and emitted light independently of masking.
    const signal = Math.min(1, Math.max(0, (lum - brightnessThreshold) / Math.max(0.01, 1 - brightnessThreshold)))
    brightness[count] = signal
    relief[count] = signal
    random[count] = hash01(index)
    let solid = 0, tested = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx * sampleStep, ny = y + dy * sampleStep
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) { tested++; if (visible(ny * width + nx)) solid++ }
    }
    const density = tested ? solid / tested : 0
    edgeFactor[count] = Math.min(1, Math.max(0, (1 - density) ** 1.5 + (lum < 0.2 ? 0.12 : 0)))
    count++
  }
  return { positions: positions.slice(0, count * 3), colors: colors.slice(0, count * 3), brightness: brightness.slice(0, count), random: random.slice(0, count), edgeFactor: edgeFactor.slice(0, count), relief: relief.slice(0, count), count }
}

function rgbAt(data: Uint8ClampedArray, pixel: number): [number, number, number] {
  const i = pixel * 4
  return [data[i]!, data[i + 1]!, data[i + 2]!]
}
function median(values: number[]) {
  if (!values.length) return 0
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]!
}
function hash01(value: number) {
  let x = value | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295
}
