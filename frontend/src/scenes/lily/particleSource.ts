import { Mesh, Vector3, type Object3D } from 'three'
import type { LilyParticleSource } from '../shared/identityParticles'

/**
 * Capture a posed Lily GLB as a deterministic, area-weighted surface sampler.
 * Call after applying the final Bloom clip to capture that authored pose.
 */
export function createLilyGeometryParticleSource(root: Object3D): LilyParticleSource {
  root.updateWorldMatrix(true, true)
  const vertices: number[] = []
  const cumulativeAreas: number[] = []
  let totalArea = 0
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const edgeA = new Vector3(), edgeB = new Vector3()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
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
      edgeA.subVectors(b, a)
      edgeB.subVectors(c, a)
      const area = edgeA.cross(edgeB).length() * 0.5
      if (area <= 1e-9) continue
      totalArea += area
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
      cumulativeAreas.push(totalArea)
    }
  })

  // Keep only compact typed arrays after the one-time CPU capture.
  const triangleVertices = Float32Array.from(vertices)
  const triangleAreaEnds = Float64Array.from(cumulativeAreas)
  const triangleCount = triangleAreaEnds.length
  return {
    sample(index, count) {
      if (triangleCount === 0 || totalArea <= 0) return [0, 0, 0]
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
      const u = Math.sqrt(unit(ordinal * 2 + 1))
      const v = unit(ordinal * 2 + 2)
      const wa = 1 - u
      const wb = u * (1 - v)
      const wc = u * v
      return [
        (triangleVertices[offset] ?? 0) * wa + (triangleVertices[offset + 3] ?? 0) * wb + (triangleVertices[offset + 6] ?? 0) * wc,
        (triangleVertices[offset + 1] ?? 0) * wa + (triangleVertices[offset + 4] ?? 0) * wb + (triangleVertices[offset + 7] ?? 0) * wc,
        (triangleVertices[offset + 2] ?? 0) * wa + (triangleVertices[offset + 5] ?? 0) * wb + (triangleVertices[offset + 8] ?? 0) * wc,
      ]
    },
  }
}


function unit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 19.19) * 43758.5453
  return value - Math.floor(value)
}
