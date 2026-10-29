import { GALLERY, GALLERY_MEMORIES } from './content'
type Phase = 'intro' | 'instruction' | 'explore' | 'exit'
export interface GallerySnapshot { phase: Phase; focus: number | null; atEnd: boolean }
const initial: GallerySnapshot = { phase: 'intro', focus: null, atEnd: false }
let snapshot = initial
let instructionSeen = false
const listeners = new Set<() => void>()
export const galleryMotion = { progress: 0, target: 0, intro: 0, exit: 0, focusMix: 0, focusIndex: 0, focusTime: 0, time: 0, pinching: false, suppressClick: false }
function publish(next: GallerySnapshot) { snapshot = next; listeners.forEach((listener) => listener()) }
export function gallerySnapshot() { return snapshot }
export function subscribeGallery(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function resetGallery() { Object.assign(galleryMotion, { progress: 0, target: 0, intro: 0, exit: 0, focusMix: 0, focusIndex: 0, focusTime: 0, time: 0, pinching: false, suppressClick: false }); publish(initial) }
export function resetGalleryInstruction() { instructionSeen = false }
export function galleryInstruction() { if (snapshot.phase === 'intro') publish({ ...snapshot, phase: instructionSeen ? 'explore' : 'instruction' }) }
export function galleryStart() { if (snapshot.phase === 'instruction') { instructionSeen = true; publish({ ...snapshot, phase: 'explore' }) } }
export function galleryExit() { if (snapshot.phase === 'explore' && snapshot.atEnd) publish({ ...snapshot, phase: 'exit', focus: null }) }
export function galleryFocus(index: number | null) { if (snapshot.phase !== 'explore' || galleryMotion.pinching || galleryMotion.suppressClick || (index !== null && (!Number.isInteger(index) || index < 0 || index >= GALLERY_MEMORIES.length))) return; const focus = index === snapshot.focus ? null : index; if (focus !== null) { galleryMotion.focusIndex = focus; galleryMotion.focusTime = 0 } galleryMotion.target = galleryMotion.progress; publish({ ...snapshot, focus }) }
export function travel(delta: number) { if (snapshot.phase !== 'explore' || snapshot.focus !== null || !Number.isFinite(delta)) return; galleryMotion.target = Math.max(0, Math.min(GALLERY.travel, galleryMotion.target + delta)) }
export function advanceGallery(dt: number) { const m = galleryMotion; m.time += dt; if (snapshot.focus !== null) m.focusTime += dt; if (snapshot.phase === 'intro') { m.intro = Math.min(GALLERY.intro, m.intro + dt); if (m.intro >= GALLERY.intro) galleryInstruction() } if (snapshot.phase === 'exit') m.exit = Math.min(GALLERY.exit, m.exit + dt); const blend = 1 - Math.exp(-5 * dt); m.progress += (m.target - m.progress) * blend; m.focusMix += ((snapshot.focus === null ? 0 : 1) - m.focusMix) * (1 - Math.exp(-3.8 * dt)); const atEnd = m.progress > GALLERY.travel - 2; if (atEnd !== snapshot.atEnd) publish({ ...snapshot, atEnd }) }
