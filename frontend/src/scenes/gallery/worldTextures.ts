import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

interface NoiseGrid {
  columns: number
  rows: number
  values: Float32Array
}

function seededRandom(seed: number) {
  let state = seed >>> 0 || 0x6d2b79f5
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function createNoiseGrid(seed: number, columns: number, rows: number): NoiseGrid {
  const random = seededRandom(seed)
  const values = new Float32Array((columns + 1) * (rows + 1))
  for (let index = 0; index < values.length; index++) values[index] = random()
  return { columns, rows, values }
}

function smoothstep(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

function sampleGrid(grid: NoiseGrid, u: number, v: number) {
  const x = Math.max(0, Math.min(1, u)) * grid.columns
  const y = Math.max(0, Math.min(1, v)) * grid.rows
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(grid.columns, x0 + 1), y1 = Math.min(grid.rows, y0 + 1)
  const fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const stride = grid.columns + 1
  const top = (grid.values[y0 * stride + x0] ?? 0) * (1 - sx) + (grid.values[y0 * stride + x1] ?? 0) * sx
  const bottom = (grid.values[y1 * stride + x0] ?? 0) * (1 - sx) + (grid.values[y1 * stride + x1] ?? 0) * sx
  return top * (1 - sy) + bottom * sy
}

/** Builds deterministic, broken cumulus silhouettes with dark cores and cold, soft rims. */
export function createCloudTexture(seed: number, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for gallery atmosphere textures')

  const random = seededRandom(seed ^ 0x51ed270b)
  const warpGrid = createNoiseGrid(seed + 29, 12, 8)
  const detailGrid = createNoiseGrid(seed + 59, 48, 32)
  const clusters = [0.22, 0.72].map((centerX) => ({
    x: centerX + (random() - 0.5) * 0.12,
    y: 0.48 + (random() - 0.5) * 0.12,
    width: 0.22 + random() * 0.08,
  }))
  const lobes = clusters.flatMap((cluster) => Array.from({ length: 4 }, (_, index) => ({
    x: cluster.x + (random() - 0.5) * cluster.width * 1.65,
    y: cluster.y + (random() - 0.5) * 0.3 + (index === 0 ? -0.06 : 0.02),
    radiusX: 0.11 + random() * 0.12,
    radiusY: 0.2 + random() * 0.23,
  })))
  if (random() > 0.45) {
    lobes.push({ x: 0.49 + (random() - 0.5) * 0.08, y: 0.56, radiusX: 0.075, radiusY: 0.23 })
  }
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1)
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1)
      const warp = (sampleGrid(warpGrid, u, v) - 0.5) * 0.34
        + (sampleGrid(detailGrid, u * 1.04, v * 1.08) - 0.5) * 0.16
      const detail = sampleGrid(detailGrid, u * 1.08, v * 1.06)
      let cloudShape = -1
      for (const lobe of lobes) {
        const dx = (u - lobe.x) / lobe.radiusX
        const dy = (v - lobe.y) / lobe.radiusY
        cloudShape = Math.max(cloudShape, 1 - Math.sqrt(dx * dx + dy * dy) + warp)
      }
      const coverage = smoothstep(-0.22, 0.14, cloudShape)
      const edgeX = smoothstep(0.005, 0.055, u) * (1 - smoothstep(0.945, 0.995, u))
      const edgeY = smoothstep(0.005, 0.055, v) * (1 - smoothstep(0.945, 0.995, v))
      const edgeRim = 1 - smoothstep(0.015, 0.31, Math.abs(cloudShape))
      const alpha = coverage * edgeX * edgeY * (0.54 + detail * 0.22)
      const light = Math.max(0, Math.min(1, 0.18 + edgeRim * 0.52 + detail * 0.14))
      const index = (y * width + x) * 4
      image.data[index] = Math.round(255 * light * 0.75)
      image.data[index + 1] = Math.round(255 * light * 0.88)
      image.data[index + 2] = Math.round(255 * light)
      image.data[index + 3] = Math.round(255 * alpha)
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createMoonTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for the gallery moon')

  const center = size / 2
  const radius = size * 0.48
  context.save()
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.clip()
  const surface = context.createRadialGradient(center * 0.73, center * 0.68, radius * 0.04, center, center, radius)
  surface.addColorStop(0, '#f7f6ef')
  surface.addColorStop(0.62, '#e0e5e9')
  surface.addColorStop(0.9, '#c1ccda')
  surface.addColorStop(1, '#93a4b8')
  context.fillStyle = surface
  context.fillRect(0, 0, size, size)

  const random = seededRandom(271828)
  for (let index = 0; index < 17; index++) {
    const craterRadius = radius * (0.018 + random() * 0.075)
    const x = center + (random() - 0.5) * radius * 1.55
    const y = center + (random() - 0.5) * radius * 1.55
    const shade = 0.035 + random() * 0.045
    const crater = context.createRadialGradient(x - craterRadius * 0.2, y - craterRadius * 0.25, craterRadius * 0.1, x, y, craterRadius)
    crater.addColorStop(0, `rgba(62,77,94,${shade})`)
    crater.addColorStop(0.76, `rgba(77,93,111,${shade * 0.6})`)
    crater.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = crater
    context.beginPath()
    context.arc(x, y, craterRadius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
  context.globalCompositeOperation = 'destination-in'
  const limb = context.createRadialGradient(center, center, radius * 0.9, center, center, radius)
  limb.addColorStop(0, 'rgba(255,255,255,1)')
  limb.addColorStop(0.72, 'rgba(255,255,255,.78)')
  limb.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = limb
  context.fillRect(0, 0, size, size)
  context.globalCompositeOperation = 'source-over'

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createMoonHaloTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for the moon halo')
  const center = size / 2
  const halo = context.createRadialGradient(center, center, 0, center, center, size / 2)
  halo.addColorStop(0, 'rgba(219,232,250,.44)')
  halo.addColorStop(0.17, 'rgba(170,194,226,.27)')
  halo.addColorStop(0.48, 'rgba(118,151,193,.09)')
  halo.addColorStop(1, 'rgba(105,136,176,0)')
  context.fillStyle = halo
  context.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
