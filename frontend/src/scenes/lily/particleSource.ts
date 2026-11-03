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
export function lilyDissolvePart(name: string, materialNames: readonly string[] = []): number {
  const isCenterMaterial = materialNames.some((materialName) => /anther|filament|pistil/i.test(materialName))
  return name.startsWith('Petals') ? 0
    : name === 'Flower_Details' || name === 'Calyx' || isCenterMaterial ? 1 : 2
}

interface SurfaceMesh {
  mesh: Mesh
  part: number
  positions: NonNullable<ReturnType<Mesh['geometry']['getAttribute']>>
  index: ReturnType<Mesh['geometry']['getIndex']>
  vertexCount: number
}

interface SurfaceCaptureOptions {
  chunkSize?: number
  yieldToMain?: () => Promise<void>
  isCancelled?: () => boolean
}

/**
 * Capture a posed Lily GLB as a deterministic, area-weighted surface sampler.
 * Call after applying the final Bloom clip to capture that authored pose.
 */
export function createLilyGeometryParticleSource(root: Object3D): LilySurfaceSource {
  const steps = createSurfaceCaptureSteps(root, Number.MAX_SAFE_INTEGER)
  while (true) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/** Capture the same posed surface while yielding to paint between bounded triangle batches. */
export async function createLilyGeometryParticleSourceAsync(root: Object3D, options: SurfaceCaptureOptions = {}): Promise<LilySurfaceSource> {
  const chunkSize = Math.max(1, Math.floor(Number.isFinite(options.chunkSize) ? options.chunkSize! : 512))
  const yieldToMain = options.yieldToMain ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
  const isCancelled = options.isCancelled ?? (() => false)
  const steps = createSurfaceCaptureSteps(root, chunkSize)
  while (true) {
    if (isCancelled()) throw abortError()
    const step = steps.next()
    if (step.done) return step.value
    await yieldToMain()
  }
}

function* createSurfaceCaptureSteps(root: Object3D, chunkSize: number): Generator<void, LilySurfaceSource> {
  root.updateWorldMatrix(true, true)
  const meshes: SurfaceMesh[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const geometry = object.geometry
    const positions = geometry.getAttribute('position')
    if (!positions || positions.count < 3) return
    const index = geometry.getIndex()
    meshes.push({ mesh: object, part: lilyDissolvePart(object.name, materials.map((material) => material.name)), positions, index,
      vertexCount: index?.count ?? positions.count })
  })

  const triangleCapacity = meshes.reduce((total, mesh) => total + Math.floor(mesh.vertexCount / 3), 0)
  const triangleVertices = new Float32Array(triangleCapacity * 9)
  const triangleAreaEnds = new Float64Array(triangleCapacity)
  const triangleParts = new Uint8Array(triangleCapacity)
  const petalBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity }
  let minY = Infinity, maxY = -Infinity, totalArea = 0, triangleCount = 0, processed = 0
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const edgeA = new Vector3(), edgeB = new Vector3()

  for (const item of meshes) {
    for (let offset = 0; offset + 2 < item.vertexCount; offset += 3) {
      const ia = item.index ? item.index.getX(offset) : offset
      const ib = item.index ? item.index.getX(offset + 1) : offset + 1
      const ic = item.index ? item.index.getX(offset + 2) : offset + 2
      item.mesh.getVertexPosition(ia, a)
      item.mesh.getVertexPosition(ib, b)
      item.mesh.getVertexPosition(ic, c)
      item.mesh.localToWorld(a)
      item.mesh.localToWorld(b)
      item.mesh.localToWorld(c)
      for (let vertex = 0; vertex < 3; vertex++) {
        const point = vertex === 0 ? a : vertex === 1 ? b : c
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
        if (item.part === 0) {
          petalBounds.minX = Math.min(petalBounds.minX, point.x); petalBounds.maxX = Math.max(petalBounds.maxX, point.x)
          petalBounds.minY = Math.min(petalBounds.minY, point.y); petalBounds.maxY = Math.max(petalBounds.maxY, point.y)
          petalBounds.minZ = Math.min(petalBounds.minZ, point.z); petalBounds.maxZ = Math.max(petalBounds.maxZ, point.z)
        }
      }
      edgeA.subVectors(b, a)
      edgeB.subVectors(c, a)
      const area = edgeA.cross(edgeB).length() * 0.5
      if (area > 1e-9) {
        totalArea += area
        const vertexOffset = triangleCount * 9
        triangleVertices[vertexOffset] = a.x; triangleVertices[vertexOffset + 1] = a.y; triangleVertices[vertexOffset + 2] = a.z
        triangleVertices[vertexOffset + 3] = b.x; triangleVertices[vertexOffset + 4] = b.y; triangleVertices[vertexOffset + 5] = b.z
        triangleVertices[vertexOffset + 6] = c.x; triangleVertices[vertexOffset + 7] = c.y; triangleVertices[vertexOffset + 8] = c.z
        triangleAreaEnds[triangleCount] = totalArea
        triangleParts[triangleCount] = item.part
        triangleCount += 1
      }
      processed += 1
      if (processed % chunkSize === 0) yield
    }
  }

  const center: [number, number, number] = Number.isFinite(petalBounds.minX)
    ? [(petalBounds.minX + petalBounds.maxX) / 2, (petalBounds.minY + petalBounds.maxY) / 2, (petalBounds.minZ + petalBounds.maxZ) / 2]
    : [0, 0, 0]
  let radius = 0
  for (let i = 0; i < triangleCount; i++) {
    if (triangleParts[i] === 0) {
      for (let j = 0; j < 3; j++) radius = Math.max(radius, Math.hypot(triangleVertices[i * 9 + j * 3]! - center[0], triangleVertices[i * 9 + j * 3 + 2]! - center[2]))
    }
    if ((i + 1) % chunkSize === 0) yield
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

function abortError() {
  const error = new Error('Lily surface capture cancelled')
  error.name = 'AbortError'
  return error
}


function unit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 19.19) * 43758.5453
  return value - Math.floor(value)
}
