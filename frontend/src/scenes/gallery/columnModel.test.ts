import { readFileSync } from 'node:fs'
import { Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { describe, expect, it, vi } from 'vitest'
import {
  acquireGalleryColumnMaterials,
  acquireGalleryColumnShaftGeometry,
  extendGalleryColumnShaft,
  GALLERY_COLUMN_SHAFT_SEGMENTS,
  getGalleryColumnAssetBounds,
  getGalleryColumnPlacement,
  getGalleryColumnShaftLocalBounds,
} from './columnModel'

const columnAssetUrl = new URL('../../assets/gallery-ionic-column/column.glb', import.meta.url)

function withoutEmbeddedImages(glb: Buffer): ArrayBuffer {
  const jsonLength = glb.readUInt32LE(12)
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as Record<string, unknown>
  const binChunkHeader = 20 + jsonLength
  const binLength = glb.readUInt32LE(binChunkHeader)
  const binOffset = binChunkHeader + 8
  const binary = glb.subarray(binOffset, binOffset + binLength)
  const removeTextureReferences = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(removeTextureReferences); return }
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    for (const [key, child] of Object.entries(record)) {
      if (key.endsWith('Texture')) delete record[key]
      else removeTextureReferences(child)
    }
  }
  removeTextureReferences(json)
  delete json.images
  delete json.textures
  delete json.samplers

  const rawJson = Buffer.from(JSON.stringify(json))
  const paddedJson = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 0x20)])
  const totalLength = 12 + 8 + paddedJson.length + 8 + binary.length
  const packed = Buffer.alloc(totalLength)
  packed.writeUInt32LE(0x46546c67, 0)
  packed.writeUInt32LE(2, 4)
  packed.writeUInt32LE(totalLength, 8)
  packed.writeUInt32LE(paddedJson.length, 12)
  packed.writeUInt32LE(0x4e4f534a, 16)
  paddedJson.copy(packed, 20)
  const outputBinHeader = 20 + paddedJson.length
  packed.writeUInt32LE(binary.length, outputBinHeader)
  packed.writeUInt32LE(0x004e4942, outputBinHeader + 4)
  binary.copy(packed, outputBinHeader + 8)
  return packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer
}

async function loadAssetScene() {
  const asset = withoutEmbeddedImages(readFileSync(columnAssetUrl))
  return new Promise<import('three').Object3D>((resolve, reject) => {
    new GLTFLoader().parse(asset, '', (gltf) => resolve(gltf.scene), reject)
  })
}

describe('gallery column placement', () => {
  it('keeps the shaft front surface exactly at the configured depth behind the photo', () => {
    const placement = getGalleryColumnPlacement(
      { scale: 1, depth: 0.15, offsetX: 0.4, offsetY: 0.2 },
      { x: 1, y: 1, z: 1 },
      -2.35,
      0.96,
      0,
    )

    expect(placement.position).toEqual([0.4, -2.15, -1.1099999999999999])
    expect(placement.scale).toEqual([1, 1, 1])
    const photoBackZ = 8.2
    const shaftFrontZ = photoBackZ + placement.position[2] + 0.96 * placement.scale[2]
    const alignedBaseFrontZ = photoBackZ + placement.position[2] + 0.96 * placement.scale[2]
    expect(shaftFrontZ).toBeCloseTo(photoBackZ - 0.15, 8)
    expect(alignedBaseFrontZ).toBeCloseTo(shaftFrontZ, 8)
  })

  it('shares tinted materials across instances and releases them safely across StrictMode effect replay', async () => {
    const scene = await loadAssetScene()
    const firstInstance = clone(scene)
    const secondInstance = clone(scene)
    const getBaseMaterial = (root: Object3D) => {
      const base = root.getObjectByName('1_base')!
      let material: MeshStandardMaterial | null = null
      base.traverse((object) => {
        if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) material = object.material
      })
      return material!
    }
    const sourceMaterial = getBaseMaterial(firstInstance)
    const secondSourceMaterial = getBaseMaterial(secondInstance)
    expect(secondSourceMaterial).toBe(sourceMaterial)

    const releaseFirst = acquireGalleryColumnMaterials(firstInstance)
    const tintedFirst = getBaseMaterial(firstInstance)
    const releaseSecond = acquireGalleryColumnMaterials(secondInstance)
    const tintedSecond = getBaseMaterial(secondInstance)
    expect(tintedSecond).toBe(tintedFirst)
    expect(tintedFirst).not.toBe(sourceMaterial)
    expect(tintedFirst.depthWrite).toBe(true)
    expect(tintedFirst.depthTest).toBe(true)
    expect(tintedFirst.map).toBe(sourceMaterial.map)
    const dispose = vi.spyOn(tintedFirst, 'dispose')

    releaseFirst()
    releaseFirst()
    expect(dispose).not.toHaveBeenCalled()
    expect(getBaseMaterial(firstInstance)).toBe(sourceMaterial)
    const replayRelease = acquireGalleryColumnMaterials(firstInstance)
    expect(getBaseMaterial(firstInstance)).toBe(tintedSecond)
    replayRelease()
    expect(dispose).not.toHaveBeenCalled()

    releaseSecond()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(getBaseMaterial(secondInstance)).toBe(sourceMaterial)
    vi.restoreAllMocks()
  })

  it('keeps metre offsets, floor contact, and model scale through the first photo intro scale', () => {
    const placement = getGalleryColumnPlacement(
      { scale: 2, depth: 0.3, offsetX: -0.6, offsetY: 0.5 },
      { x: 1.35, y: 1.35, z: 1.35 },
      -2.35,
      0.96,
      0,
    )

    expect(placement.scale.map(value => value * 1.35)).toEqual([2, 2, 2])
    expect(placement.position[0] * 1.35).toBeCloseTo(-0.6, 8)
    expect(placement.position[1] * 1.35).toBeCloseTo(-1.85, 8)
    expect((placement.position[2] + 0.96 * placement.scale[2]) * 1.35).toBeCloseTo(-0.3, 8)
  })
})

describe('the supplied ionic column GLB', () => {
  it('repeats the original shaft geometry at source scale and joins it to the raised capital', async () => {
    const scene = await loadAssetScene()
    const bounds = getGalleryColumnAssetBounds(scene)
    const shaftLocal = getGalleryColumnShaftLocalBounds(scene)
    expect(bounds).not.toBeNull()
    expect(shaftLocal).not.toBeNull()
    expect(bounds?.baseBottom).toBeCloseTo(0, 3)
    expect(bounds?.baseTop).toBeCloseTo(0.8, 2)
    expect(bounds?.shaftBottom).toBeCloseTo(0.8, 2)
    expect(bounds?.shaftTop).toBeCloseTo(11.7, 1)
    expect(bounds?.capitalBottom).toBeCloseTo(11.62, 1)
    expect(bounds?.shaftFrontZ).toBeCloseTo(0.96, 2)
    expect(bounds?.baseFrontZ).toBeCloseTo(1.2, 2)
    expect(bounds?.frontmostZ).toBeCloseTo(1.2, 2)

    // The imported GLB matrices already convert the source mesh axis and scale.
    expect(Math.abs((bounds!.baseTop - bounds!.baseBottom) - (bounds!.baseFrontZ - 0))).toBeGreaterThan(0.1)
    expect(Math.abs(bounds!.baseTop - bounds!.shaftBottom)).toBeLessThan(0.02)
    expect(bounds!.capitalBottom).toBeLessThan(bounds!.shaftTop)

    const shaft = scene.getObjectByName('2_fut')!
    const sourceMeshes: Mesh[] = []
    shaft.traverse((object) => { if (object instanceof Mesh) sourceMeshes.push(object) })
    const sourceGeometry = sourceMeshes[0]!.geometry
    const sourcePosition = sourceGeometry.getAttribute('position')
    const sourceUv = sourceGeometry.getAttribute('uv')
    const sourceZLevels = [...new Set(Array.from({ length: sourcePosition.count }, (_, index) => Number(sourcePosition.getZ(index).toFixed(5))))].sort((a, b) => a - b)
    const bodyStartZ = sourceZLevels[1]!
    const bodyEndZ = sourceZLevels.at(-2)!
    const sourceStep = bodyEndZ - bodyStartZ
    const originalGeometryIds = sourceMeshes.map((mesh) => mesh.geometry.uuid)
    const extended = extendGalleryColumnShaft(scene)
    expect(extended).not.toBeNull()
    const release = acquireGalleryColumnShaftGeometry(scene)
    const raisedBounds = getGalleryColumnAssetBounds(scene)
    expect(raisedBounds).not.toBeNull()
    expect(raisedBounds?.baseBottom).toBeCloseTo(bounds!.baseBottom, 6)
    expect(raisedBounds?.baseTop).toBeCloseTo(bounds!.baseTop, 6)
    expect(raisedBounds?.shaftBottom).toBeCloseTo(bounds!.shaftBottom, 6)
    const yPerSourceZ = (bounds!.shaftTop - bounds!.shaftBottom) / (shaftLocal!.maxZ - shaftLocal!.minZ)
    const expectedShaftTop = bounds!.shaftBottom + (bodyStartZ - shaftLocal!.minZ) * yPerSourceZ
      + sourceStep * GALLERY_COLUMN_SHAFT_SEGMENTS * yPerSourceZ
      + (shaftLocal!.maxZ - bodyEndZ) * yPerSourceZ
    const expectedCapitalBottom = expectedShaftTop + bounds!.capitalBottom - bounds!.shaftTop
    expect(raisedBounds?.shaftTop).toBeCloseTo(expectedShaftTop, 3)
    expect(raisedBounds?.capitalBottom).toBeCloseTo(expectedCapitalBottom, 3)
    expect(raisedBounds?.baseFrontZ).toBeCloseTo(raisedBounds?.shaftFrontZ ?? Number.NaN, 6)
    expect(raisedBounds?.baseFrontZ).toBeCloseTo(bounds!.shaftFrontZ, 6)
    expect((raisedBounds!.baseFrontZ - raisedBounds!.baseBackZ)).toBeCloseTo(bounds!.baseFrontZ - bounds!.baseBackZ, 6)
    expect(extended?.extension.segmentCount).toBe(GALLERY_COLUMN_SHAFT_SEGMENTS)
    expect(GALLERY_COLUMN_SHAFT_SEGMENTS).toBe(5)
    expect(raisedBounds!.shaftTop - bounds!.shaftTop).toBeCloseTo(expectedShaftTop - bounds!.shaftTop, 3)

    const repeatedMeshes: Mesh[] = []
    scene.getObjectByName('2_fut')!.traverse((object) => { if (object instanceof Mesh) repeatedMeshes.push(object) })
    expect(repeatedMeshes).toHaveLength(sourceMeshes.length)
    expect(repeatedMeshes[0]!.geometry).not.toBe(sourceGeometry)
    expect(sourceGeometry.uuid).toBe(originalGeometryIds[0])
    expect(sourceGeometry.getAttribute('position')).toBe(sourcePosition)
    const repeatedPosition = repeatedMeshes[0]!.geometry.getAttribute('position')
    const repeatedUv = repeatedMeshes[0]!.geometry.getAttribute('uv')
    expect(repeatedPosition.count).toBeGreaterThan(sourcePosition.count)
    const sourceIndices = sourceGeometry.index!
    const sourceUsedVertices = new Set(Array.from({ length: sourceIndices.count }, (_, index) => sourceIndices.getX(index)))
    const repeatedIndices = repeatedMeshes[0]!.geometry.index!
    const repeatedUsedVertices = new Set(Array.from({ length: repeatedIndices.count }, (_, index) => repeatedIndices.getX(index)))
    const uvBounds = (uv: typeof sourceUv, vertices: Set<number>) => {
      const usedUv = [...vertices].map(index => [uv.getX(index), uv.getY(index)])
      return [
        Math.min(...usedUv.map(([u]) => u!)), Math.max(...usedUv.map(([u]) => u!)),
        Math.min(...usedUv.map(([, v]) => v!)), Math.max(...usedUv.map(([, v]) => v!)),
      ]
    }
    expect(uvBounds(repeatedUv, repeatedUsedVertices)).toEqual(uvBounds(sourceUv, sourceUsedVertices))

    const repeatedGeometry = repeatedMeshes[0]!.geometry
    const positions = repeatedGeometry.getAttribute('position')
    const contourAtSourcePlane = (planeZ: number) => {
      const points = new Set<string>()
      const sourceIndex = sourceGeometry.index!
      const add = (x: number, y: number) => points.add(`${x.toFixed(4)}:${y.toFixed(4)}`)
      for (let face = 0; face < sourceIndex.count; face += 3) {
        const vertices = [sourceIndex.getX(face), sourceIndex.getX(face + 1), sourceIndex.getX(face + 2)]
        for (let edge = 0; edge < 3; edge += 1) {
          const from = vertices[edge]!
          const to = vertices[(edge + 1) % 3]!
          const fromZ = sourcePosition.getZ(from)
          const toZ = sourcePosition.getZ(to)
          if (Math.abs(fromZ - planeZ) < 1e-5) add(sourcePosition.getX(from), sourcePosition.getY(from))
          if ((fromZ < planeZ && toZ > planeZ) || (fromZ > planeZ && toZ < planeZ)) {
            const amount = (planeZ - fromZ) / (toZ - fromZ)
            add(
              sourcePosition.getX(from) + (sourcePosition.getX(to) - sourcePosition.getX(from)) * amount,
              sourcePosition.getY(from) + (sourcePosition.getY(to) - sourcePosition.getY(from)) * amount,
            )
          }
        }
      }
      return [...points].sort()
    }
    const contourAt = (position: typeof sourcePosition, z: number) => [...new Set(Array.from(
      { length: position.count },
      (_, index) => Math.abs(position.getZ(index) - z) < 1e-4
        ? `${position.getX(index).toFixed(4)}:${position.getY(index).toFixed(4)}`
        : null,
    ).filter((point): point is string => point !== null))].sort()
    const sourceBottomContour = contourAtSourcePlane(bodyStartZ)
    const sourceTopContour = contourAtSourcePlane(bodyEndZ)
    expect(sourceBottomContour.length).toBeGreaterThanOrEqual(12)
    expect(sourceTopContour.length).toBeGreaterThanOrEqual(12)
    for (let joint = 1; joint < GALLERY_COLUMN_SHAFT_SEGMENTS; joint += 1) {
      const boundary = bodyStartZ + sourceStep * joint
      const actualContour = contourAt(positions, boundary)
      expect(actualContour).toEqual(joint % 2 === 1 ? sourceTopContour : sourceBottomContour)
    }

    for (const columnScale of [1, 3]) {
      const placement = getGalleryColumnPlacement(
        { scale: columnScale, depth: 0.15, offsetX: 0, offsetY: 0 },
        { x: 1, y: 1, z: 1 },
        -2.35,
        raisedBounds!.shaftFrontZ,
        raisedBounds!.baseBottom,
      )
      const worldBaseBottom = placement.position[1] + raisedBounds!.baseBottom * placement.scale[1]
      const worldShaftFrontZ = placement.position[2] + raisedBounds!.shaftFrontZ * placement.scale[2]
      const worldBaseFrontZ = placement.position[2] + raisedBounds!.baseFrontZ * placement.scale[2]
      const photoBottomY = -1.65
      const worldBaseTop = placement.position[1] + raisedBounds!.baseTop * placement.scale[1]
      expect(worldBaseBottom).toBeCloseTo(-2.35, 6)
      expect(worldShaftFrontZ).toBeCloseTo(-0.15, 6)
      expect(worldBaseFrontZ).toBeCloseTo(worldShaftFrontZ, 6)
      // The plinth vertically overlaps the bottom of the card, but remains
      // behind its plane by the configured depth and therefore cannot occlude it.
      expect(worldBaseTop).toBeGreaterThan(photoBottomY)
    }
    release()
    expect(repeatedMeshes.map((mesh) => mesh.geometry.uuid)).toEqual(originalGeometryIds)
  })

  it('shares repeated shaft geometry across instances and disposes it after the final release', async () => {
    const scene = await loadAssetScene()
    const first = clone(scene)
    const second = clone(scene)
    extendGalleryColumnShaft(first)
    extendGalleryColumnShaft(second)

    const firstMeshes: Mesh[] = []
    const secondMeshes: Mesh[] = []
    first.getObjectByName('2_fut')!.traverse((object) => { if (object instanceof Mesh) firstMeshes.push(object) })
    second.getObjectByName('2_fut')!.traverse((object) => { if (object instanceof Mesh) secondMeshes.push(object) })
    const releaseFirst = acquireGalleryColumnShaftGeometry(first)
    const repeatedGeometry = firstMeshes[0]!.geometry
    const releaseSecond = acquireGalleryColumnShaftGeometry(second)
    expect(secondMeshes[0]!.geometry).toBe(repeatedGeometry)
    const dispose = vi.spyOn(repeatedGeometry, 'dispose')

    releaseFirst()
    releaseFirst()
    expect(dispose).not.toHaveBeenCalled()
    expect(firstMeshes[0]!.geometry).not.toBe(repeatedGeometry)
    releaseSecond()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(secondMeshes[0]!.geometry).not.toBe(repeatedGeometry)
    vi.restoreAllMocks()
  })
})
