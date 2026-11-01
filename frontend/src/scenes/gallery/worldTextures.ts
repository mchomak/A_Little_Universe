import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

/** Soft fixed moon halo texture, separate from the cloud shading system. */
export function createMoonHaloTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for the gallery moon halo')
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
