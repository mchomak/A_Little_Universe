import { Box3, BufferAttribute, BufferGeometry, Color, Group, Material, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'

export interface GalleryColumnSettings {
  visible: boolean
  scale: number
  depth: number
  offsetX: number
  offsetY: number
}

export interface GalleryColumnParentScale {
  x: number
  y: number
  z: number
}

export interface GalleryColumnPlacement {
  position: [number, number, number]
  scale: [number, number, number]
}

export interface GalleryColumnAssetBounds {
  baseBottom: number
  baseTop: number
  baseFrontZ: number
  baseBackZ: number
  shaftBottom: number
  shaftTop: number
  shaftFrontZ: number
  capitalBottom: number
  capitalFrontZ: number
  frontmostZ: number
}

export interface GalleryColumnShaftLocalBounds {
  minZ: number
  maxZ: number
  bodyStartZ: number
  bodyEndZ: number
}

export interface GalleryColumnExtension {
  segmentCount: number
  capitalBottomY: number
  capitalLiftY: number
  segmentStepZ: number
}

/** GLTF node matrices convert the source mesh into metres and Y-up scene axes. */
export const GALLERY_COLUMN_MODEL_SCALE = 1

/** Five unscaled source shaft sections put the original cap safely above the gallery's normal camera view. */
export const GALLERY_COLUMN_SHAFT_SEGMENTS = 5

interface SharedColumnMaterial {
  material: MeshStandardMaterial
  references: number
}

const COLUMN_MARBLE_TINT = new Color('#9eb5d7')
const sharedColumnMaterials = new WeakMap<MeshStandardMaterial, SharedColumnMaterial>()

interface SharedColumnGeometry {
  geometry: BufferGeometry
  references: number
}

const sharedColumnShaftGeometries = new WeakMap<BufferGeometry, Map<string, SharedColumnGeometry>>()

/** Measure the actual transformed GLB parts in the imported scene's local coordinates. */
export function getGalleryColumnAssetBounds(modelRoot: Object3D): GalleryColumnAssetBounds | null {
  const base = modelRoot.getObjectByName('1_base')
  const shaft = modelRoot.getObjectByName('2_fut')
  const capital = modelRoot.getObjectByName('3_volute')
  if (!base || !shaft || !capital) return null

  modelRoot.updateWorldMatrix(true, true)
  const inverseRoot = modelRoot.matrixWorld.clone().invert()
  const relativeMatrix = new Matrix4()
  const boundsFor = (part: Object3D) => {
    const bounds = new Box3().makeEmpty()
    part.traverse((object) => {
      if (!(object instanceof Mesh)) return
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      const geometryBounds = object.geometry.boundingBox
      if (!geometryBounds) return
      relativeMatrix.multiplyMatrices(inverseRoot, object.matrixWorld)
      bounds.union(geometryBounds.clone().applyMatrix4(relativeMatrix))
    })
    return bounds
  }

  const baseBounds = boundsFor(base)
  const shaftBounds = boundsFor(shaft)
  const capitalBounds = boundsFor(capital)
  if (baseBounds.isEmpty() || shaftBounds.isEmpty() || capitalBounds.isEmpty()) return null
  const frontmostZ = Math.max(baseBounds.max.z, shaftBounds.max.z, capitalBounds.max.z)
  return {
    baseBottom: baseBounds.min.y,
    baseTop: baseBounds.max.y,
    baseFrontZ: baseBounds.max.z,
    baseBackZ: baseBounds.min.z,
    shaftBottom: shaftBounds.min.y,
    shaftTop: shaftBounds.max.y,
    shaftFrontZ: shaftBounds.max.z,
    capitalBottom: capitalBounds.min.y,
    capitalFrontZ: capitalBounds.max.z,
    frontmostZ,
  }
}

function getSharedColumnMaterial(source: MeshStandardMaterial) {
  let shared = sharedColumnMaterials.get(source)
  if (!shared) {
    const material = source.clone()
    material.color.multiply(COLUMN_MARBLE_TINT)
    material.roughness = Math.max(material.roughness, 0.9)
    material.metalness = Math.min(material.metalness, 0.04)
    material.needsUpdate = true
    shared = { material, references: 0 }
    sharedColumnMaterials.set(source, shared)
  }
  return shared
}

/** Share tinted PBR variants across instances; the returned idempotent release restores loader materials before disposal. */
export function acquireGalleryColumnMaterials(root: Object3D): () => void {
  const originals = new Map<Mesh, Material | Material[]>()
  const acquired = new Map<MeshStandardMaterial, SharedColumnMaterial>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    let changed = false
    const tintedMaterials = sourceMaterials.map((source) => {
      if (!(source instanceof MeshStandardMaterial)) return source
      const shared = getSharedColumnMaterial(source)
      if (!acquired.has(source)) {
        shared.references += 1
        acquired.set(source, shared)
      }
      changed = true
      return shared.material
    })
    if (!changed) return
    originals.set(object, object.material)
    object.material = Array.isArray(object.material) ? tintedMaterials : tintedMaterials[0]!
  })

  let released = false
  return () => {
    if (released) return
    released = true
    originals.forEach((material, mesh) => { mesh.material = material })
    acquired.forEach((shared, source) => {
      shared.references -= 1
      if (shared.references > 0) return
      shared.material.dispose()
      if (sharedColumnMaterials.get(source) === shared) sharedColumnMaterials.delete(source)
    })
  }
}

function movePartByRootOffset(root: Object3D, part: Object3D, offset: readonly [number, number, number], name: string) {
  root.updateWorldMatrix(true, true)
  const rootInverse = root.matrixWorld.clone().invert()
  const partInRoot = new Matrix4().multiplyMatrices(rootInverse, part.matrixWorld)
  partInRoot.premultiply(new Matrix4().makeTranslation(...offset))
  part.parent?.remove(part)

  const placement = new Group()
  placement.name = name
  placement.matrixAutoUpdate = false
  placement.matrix.copy(partInRoot)
  part.matrixAutoUpdate = true
  part.position.set(0, 0, 0)
  part.quaternion.identity()
  part.scale.set(1, 1, 1)
  part.updateMatrix()
  placement.add(part)
  root.add(placement)
}

/** The mesh-local Z axis is the column axis before the GLB's node matrices rotate it to scene Y. */
export function getGalleryColumnShaftLocalBounds(modelRoot: Object3D): GalleryColumnShaftLocalBounds | null {
  const shaft = modelRoot.getObjectByName('2_fut')
  if (!shaft) return null
  modelRoot.updateWorldMatrix(true, true)
  const inverseShaft = shaft.matrixWorld.clone().invert()
  const relativeMatrix = new Matrix4()
  const bounds = new Box3().makeEmpty()
  const axisLevels: number[] = []
  const point = new Vector3()
  shaft.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    if (!object.geometry.boundingBox) return
    relativeMatrix.multiplyMatrices(inverseShaft, object.matrixWorld)
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(relativeMatrix))
    const position = object.geometry.getAttribute('position')
    if (!(position instanceof BufferAttribute)) return
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(relativeMatrix)
      axisLevels.push(point.z)
    }
  })
  if (bounds.isEmpty()) return null
  axisLevels.sort((a, b) => a - b)
  const uniqueLevels: number[] = []
  axisLevels.forEach((z) => {
    if (uniqueLevels.length === 0 || Math.abs(z - uniqueLevels[uniqueLevels.length - 1]!) > 1e-4) uniqueLevels.push(z)
  })
  if (uniqueLevels.length < 4) return null
  return {
    minZ: bounds.min.z,
    maxZ: bounds.max.z,
    bodyStartZ: uniqueLevels[1]!,
    bodyEndZ: uniqueLevels[uniqueLevels.length - 2]!,
  }
}

export function getGalleryColumnExtension(
  bounds: GalleryColumnAssetBounds,
  shaftLocal: GalleryColumnShaftLocalBounds,
  segmentCount = GALLERY_COLUMN_SHAFT_SEGMENTS,
): GalleryColumnExtension | null {
  const shaftLength = bounds.shaftTop - bounds.shaftBottom
  const sourceLengthZ = shaftLocal.maxZ - shaftLocal.minZ
  const segmentStepZ = shaftLocal.bodyEndZ - shaftLocal.bodyStartZ
  if (![shaftLength, segmentStepZ, shaftLocal.minZ, shaftLocal.maxZ, bounds.capitalBottom, segmentCount].every(Number.isFinite)) return null
  if (shaftLength <= 0 || sourceLengthZ <= 0 || segmentStepZ <= 0 || !Number.isInteger(segmentCount) || segmentCount < 2) return null

  // Source Z is transformed into scene Y by the GLB node matrices. Keep each
  // decorative end transition once, and repeat only the central shaft section.
  const yPerSourceZ = shaftLength / sourceLengthZ
  const bodyStartY = (shaftLocal.bodyStartZ - shaftLocal.minZ) * yPerSourceZ
  const bodyEndY = (shaftLocal.bodyEndZ - shaftLocal.minZ) * yPerSourceZ
  const capitalOffsetFromBodyEnd = bounds.capitalBottom - (bounds.shaftBottom + bodyEndY)
  const targetCapitalBottomY = bounds.shaftBottom + bodyStartY + segmentStepZ * segmentCount * yPerSourceZ + capitalOffsetFromBodyEnd
  return {
    segmentCount,
    capitalBottomY: targetCapitalBottomY,
    capitalLiftY: targetCapitalBottomY - bounds.capitalBottom,
    segmentStepZ,
  }
}

/** Place the unchanged shaft and original capital; the cached repeat geometry is attached separately in an effect. */
export function extendGalleryColumnShaft(root: Object3D, segmentCount = GALLERY_COLUMN_SHAFT_SEGMENTS) {
  const bounds = getGalleryColumnAssetBounds(root)
  const shaftLocal = getGalleryColumnShaftLocalBounds(root)
  const shaft = root.getObjectByName('2_fut')
  const capital = root.getObjectByName('3_volute')
  if (!bounds || !shaft || !capital) return null
  const extension = getGalleryColumnExtension(bounds, shaftLocal ?? {
    minZ: Number.NaN, maxZ: Number.NaN, bodyStartZ: Number.NaN, bodyEndZ: Number.NaN,
  }, segmentCount)
  if (!extension) return null

  // Preserve the square original plinth but align its front plane to the
  // shaft. The 24cm depth-only shift prevents its toe from projecting into
  // the lower edge of the photo while retaining normal depth writing.
  const base = root.getObjectByName('1_base')
  if (!base) return null
  movePartByRootOffset(root, base, [0, 0, bounds.shaftFrontZ - bounds.baseFrontZ], 'depth-aligned-original-column-base')

  const shaftMiddle = new Group()
  shaftMiddle.name = 'original-shaft-sections'
  const shaftMeshes = [...shaft.children]
  shaftMeshes.forEach((child) => { shaft.remove(child); shaftMiddle.add(child) })
  shaft.add(shaftMiddle)

  root.updateWorldMatrix(true, true)
  movePartByRootOffset(root, capital, [0, extension.capitalLiftY, 0], 'raised-original-volute')
  root.updateWorldMatrix(true, true)

  const updatedBounds = getGalleryColumnAssetBounds(root)
  if (!updatedBounds) return null
  return { bounds: updatedBounds, originalBounds: bounds, shaftLocal, extension }
}

function repeatSourceGeometry(source: BufferGeometry, segmentCount: number, segmentStepZ: number): BufferGeometry {
  if (!source.boundingBox) source.computeBoundingBox()
  const sourcePosition = source.getAttribute('position')
  if (!source.boundingBox || !sourcePosition || sourcePosition.itemSize !== 3) {
    throw new Error('The ionic column shaft needs a 3D position attribute and finite bounds.')
  }
  const sourceIndices = source.index
  const sourceIndexCount = sourceIndices?.count ?? sourcePosition.count
  if (sourceIndexCount % 3 !== 0) throw new Error('The ionic column shaft geometry must use triangle faces.')

  const sourceZLevels = Array.from({ length: sourcePosition.count }, (_, index) => sourcePosition.getZ(index)).sort((a, b) => a - b)
  const uniqueZLevels: number[] = []
  sourceZLevels.forEach((z) => {
    if (uniqueZLevels.length === 0 || Math.abs(z - uniqueZLevels[uniqueZLevels.length - 1]!) > 1e-4) uniqueZLevels.push(z)
  })
  if (uniqueZLevels.length < 4) throw new Error('The ionic shaft has no distinct central cylinder section to repeat.')
  const bodyStartZ = uniqueZLevels[1]!
  const bodyEndZ = uniqueZLevels[uniqueZLevels.length - 2]!
  const bodyLengthZ = bodyEndZ - bodyStartZ
  if (Math.abs(bodyLengthZ - segmentStepZ) > 1e-3) {
    throw new Error('The ionic shaft primitives do not share the same central section length.')
  }

  const repeated = new BufferGeometry()
  repeated.name = `${source.name || 'ionic-column-shaft'}-repeated-${segmentCount}`
  repeated.userData = { ...source.userData }
  const sourceIndexAt = (index: number) => sourceIndices?.getX(index) ?? index
  const groups = source.groups.length > 0
    ? source.groups
    : [{ start: 0, count: sourceIndexCount, materialIndex: 0 }]
  const outputIndices: number[] = []
  const outputAttributeValues = new Map<string, number[]>()
  const sourceAttributes = new Map<string, BufferAttribute>()
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Interleaved ionic column shaft attributes are not supported.')
    sourceAttributes.set(name, attribute)
    outputAttributeValues.set(name, [])
  }
  const uvRanges = new Map<string, [number, number]>()
  sourceAttributes.forEach((attribute, name) => {
    if (!name.startsWith('uv') || attribute.itemSize < 2) return
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let index = 0; index < attribute.count; index += 1) {
      const v = attribute.getY(index)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    uvRanges.set(name, [min, max])
  })

  type RepeatedSection = { kind: 'bottom' | 'body' | 'top'; index: number }
  const sections: RepeatedSection[] = [
    { kind: 'bottom', index: 0 },
    ...Array.from({ length: segmentCount }, (_, index) => ({ kind: 'body' as const, index })),
    { kind: 'top', index: segmentCount },
  ]
  const endTolerance = Math.max(1e-6, Math.abs(bodyLengthZ) * 1e-6)
  const upperTransitionOffset = bodyStartZ + segmentCount * bodyLengthZ - bodyEndZ
  type VertexData = Map<string, number[]>
  const readVertex = (sourceVertex: number): VertexData => {
    const values = new Map<string, number[]>()
    sourceAttributes.forEach((attribute, name) => {
      values.set(name, Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(sourceVertex, component)))
    })
    return values
  }
  const interpolateVertex = (from: VertexData, to: VertexData, planeZ: number): VertexData => {
    const fromZ = from.get('position')![2]!
    const toZ = to.get('position')![2]!
    const blend = (planeZ - fromZ) / (toZ - fromZ)
    const values = new Map<string, number[]>()
    for (const name of sourceAttributes.keys()) {
      const fromValues = from.get(name)!
      const toValues = to.get(name)!
      const result = fromValues.map((value, component) => value + (toValues[component]! - value) * blend)
      if (name === 'position') result[2] = planeZ
      if (name === 'normal' && result.length >= 3) {
        const length = Math.hypot(result[0]!, result[1]!, result[2]!) || 1
        result[0] = result[0]! / length
        result[1] = result[1]! / length
        result[2] = result[2]! / length
      }
      values.set(name, result)
    }
    return values
  }
  const clipByZ = (polygon: VertexData[], planeZ: number, keepAbove: boolean): VertexData[] => {
    if (polygon.length === 0) return []
    const clipped: VertexData[] = []
    let previous = polygon[polygon.length - 1]!
    const previousZ = previous.get('position')![2]!
    let previousInside = keepAbove ? previousZ >= planeZ - endTolerance : previousZ <= planeZ + endTolerance
    for (const current of polygon) {
      const currentZ = current.get('position')![2]!
      const currentInside = keepAbove ? currentZ >= planeZ - endTolerance : currentZ <= planeZ + endTolerance
      if (currentInside !== previousInside) clipped.push(interpolateVertex(previous, current, planeZ))
      if (currentInside) clipped.push(current)
      previous = current
      previousInside = currentInside
    }
    return clipped
  }
  const transformVertex = (vertex: VertexData, section: RepeatedSection) => {
    const values = new Map<string, number[]>()
    const reverse = section.kind === 'body' && section.index % 2 === 1
    for (const name of sourceAttributes.keys()) {
      const transformed = [...vertex.get(name)!]
      if (name === 'position' && section.kind === 'top') transformed[2] = transformed[2]! + upperTransitionOffset
      if (name === 'position' && section.kind === 'body') {
        transformed[2] = reverse
          ? bodyStartZ + section.index * bodyLengthZ + (bodyEndZ - transformed[2]!)
          : transformed[2]! + section.index * bodyLengthZ
      }
      if (reverse && name === 'normal' && transformed.length >= 3) transformed[2] = -transformed[2]!
      if (reverse && name === 'tangent' && transformed.length >= 4) {
        transformed[2] = -transformed[2]!
        transformed[3] = -transformed[3]!
      }
      const uvRange = uvRanges.get(name)
      if (reverse && uvRange && transformed.length >= 2) transformed[1] = uvRange[0] + uvRange[1] - transformed[1]!
      values.set(name, transformed)
    }
    return values
  }

  for (const section of sections) {
    const reverse = section.kind === 'body' && section.index % 2 === 1
    const appendTriangle = (triangle: VertexData[]) => {
      const indices = triangle.map((vertex) => {
        const transformed = transformVertex(vertex, section)
        const outputVertexIndex = outputAttributeValues.get('position')!.length / 3
        for (const name of sourceAttributes.keys()) {
          outputAttributeValues.get(name)!.push(...transformed.get(name)!)
        }
        return outputVertexIndex
      })
      if (reverse) outputIndices.push(indices[0]!, indices[2]!, indices[1]!)
      else outputIndices.push(indices[0]!, indices[1]!, indices[2]!)
    }

    for (const group of groups) {
      const groupStart = outputIndices.length
      const end = Math.min(group.start + group.count, sourceIndexCount)
      for (let index = group.start; index + 2 < end; index += 3) {
        const triangle = [readVertex(sourceIndexAt(index)), readVertex(sourceIndexAt(index + 1)), readVertex(sourceIndexAt(index + 2))]
        let polygon = triangle
        if (section.kind === 'bottom') polygon = clipByZ(polygon, bodyStartZ, false)
        else if (section.kind === 'top') polygon = clipByZ(polygon, bodyEndZ, true)
        else {
          polygon = clipByZ(polygon, bodyStartZ, true)
          polygon = clipByZ(polygon, bodyEndZ, false)
        }
        if (polygon.length < 3) continue
        const zValues = polygon.map(vertex => vertex.get('position')![2]!)
        if (section.kind === 'body' && Math.max(...zValues) - Math.min(...zValues) <= endTolerance) continue
        for (let vertex = 1; vertex < polygon.length - 1; vertex += 1) {
          appendTriangle([polygon[0]!, polygon[vertex]!, polygon[vertex + 1]!])
        }
      }
      const groupCount = outputIndices.length - groupStart
      if (source.groups.length > 0 && groupCount > 0) {
        repeated.addGroup(groupStart, groupCount, group.materialIndex ?? 0)
      }
    }
  }

  for (const [name, values] of outputAttributeValues) {
    const sourceAttribute = sourceAttributes.get(name)!
    const AttributeArray = sourceAttribute.array.constructor as new (values: number[]) => BufferAttribute['array']
    const array = new AttributeArray(values)
    const repeatedAttribute = new BufferAttribute(array, sourceAttribute.itemSize, sourceAttribute.normalized)
    repeatedAttribute.name = sourceAttribute.name
    repeatedAttribute.usage = sourceAttribute.usage
    repeated.setAttribute(name, repeatedAttribute)
  }

  const normals = repeated.getAttribute('normal')
  const positions = repeated.getAttribute('position')
  if (normals && positions && normals.itemSize === 3) {
    const seamTolerance = 1e-4
    for (let seam = 1; seam < segmentCount; seam += 1) {
      const boundaryZ = bodyStartZ + seam * bodyLengthZ
      const verticesByPosition = new Map<string, number[]>()
      for (let vertex = 0; vertex < positions.count; vertex += 1) {
        if (Math.abs(positions.getZ(vertex) - boundaryZ) > seamTolerance) continue
        const key = `${positions.getX(vertex).toFixed(5)}:${positions.getY(vertex).toFixed(5)}:${positions.getZ(vertex).toFixed(5)}`
        const vertices = verticesByPosition.get(key) ?? []
        vertices.push(vertex)
        verticesByPosition.set(key, vertices)
      }
      verticesByPosition.forEach((vertices) => {
        if (vertices.length < 2) return
        let nx = 0
        let ny = 0
        let nz = 0
        vertices.forEach((vertex) => {
          nx += normals.getX(vertex)
          ny += normals.getY(vertex)
          nz += normals.getZ(vertex)
        })
        const length = Math.hypot(nx, ny, nz) || 1
        vertices.forEach((vertex) => normals.setXYZ(vertex, nx / length, ny / length, nz / length))
      })
    }
  }

  const outputVertexCount = outputAttributeValues.get('position')!.length / 3
  const maxVertexIndex = outputVertexCount - 1
  const indexValues = maxVertexIndex > 65_535 ? new Uint32Array(outputIndices) : new Uint16Array(outputIndices)
  repeated.setIndex(new BufferAttribute(indexValues, 1))
  repeated.computeBoundingBox()
  repeated.computeBoundingSphere()
  return repeated
}

function getSharedColumnShaftGeometry(source: BufferGeometry, segmentCount: number, segmentStepZ: number) {
  let geometriesBySettings = sharedColumnShaftGeometries.get(source)
  if (!geometriesBySettings) {
    geometriesBySettings = new Map()
    sharedColumnShaftGeometries.set(source, geometriesBySettings)
  }
  const key = `${segmentCount}:${segmentStepZ.toPrecision(12)}`
  let shared = geometriesBySettings.get(key)
  if (!shared) {
    shared = { geometry: repeatSourceGeometry(source, segmentCount, segmentStepZ), references: 0 }
    geometriesBySettings.set(key, shared)
  }
  return { shared, geometriesBySettings, key }
}

/** Share each repeated shaft buffer across cloned GLTF instances and release it only after its last user unmounts. */
export function acquireGalleryColumnShaftGeometry(root: Object3D): () => void {
  const shaft = root.getObjectByName('2_fut')
  const shaftLocal = getGalleryColumnShaftLocalBounds(root)
  if (!shaft || !shaftLocal) return () => undefined
  const segmentStepZ = shaftLocal.bodyEndZ - shaftLocal.bodyStartZ
  const originals = new Map<Mesh, BufferGeometry>()
  const acquired = new Map<BufferGeometry, ReturnType<typeof getSharedColumnShaftGeometry>>()

  shaft.traverse((object) => {
    if (!(object instanceof Mesh) || originals.has(object)) return
    const source = object.geometry
    const sharedRef = getSharedColumnShaftGeometry(source, GALLERY_COLUMN_SHAFT_SEGMENTS, segmentStepZ)
    if (!acquired.has(source)) {
      sharedRef.shared.references += 1
      acquired.set(source, sharedRef)
    }
    originals.set(object, source)
    object.geometry = sharedRef.shared.geometry
  })

  let released = false
  return () => {
    if (released) return
    released = true
    originals.forEach((geometry, mesh) => { mesh.geometry = geometry })
    acquired.forEach(({ shared, geometriesBySettings, key }) => {
      shared.references -= 1
      if (shared.references > 0) return
      shared.geometry.dispose()
      geometriesBySettings.delete(key)
    })
  }
}

/**
 * Keep the column at world scale while it remains attached to a Memory group.
 * The photo group has an intro scale and a vertical bob; this compensates its
 * scale but keeps its position/rotation shared with the photo.
 */
export function getGalleryColumnPlacement(
  settings: Pick<GalleryColumnSettings, 'scale' | 'depth' | 'offsetX' | 'offsetY'>,
  parentScale: GalleryColumnParentScale,
  floorY: number,
  shaftFrontZ: number,
  baseBottom: number,
): GalleryColumnPlacement {
  const sx = Number.isFinite(parentScale.x) && Math.abs(parentScale.x) > 1e-5 ? parentScale.x : 1
  const sy = Number.isFinite(parentScale.y) && Math.abs(parentScale.y) > 1e-5 ? parentScale.y : 1
  const sz = Number.isFinite(parentScale.z) && Math.abs(parentScale.z) > 1e-5 ? parentScale.z : 1
  const userScale = Number.isFinite(settings.scale) && settings.scale > 0 ? settings.scale : 1
  const modelScale = GALLERY_COLUMN_MODEL_SCALE * userScale
  const depth = Number.isFinite(settings.depth) ? Math.max(0, settings.depth) : 0.15
  const offsetX = Number.isFinite(settings.offsetX) ? settings.offsetX : 0
  const offsetY = Number.isFinite(settings.offsetY) ? settings.offsetY : 0
  const modelFrontZ = Number.isFinite(shaftFrontZ) ? shaftFrontZ : 0
  const modelBottom = Number.isFinite(baseBottom) ? baseBottom : 0

  return {
    // Depth is measured to the original shaft's front face; baseBottom
    // correction keeps the imported GLB's actual foot on the floor.
    position: [
      offsetX / sx,
      (floorY + offsetY - modelBottom * modelScale) / sy,
      (-depth - modelFrontZ * modelScale) / sz,
    ],
    scale: [modelScale / sx, modelScale / sy, modelScale / sz],
  }
}
