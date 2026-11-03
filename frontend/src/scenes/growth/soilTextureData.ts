export interface SoilTextureData {
  color: Uint8Array
  height: Uint8Array
  roughness: Uint8Array
}

/** Deterministic warm soil grain, shallow relief, and high-roughness variation. */
export function createSoilTextureData(size = 256, initialSeed = 31991): SoilTextureData {
  const color = new Uint8Array(size * size * 4)
  const height = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  let seed = initialSeed >>> 0 || 1
  const random = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 0x100000000
  }
  const byte = (value: number) => Math.min(255, Math.max(0, Math.round(value)))

  for (let y = 0; y < size; y += 1) {
    const v = y / size
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const broad = Math.sin(u * Math.PI * 10 + Math.sin(v * Math.PI * 6) * 0.8) * Math.cos(v * Math.PI * 12) * 0.42
      const sediment = Math.sin((u * 4 + Math.sin(v * Math.PI * 3) * 0.14) * Math.PI * 2) * 0.24
      const grain = (random() - 0.5) * 0.42 + (random() - 0.5) * 0.3
      const noise = broad + sediment + grain
      const pixel = (y * size + x) * 4

      color[pixel] = byte(218 + noise * 48)
      color[pixel + 1] = byte(196 + noise * 44)
      color[pixel + 2] = byte(172 + noise * 38)
      color[pixel + 3] = 255

      const relief = byte(128 + noise * 102)
      height[pixel] = relief
      height[pixel + 1] = relief
      height[pixel + 2] = relief
      height[pixel + 3] = 255

      const matte = byte(192 + random() * 63)
      roughness[pixel] = matte
      roughness[pixel + 1] = matte
      roughness[pixel + 2] = matte
      roughness[pixel + 3] = 255
    }
  }
  return { color, height, roughness }
}
