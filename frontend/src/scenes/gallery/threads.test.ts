import { MeshBasicMaterial, QuadraticBezierCurve3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { galleryColumnPhotoCenterOffsetZ, GALLERY, GALLERY_MEMORIES, memoryPosition } from './content'
import { GALLERY_ART } from './artDirection'
import {
  createMemoryThreadAccentGeometry,
  createMemoryThreadGeometry,
  createMemoryThreadMaterial,
  createMemoryThreadPaths,
  GALLERY_MEMORY_RENDER_ORDER,
  GALLERY_THREAD_RENDER_ORDER,
  updateMemoryThreadMaterial,
} from './threads'

describe('gallery memory thread paths', () => {
  it('creates sparse deterministic curves beside same-side frames, outside the central walk lane', () => {
    const paths = createMemoryThreadPaths(GALLERY_MEMORIES)
    const repeated = createMemoryThreadPaths(GALLERY_MEMORIES)

    expect(paths.map(path => [path.startOrder, path.endOrder])).toEqual([[0, 2], [4, 6], [9, 11]])
    expect(paths).toEqual(repeated)
    expect(paths).toHaveLength(3)
    const sides = new Map(GALLERY_MEMORIES.map(memory => [memory.order, memory.side]))
    for (const path of paths) {
      const side = sides.get(path.startOrder)
      expect(sides.get(path.endOrder)).toBe(side)
      const curve = new QuadraticBezierCurve3(
        new Vector3(...path.start),
        new Vector3(...path.control),
        new Vector3(...path.end),
      )
      for (const point of [path.start, path.control, path.end]) {
        expect(point.every(Number.isFinite)).toBe(true)
        expect(Math.sign(point[0])).toBe(side)
        expect(Math.abs(point[0])).toBeGreaterThanOrEqual(1.5)
      }
      for (let sample = 0; sample <= 100; sample++) {
        const point = curve.getPoint(sample / 100)
        expect(Math.sign(point.x)).toBe(side)
        expect(Math.abs(point.x)).toBeGreaterThanOrEqual(1.5)
      }
      expect(path.start[2]).toBeGreaterThan(path.end[2])
    }
  })

  it('repositions accent paths along B paired frames and uses that variant lane width', () => {
    const layout = { laneWidth: 9, offsetX: 0.2, offsetY: 0.15, offsetZ: -0.5 }
    const paths = createMemoryThreadPaths(GALLERY_MEMORIES, GALLERY.width, 'between-columns', layout)
    expect(paths).toHaveLength(3)
    expect(paths[0]!.start[0]).toBeCloseTo(-6.05)
    expect(paths[0]!.end[0]).toBeCloseTo(-6.05)
    expect(paths[0]!.start[2]).not.toBe(paths[0]!.end[2])
    expect(paths.every(path => [...path.start, ...path.control, ...path.end].every(Number.isFinite))).toBe(true)
  })

  it('keeps B thread paths aligned with photos when column depth and scale change', () => {
    const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const layout = { laneWidth: 7, offsetX: 1.95, offsetY: 0.45, offsetZ: 0 }
    const customColumns = { ...defaults, columnDepth: 0.63, columnScale: 1.8 }
    const defaultPath = createMemoryThreadPaths(GALLERY_MEMORIES, GALLERY.width, 'between-columns', layout, defaults)[0]!
    const customPath = createMemoryThreadPaths(GALLERY_MEMORIES, GALLERY.width, 'between-columns', layout, customColumns)[0]!
    const expectedOffset = galleryColumnPhotoCenterOffsetZ(customColumns) - galleryColumnPhotoCenterOffsetZ(defaults)

    expect(customPath.start[2] - defaultPath.start[2]).toBeCloseTo(expectedOffset, 8)
    expect(customPath.control[2] - defaultPath.control[2]).toBeCloseTo(expectedOffset, 8)
    expect(customPath.end[2] - defaultPath.end[2]).toBeCloseTo(expectedOffset, 8)
  })

  it('creates a deterministic thin spatial tube from a public thread path', () => {
    const path = createMemoryThreadPaths(GALLERY_MEMORIES)[1]!
    const first = createMemoryThreadGeometry(path, { segments: 16, radius: 0.01, radialSegments: 4 })
    const repeated = createMemoryThreadGeometry(path, { segments: 16, radius: 0.01, radialSegments: 4 })
    first.computeBoundingBox()

    expect(first.getAttribute('position').count).toBeGreaterThan(30)
    expect(first.getAttribute('normal').count).toBe(first.getAttribute('position').count)
    expect(first.getAttribute('position').array).toEqual(repeated.getAttribute('position').array)
    expect(Math.abs(first.boundingBox!.min.x)).toBeGreaterThan(1.5)
    expect(Math.abs(first.boundingBox!.max.x)).toBeGreaterThan(1.5)

    first.dispose(); repeated.dispose()
  })

  it('rebuilds world-space thread positions with the aisle while preserving depth and frame clearance', () => {
    const defaultPaths = createMemoryThreadPaths(GALLERY_MEMORIES)
    const wideWidth = 9
    const widePaths = createMemoryThreadPaths(GALLERY_MEMORIES, wideWidth)
    expect(widePaths).toHaveLength(defaultPaths.length)

    for (let index = 0; index < defaultPaths.length; index++) {
      const before = defaultPaths[index]!
      const after = widePaths[index]!
      const side = Math.sign(before.start[0])
      expect(after.start[0] - before.start[0]).toBeCloseTo(side * (wideWidth - GALLERY.width) / 2)
      expect(after.control[0] - before.control[0]).toBeCloseTo(side * (wideWidth - GALLERY.width) / 2)
      expect(after.end[0] - before.end[0]).toBeCloseTo(side * (wideWidth - GALLERY.width) / 2)
      expect(after.start[2]).toBe(before.start[2])
      expect(after.control[2]).toBe(before.control[2])
      expect(after.end[2]).toBe(before.end[2])
      expect(Math.abs(after.start[0]) - wideWidth / 2).toBeCloseTo(1.35)
    }
  })

  it('keeps short elevated threads clear of every yawed photo surface for the full route', () => {
    const paths = createMemoryThreadPaths(GALLERY_MEMORIES)
    for (const path of paths) {
      expect(Math.abs(path.end[2] - path.start[2])).toBeLessThanOrEqual(2)
      expect(Math.max(path.start[1], path.control[1], path.end[1])).toBeGreaterThan(0.5)
      const curve = new QuadraticBezierCurve3(
        new Vector3(...path.start),
        new Vector3(...path.control),
        new Vector3(...path.end),
      )
      for (let sample = 0; sample <= 100; sample++) {
        const point = curve.getPoint(sample / 100)
        for (const memory of GALLERY_MEMORIES) {
          const [centerX, centerY, centerZ] = memoryPosition(memory, GALLERY.width)
          const yaw = -memory.side * GALLERY_ART.wallYaw
          const scale = memory.order === 0 ? 1.35 : 1
          const dx = point.x - centerX
          const dz = point.z - centerZ
          const localX = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / scale
          const localY = (point.y - centerY) / scale
          const localZ = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / scale
          const size = memory.order === 0 ? 2.15 : 3.3
          const width = memory.aspect >= 1 ? size : size * memory.aspect
          const height = memory.aspect >= 1 ? size / memory.aspect : size
          const intersectsFrameSurface = Math.abs(localX) <= (width + 0.1) / 2
            && Math.abs(localY) <= (height + 0.1) / 2
            && Math.abs(localZ) <= 0.06

          expect(intersectsFrameSurface, `thread ${path.startOrder}-${path.endOrder} sample ${sample} intersects memory ${memory.order} at local (${localX.toFixed(2)}, ${localY.toFixed(2)}, ${localZ.toFixed(2)})`).toBe(false)
        }
      }
    }
  })

  it('renders photo cards above threads in the transparent draw order', () => {
    expect(GALLERY_THREAD_RENDER_ORDER).toBeLessThan(GALLERY_MEMORY_RENDER_ORDER)
  })

  it('places only two small accent points on each path', () => {
    const paths = createMemoryThreadPaths(GALLERY_MEMORIES)
    const points = createMemoryThreadAccentGeometry(paths)
    const repeated = createMemoryThreadAccentGeometry(paths)
    const positions = points.getAttribute('position')
    const sizes = points.getAttribute('size')

    expect(positions.count).toBe(paths.length * 2)
    expect(positions.array).toEqual(repeated.getAttribute('position').array)
    expect(Array.from(sizes.array).every(size => size >= 0.039 && size <= 0.056)).toBe(true)

    points.dispose(); repeated.dispose()
  })

  it('updates thread opacity from art settings and dims it smoothly in focus', () => {
    const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const material = createMemoryThreadMaterial({ ...defaults, threadOpacity: 0.8 })

    expect(material).toBeInstanceOf(MeshBasicMaterial)
    expect(material.opacity).toBeCloseTo(0.256)
    updateMemoryThreadMaterial(material, { ...defaults, threadOpacity: 0.4 }, 1)
    expect(material.opacity).toBeCloseTo(0.0576)
    expect(material.fog).toBe(true)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)

    material.dispose()
  })
})

  it('moves both thread endpoints and its control point with the photo layout height', () => {
    const base = createMemoryThreadPaths(GALLERY_MEMORIES)[0]!
    const shifted = createMemoryThreadPaths(GALLERY_MEMORIES, GALLERY.width, 'between-columns', {
      laneWidth: GALLERY.width, offsetX: 0, offsetY: 0.6, offsetZ: 0,
    })[0]!
    for (const point of ['start', 'control', 'end'] as const) {
      expect(shifted[point][1] - base[point][1]).toBeCloseTo(0.6)
    }
  })
