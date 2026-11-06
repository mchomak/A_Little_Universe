import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { galleryColumnPositions, memoryPosition, PLANETARIUM_GALLERY_EVENT_ID, type GalleryMemory } from './content'

export type GalleryEntryRevealPhase = 'water' | 'clouds' | 'moon' | 'item' | 'arch'
export type GalleryEntrySettings = SceneComposerConfig['scenes']['gallery']

export type GalleryEntrySequenceStep =
  | { kind: 'column'; index: number; memoryOrder: number; supportIndex: number; position: [number, number, number] }
  | { kind: 'photo'; index: number; memoryOrder: number; position: [number, number, number] }
type GalleryEntryPendingStep =
  | { kind: 'column'; memoryOrder: number; supportIndex: number; position: [number, number, number] }
  | { kind: 'photo'; memoryOrder: number; position: [number, number, number] }

export interface GalleryEntrySequence {
  steps: GalleryEntrySequenceStep[]
  photoIndices: ReadonlyMap<number, number>
}

const WATER_DURATION = 0.7
const CLOUDS_DURATION = 0.8
const MOON_DURATION = 0.7
const ITEM_DURATION = 0.3
const ARCH_DURATION = 0.65

export function createGalleryEntrySequence(
  memories: readonly GalleryMemory[],
  settings: GalleryEntrySettings,
): GalleryEntrySequence {
  const layout = settings.galleryLayoutVariant === 'between-columns'
    ? settings.galleryLayoutB
    : settings.galleryLayoutA
  const pending: GalleryEntryPendingStep[] = []
  const supportKeysByMemory = new Map<number, string[]>()
  const photoPositions = new Map<number, [number, number, number]>()

  for (const memory of memories) {
    const photoPosition = memoryPosition(
      memory,
      settings.galleryWidth,
      settings.galleryLayoutVariant,
      layout,
      settings,
    )
    if (memory.order > 0) photoPositions.set(memory.order, photoPosition)

    const supports = settings.columnVisible && memory.id !== PLANETARIUM_GALLERY_EVENT_ID
      ? galleryColumnPositions(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout)
      : []
    if (supports.length === 0) {
      if (memory.order > 0) {
        pending.push({ kind: 'photo', memoryOrder: memory.order, position: photoPosition })
      }
      continue
    }

    supportKeysByMemory.set(memory.order, [])
    supports.forEach((position, supportIndex) => {
      const key = `${memory.order}:${supportIndex}`
      supportKeysByMemory.get(memory.order)!.push(key)
      pending.push({ kind: 'column', memoryOrder: memory.order, supportIndex, position })
    })
  }

  pending.sort((a, b) => {
    const depthDifference = b.position[2] - a.position[2]
    if (Math.abs(depthDifference) > 1e-6) return depthDifference
    const lateralDifference = a.position[0] - b.position[0]
    if (Math.abs(lateralDifference) > 1e-6) return lateralDifference
    if (a.kind !== b.kind) return a.kind === 'column' ? -1 : 1
    if (a.memoryOrder !== b.memoryOrder) return a.memoryOrder - b.memoryOrder
    if (a.kind === 'column' && b.kind === 'column') return a.supportIndex - b.supportIndex
    return 0
  })

  const steps = pending.map((step, index) => ({ ...step, index }) as GalleryEntrySequenceStep)
  const supportIndexByKey = new Map<string, number>()
  const photoIndices = new Map<number, number>()
  for (const step of steps) {
    if (step.kind === 'column') supportIndexByKey.set(`${step.memoryOrder}:${step.supportIndex}`, step.index)
    else photoIndices.set(step.memoryOrder, step.index)
  }

  for (const [memoryOrder, supportKeys] of supportKeysByMemory) {
    if (memoryOrder === 0 || supportKeys.length === 0) continue
    const photoPosition = photoPositions.get(memoryOrder)!
    const nearestSupport = supportKeys
      .map(key => supportIndexByKey.get(key)!)
      .map(index => {
        const support = steps[index]!
        const dx = support.position[0] - photoPosition[0]
        const dy = support.position[1] - photoPosition[1]
        const dz = support.position[2] - photoPosition[2]
        return { index, distance: dx * dx + dy * dy + dz * dz }
      })
      .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]
    if (nearestSupport) photoIndices.set(memoryOrder, nearestSupport.index)
  }

  return { steps, photoIndices }
}

export function getGalleryEntryRevealDuration(entryCount: number): number {
  const safeCount = Number.isFinite(entryCount) ? Math.max(0, Math.floor(entryCount)) : 0
  return WATER_DURATION + CLOUDS_DURATION + MOON_DURATION + safeCount * ITEM_DURATION + ARCH_DURATION
}

function smoothAlpha(elapsed: number, start: number, duration: number): number {
  if (!Number.isFinite(elapsed) || !Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return 0
  const progress = Math.max(0, Math.min(1, (elapsed - start) / duration))
  return progress * progress * (3 - 2 * progress)
}

export function getGalleryEntryRevealAlpha(
  elapsed: number,
  phase: GalleryEntryRevealPhase,
  index = 0,
): number {
  const safeIndex = Number.isFinite(index) ? Math.floor(index) : -1
  if (safeIndex < 0) return 0

  switch (phase) {
    case 'water': return smoothAlpha(elapsed, 0, WATER_DURATION)
    case 'clouds': return smoothAlpha(elapsed, WATER_DURATION, CLOUDS_DURATION)
    case 'moon': return smoothAlpha(elapsed, WATER_DURATION + CLOUDS_DURATION, MOON_DURATION)
    case 'item': return smoothAlpha(
      elapsed,
      WATER_DURATION + CLOUDS_DURATION + MOON_DURATION + safeIndex * ITEM_DURATION,
      ITEM_DURATION,
    )
    case 'arch': return smoothAlpha(
      elapsed,
      WATER_DURATION + CLOUDS_DURATION + MOON_DURATION + safeIndex * ITEM_DURATION,
      ARCH_DURATION,
    )
  }
}
