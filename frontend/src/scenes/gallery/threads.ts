import { BufferAttribute, BufferGeometry, MeshBasicMaterial, QuadraticBezierCurve3, TubeGeometry, Vector3 } from 'three'
import { GALLERY_MEMORIES, memoryPosition, type GalleryMemory } from './content'
import type { GalleryArtSettings } from './reflections'

export type ThreadPoint = readonly [number, number, number]

export interface MemoryThreadPath {
  readonly startOrder: number
  readonly endOrder: number
  readonly start: ThreadPoint
  readonly control: ThreadPoint
  readonly end: ThreadPoint
}

export interface MemoryThreadGeometryOptions {
  readonly segments?: number
  readonly radius?: number
  readonly radialSegments?: number
}

/** Draw behind photo frames so transparency cannot place a strand over an image. */
export const GALLERY_THREAD_RENDER_ORDER = 0
export const GALLERY_MEMORY_RENDER_ORDER = 1

const THREAD_OPACITY_SCALE = 0.32
const THREAD_FOCUS_DIM = 0.55

const THREAD_CONNECTIONS = [
  { start: 0, end: 2, bend: 0.52, lift: 0.55 },
  { start: 4, end: 6, bend: 0.56, lift: 0.38 },
  { start: 9, end: 11, bend: 0.64, lift: 0.6 },
] as const

const THREAD_OUTER_FRAME_OFFSET = 4.85
const THREAD_SHORT_ARC_HALF_LENGTH = 0.9

function outerFrameX(memory: GalleryMemory) {
  return memory.side * THREAD_OUTER_FRAME_OFFSET
}

/** Builds short, sparse world-space links in the gaps outside photo frames. */
export function createMemoryThreadPaths(memories: readonly GalleryMemory[] = GALLERY_MEMORIES): MemoryThreadPath[] {
  const byOrder = new Map(memories.map(memory => [memory.order, memory]))
  const paths: MemoryThreadPath[] = []

  for (const [index, connection] of THREAD_CONNECTIONS.entries()) {
    const startMemory = byOrder.get(connection.start)
    const endMemory = byOrder.get(connection.end)
    if (!startMemory || !endMemory || startMemory.side !== endMemory.side) continue
    const startPosition = memoryPosition(startMemory)
    const endPosition = memoryPosition(endMemory)
    const middleZ = (startPosition[2] + endPosition[2]) / 2
    const startZ = middleZ + THREAD_SHORT_ARC_HALF_LENGTH
    const endZ = middleZ - THREAD_SHORT_ARC_HALF_LENGTH
    const side = startMemory.side
    const railY = 0.18 + index * 0.08

    paths.push({
      startOrder: connection.start,
      endOrder: connection.end,
      start: [outerFrameX(startMemory), railY, startZ],
      control: [side * (THREAD_OUTER_FRAME_OFFSET + Math.abs(connection.bend) * 0.4), railY + connection.lift, middleZ],
      end: [outerFrameX(endMemory), railY, endZ],
    })
  }

  return paths
}

function curveFromPath(path: MemoryThreadPath) {
  return new QuadraticBezierCurve3(
    new Vector3(...path.start),
    new Vector3(...path.control),
    new Vector3(...path.end),
  )
}

/** Creates one low-poly world-space filament; callers own and dispose the result. */
export function createMemoryThreadGeometry(
  path: MemoryThreadPath,
  options: MemoryThreadGeometryOptions = {},
) {
  const requestedSegments = Number.isFinite(options.segments) ? options.segments! : 36
  const requestedRadialSegments = Number.isFinite(options.radialSegments) ? options.radialSegments! : 4
  const requestedRadius = Number.isFinite(options.radius) ? options.radius! : 0.012
  const segments = Math.max(8, Math.min(96, Math.round(requestedSegments)))
  const radialSegments = Math.max(3, Math.min(8, Math.round(requestedRadialSegments)))
  const radius = Math.max(0.002, Math.min(0.04, requestedRadius))
  return new TubeGeometry(curveFromPath(path), segments, radius, radialSegments, false)
}

/** Places two quiet world-space accents on each sparse thread path. */
export function createMemoryThreadAccentGeometry(paths: readonly MemoryThreadPath[]) {
  const pointsPerPath = 2
  const positions = new Float32Array(paths.length * pointsPerPath * 3)
  const sizes = new Float32Array(paths.length * pointsPerPath)
  const curveSamples = [0.34, 0.72] as const
  let index = 0
  for (const path of paths) {
    const curve = curveFromPath(path)
    for (const t of curveSamples) {
      const point = curve.getPoint(t)
      positions.set([point.x, point.y, point.z], index * 3)
      sizes[index] = index % 2 === 0 ? 0.04 : 0.055
      index++
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  return geometry
}

/** Maps the Inspector opacity to a quiet in-world alpha and dims it during photo focus. */
export function memoryThreadOpacity(settings: GalleryArtSettings, focusMix = 0) {
  const configured = Number.isFinite(settings.threadOpacity) ? Math.max(0, Math.min(0.8, settings.threadOpacity)) : 0.38
  const focus = Number.isFinite(focusMix) ? Math.max(0, Math.min(1, focusMix)) : 0
  return configured * THREAD_OPACITY_SCALE * (1 - THREAD_FOCUS_DIM * focus)
}

export function createMemoryThreadMaterial(settings: GalleryArtSettings, focusMix = 0) {
  return new MeshBasicMaterial({
    color: '#e9d9bf',
    transparent: true,
    opacity: memoryThreadOpacity(settings, focusMix),
    depthWrite: false,
    fog: true,
    toneMapped: false,
  })
}

/** Updates art settings independently from playback so paused Inspector changes are immediate. */
export function updateMemoryThreadMaterial(
  material: MeshBasicMaterial,
  settings: GalleryArtSettings,
  focusMix = 0,
) {
  material.opacity = memoryThreadOpacity(settings, focusMix)
}
