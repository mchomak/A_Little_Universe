import { GALLERY, GALLERY_MEMORIES } from './content'
import type { Object3D } from 'three'
import { getGalleryEntryRevealDuration } from './entryReveal'
type Phase = 'intro' | 'instruction' | 'explore' | 'exit'
export type GalleryInteraction = 'walk' | 'focusing' | 'focused' | 'returning'
export interface GallerySnapshot { phase: Phase; interaction: GalleryInteraction; focus: number | null; atEnd: boolean }
const initial: GallerySnapshot = { phase: 'intro', interaction: 'walk', focus: null, atEnd: false }
let snapshot = initial
let instructionSeen = false
const listeners = new Set<() => void>()
export const galleryMotion = { progress: 0, target: 0, intro: 0, entryReveal: 0, exit: 0, focusMix: 0, focusIndex: 0, focusTime: 0, time: 0, pinching: false, suppressClick: false }
function publish(next: GallerySnapshot) { snapshot = next; listeners.forEach((listener) => listener()) }
export function gallerySnapshot() { return snapshot }
export function galleryCanRaycastPhoto(index: number) {
  if (snapshot.phase !== 'explore' || !Number.isInteger(index) || index < 0 || index >= GALLERY_MEMORIES.length) return false
  if (snapshot.interaction === 'walk') return true
  return (snapshot.interaction === 'focusing' || snapshot.interaction === 'focused') && snapshot.focus === index
}
export function galleryPhotoRaycast(index: number, raycast: Object3D['raycast'], canHit: () => boolean = () => true): Object3D['raycast'] {
  return function (this: Object3D, ...args: Parameters<Object3D['raycast']>) {
    if (galleryCanRaycastPhoto(index) && canHit()) raycast.apply(this, args)
  }
}
export function subscribeGallery(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function resetGallery() { Object.assign(galleryMotion, { progress: 0, target: 0, intro: 0, entryReveal: 0, exit: 0, focusMix: 0, focusIndex: 0, focusTime: 0, time: 0, pinching: false, suppressClick: false }); publish(initial) }
export function resetGalleryInstruction() { instructionSeen = false }
export function galleryInstruction() { if (snapshot.phase === 'intro') publish({ ...snapshot, phase: instructionSeen ? 'explore' : 'instruction' }) }
export function galleryStart() { if (snapshot.phase === 'instruction') { instructionSeen = true; publish({ ...snapshot, phase: 'explore' }) } }
export function galleryExit() {
  if (snapshot.phase !== 'explore' || !snapshot.atEnd || snapshot.interaction !== 'walk') return
  const focus = GALLERY_MEMORIES.length - 1
  galleryMotion.focusIndex = focus
  galleryMotion.focusTime = 0
  galleryMotion.target = galleryMotion.progress
  publish({ ...snapshot, phase: 'exit', focus, interaction: 'focusing' })
}
export function galleryFocus(index: number | null) {
  if (snapshot.phase !== 'explore' || galleryMotion.pinching || galleryMotion.suppressClick || (index !== null && (!Number.isInteger(index) || index < 0 || index >= GALLERY_MEMORIES.length))) return
  if (snapshot.interaction === 'walk') {
    if (index === null) return
    galleryMotion.focusIndex = index
    galleryMotion.focusTime = 0
    galleryMotion.target = galleryMotion.progress
    publish({ ...snapshot, focus: index, interaction: 'focusing' })
    return
  }
  if ((snapshot.interaction === 'focusing' || snapshot.interaction === 'focused') && (index === null || index === snapshot.focus)) {
    publish({ ...snapshot, interaction: 'returning' })
  }
}
export function travel(delta: number) { if (snapshot.phase !== 'explore' || snapshot.interaction !== 'walk' || !Number.isFinite(delta)) return; galleryMotion.target = Math.max(0, Math.min(GALLERY.travel, galleryMotion.target + delta)) }
export function advanceGallery(dt: number, reducedMotion = false, entryCount?: number) {
  const m = galleryMotion
  m.time += dt
  if (snapshot.focus !== null && snapshot.interaction !== 'returning') m.focusTime += dt
  if (snapshot.phase === 'intro') {
    const revealDuration = Number.isFinite(entryCount) ? getGalleryEntryRevealDuration(entryCount!) : 0
    let introDelta = dt
    if (reducedMotion) m.entryReveal = revealDuration
    else {
      const revealRemaining = Math.max(0, revealDuration - m.entryReveal)
      const revealDelta = Math.min(Math.max(0, dt), revealRemaining)
      m.entryReveal += revealDelta
      introDelta = Math.max(0, dt - revealDelta)
    }
    if (m.entryReveal >= revealDuration) {
      m.intro = Math.min(GALLERY.intro, m.intro + introDelta)
      if (m.intro >= GALLERY.intro) galleryInstruction()
    }
  }
  if (snapshot.phase === 'exit') m.exit = Math.min(GALLERY.exit, m.exit + dt)
  const blend = 1 - Math.exp(-5 * dt)
  m.progress += (m.target - m.progress) * blend
  const targetFocusMix = snapshot.interaction === 'focusing' || snapshot.interaction === 'focused' ? 1 : 0
  m.focusMix += (targetFocusMix - m.focusMix) * (1 - Math.exp(-3.8 * dt))
  if (targetFocusMix === 1 && 1 - m.focusMix < .001) {
    m.focusMix = 1
    if (snapshot.interaction === 'focusing') publish({ ...snapshot, interaction: 'focused' })
  } else if (targetFocusMix === 0 && m.focusMix < .001) {
    m.focusMix = 0
    if (snapshot.interaction === 'returning') publish({ ...snapshot, focus: null, interaction: 'walk' })
  }
  const atEnd = m.progress > GALLERY.travel - 2
  if (atEnd !== snapshot.atEnd) publish({ ...snapshot, atEnd })
}
