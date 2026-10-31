import { Mesh, Vector3, type Object3D } from 'three'
import type { LilyParticleSource } from '../shared/identityParticles'

export interface LilySurfaceSource extends LilyParticleSource {
  readonly center: readonly [number, number, number]
  readonly radius: number
  readonly minY: number
  readonly maxY: number
  sampleSurface(index: number, count: number): { position: [number, number, number]; part: number }
}

/** Petals first, floral centre second, foliage and stem last. */
export function lilyDissolvePart(name: string): number {
  return name.startsWith('Petals') ? 0 : name === 'Flower_Details' || name === 'Calyx' ? 1 : 2
}

/**
 * Capture a posed Lily GLB as a deterministic, area-weighted surface sampler.
 * Call after applying the final Bloom clip to capture that authored pose.
 */
export function createLilyGeometryParticleSource(root: Object3D): LilySurfaceSource {
  root.updateWorldMatrix(true, true)
  const vertices: number[] = []
  const cumulativeAreas: number[] = []
  const triangleParts: number[] = []
  const petalBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity }
  let minY = Infinity, maxY = -Infinity
  let totalArea = 0
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const edgeA = new Vector3(), edgeB = new Vector3()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const part = lilyDissolvePart(object.name)
    const geometry = object.geometry
    const positions = geometry.getAttribute('position')
    const index = geometry.getIndex()
    if (!positions || positions.count < 3) return
    const vertexCount = index?.count ?? positions.count
    for (let offset = 0; offset + 2 < vertexCount; offset += 3) {
      const ia = index ? index.getX(offset) : offset
      const ib = index ? index.getX(offset + 1) : offset + 1
      const ic = index ? index.getX(offset + 2) : offset + 2
      object.getVertexPosition(ia, a)
      object.getVertexPosition(ib, b)
      object.getVertexPosition(ic, c)
      object.localToWorld(a)
      object.localToWorld(b)
      object.localToWorld(c)
      for (let vertex = 0; vertex < 3; vertex++) {
        const point = vertex === 0 ? a : vertex === 1 ? b : c
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
        if (part === 0) {
          petalBounds.minX = Math.min(petalBounds.minX, point.x); petalBounds.maxX = Math.max(petalBounds.maxX, point.x)
          petalBounds.minY = Math.min(petalBounds.minY, point.y); petalBounds.maxY = Math.max(petalBounds.maxY, point.y)
          petalBounds.minZ = Math.min(petalBounds.minZ, point.z); petalBounds.maxZ = Math.max(petalBounds.maxZ, point.z)
        }
      }
      edgeA.subVectors(b, a)
      edgeB.subVectors(c, a)
      const area = edgeA.cross(edgeB).length() * 0.5
      if (area <= 1e-9) continue
      totalArea += area
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
      cumulativeAreas.push(totalArea)
      triangleParts.push(part)
    }
  })

  // Keep only compact typed arrays after the one-time CPU capture.
  const triangleVertices = Float32Array.from(vertices)
  const triangleAreaEnds = Float64Array.from(cumulativeAreas)
  const triangleCount = triangleAreaEnds.length
  const center: [number, number, number] = Number.isFinite(petalBounds.minX)
    ? [(petalBounds.minX + petalBounds.maxX) / 2, (petalBounds.minY + petalBounds.maxY) / 2, (petalBounds.minZ + petalBounds.maxZ) / 2]
    : [0, 0, 0]
  let radius = 0
  for (let i = 0; i < triangleCount; i++) if (triangleParts[i] === 0) {
    for (let j = 0; j < 3; j++) radius = Math.max(radius, Math.hypot(triangleVertices[i * 9 + j * 3]! - center[0], triangleVertices[i * 9 + j * 3 + 2]! - center[2]))
  }
  const sampleSurface = (index: number, count: number): { position: [number, number, number]; part: number } => {
      if (triangleCount === 0 || totalArea <= 0) return { position: [0, 0, 0], part: 2 }
      const ordinal = Math.max(0, Math.floor(Number.isFinite(index) ? index : 0))
      const sampleCount = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1))
      const trianglePick = unit(ordinal * 2 + sampleCount * 17) * totalArea
      let low = 0, high = triangleCount - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if ((triangleAreaEnds[middle] ?? 0) < trianglePick) low = middle + 1
        else high = middle
      }
      const offset = low * 9
      const u = Math.sqrt(unit(ordinal * 2 + 1)), v = unit(ordinal * 2 + 2)
      const wa = 1 - u, wb = u * (1 - v), wc = u * v
      return { part: triangleParts[low]!, position: [
        triangleVertices[offset]! * wa + triangleVertices[offset + 3]! * wb + triangleVertices[offset + 6]! * wc,
        triangleVertices[offset + 1]! * wa + triangleVertices[offset + 4]! * wb + triangleVertices[offset + 7]! * wc,
        triangleVertices[offset + 2]! * wa + triangleVertices[offset + 5]! * wb + triangleVertices[offset + 8]! * wc,
      ] }
  }
  return {
    center, radius: Math.max(radius, 0.001), minY: Number.isFinite(minY) ? minY : 0, maxY: Number.isFinite(maxY) ? maxY : 1,
    sampleSurface,
    sample(index, count) { return sampleSurface(index, count).position },
  }
}


function unit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 19.19) * 43758.5453
  return value - Math.floor(value)
}
