import { beforeEach, describe, expect, it } from 'vitest'
import { advanceGallery, galleryFocus, galleryMotion, gallerySnapshot, galleryStart, resetGallery, resetGalleryInstruction } from '../scenes/gallery/controller'
import { GALLERY, GALLERY_MEMORIES, galleryPhotoYaw, memoryPosition } from '../scenes/gallery/content'
import { createGalleryEntrySequence, getGalleryEntryRevealDuration } from '../scenes/gallery/entryReveal'
import { clearGalleryPhotoAspects, getGalleryCollageCameraFrame, getGalleryCollageFocusDistance, getGalleryNormalFov, getGalleryPhotoAspectProfile, setGalleryPhotoAspect } from '../scenes/gallery/galleryCameraFit'
import { DEFAULT_SCENE_COMPOSER_CONFIG, normalizeConfig } from '../systems/scene-config/config'
import { updateGalleryCameraPose } from './galleryCameraPose'

describe('gallery camera layout switching', () => {
  beforeEach(() => {
    clearGalleryPhotoAspects()
    resetGalleryInstruction()
    resetGallery()
    advanceGallery(GALLERY.intro)
    galleryStart()
    galleryFocus(2)
    advanceGallery(10)
  })

  it('retargets a focused photo when switching layout while paused without advancing the walk', () => {
    const pose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    const settingsA = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const settingsB = normalizeConfig({ schemaVersion: 17, scenes: { gallery: {
      galleryLayoutVariant: 'between-columns',
      galleryLayoutB: { laneWidth: 7, offsetX: 0.25, offsetY: 0.4, offsetZ: 0.5 },
      columnScale: 1.8,
      columnDepth: 0.63,
    } } }).scenes.gallery
    const progress = galleryMotion.progress

    const frameA = updateGalleryCameraPose(pose, settingsA, { delta: 1, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 })
    const frameB = updateGalleryCameraPose(pose, settingsB, { delta: 1, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 })

    expect(gallerySnapshot().focus).toBe(2)
    expect(frameA.memory.order).toBe(frameB.memory.order)
    expect(frameA.target).not.toEqual(frameB.target)
    expect(frameA.camera).not.toEqual(frameB.camera)
    const expectedBTarget = memoryPosition(GALLERY_MEMORIES[2]!, settingsB.galleryWidth, 'between-columns', settingsB.galleryLayoutB, settingsB)
    expect(frameB.target[2]).toBe(expectedBTarget[2])
    expect(frameB.camera.z).toBeCloseTo(expectedBTarget[2], 6)
    expect(galleryMotion.progress).toBe(progress)
  })

  it('uses the active layout sequence count and preserves pause/reduced-motion entry behavior', () => {
    const settings = normalizeConfig({ schemaVersion: 24, scenes: { gallery: { galleryLayoutVariant: 'between-columns' } } }).scenes.gallery
    const entryCount = createGalleryEntrySequence(GALLERY_MEMORIES, settings).steps.length
    const revealDuration = getGalleryEntryRevealDuration(entryCount)
    const pose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    const options = { delta: 0.05, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 }

    resetGalleryInstruction()
    resetGallery()
    updateGalleryCameraPose(pose, settings, options)
    expect(galleryMotion.entryReveal).toBe(0)
    expect(galleryMotion.intro).toBe(0)

    const activeOptions = { ...options, paused: false }
    for (let elapsed = 0; elapsed < revealDuration; elapsed += activeOptions.delta) {
      updateGalleryCameraPose(pose, settings, activeOptions)
    }
    expect(galleryMotion.entryReveal).toBe(revealDuration)
    expect(galleryMotion.intro).toBeCloseTo(0, 10)
    updateGalleryCameraPose(pose, settings, activeOptions)
    expect(galleryMotion.intro).toBeCloseTo(activeOptions.delta)

    resetGallery()
    updateGalleryCameraPose(pose, settings, { ...activeOptions, reducedMotion: true })
    expect(galleryMotion.entryReveal).toBe(revealDuration)
    expect(galleryMotion.intro).toBeCloseTo(activeOptions.delta)
  })

  it('smoothly refits after texture aspects load, then returns to the corridor and can focus another photo', () => {
    const pose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const options = { delta: 0.05, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 }
    const beforeLoad = updateGalleryCameraPose(pose, settings, { ...options, focusDistance: 4.8 })

    setGalleryPhotoAspect(GALLERY_MEMORIES[2]!.id, 'main', 2.4)
    setGalleryPhotoAspect(GALLERY_MEMORIES[2]!.id, 2, 0.58)
    setGalleryPhotoAspect(GALLERY_MEMORIES[2]!.id, 3, 1.85)
    const afterLoad = updateGalleryCameraPose(pose, settings, { ...options, focusDistance: beforeLoad.focusDistance })
    const loadedFrame = getGalleryCollageCameraFrame(GALLERY_MEMORIES[2]!, settings, getGalleryPhotoAspectProfile(GALLERY_MEMORIES[2]!.id))
    const targetDistance = getGalleryCollageFocusDistance(loadedFrame, options.aspect, getGalleryNormalFov(options.aspect, afterLoad.eased))

    expect(afterLoad.focusDistance).not.toBeCloseTo(beforeLoad.focusDistance)
    expect(Math.abs(afterLoad.focusDistance - beforeLoad.focusDistance)).toBeLessThan(Math.abs(targetDistance - beforeLoad.focusDistance))
    expect(afterLoad.focusDistance).not.toBeCloseTo(targetDistance)

    galleryFocus(null)
    advanceGallery(2)
    const returning = updateGalleryCameraPose(pose, settings, { ...options, focusDistance: afterLoad.focusDistance })
    expect(gallerySnapshot().focus).toBeNull()
    expect(returning.focusDistance).toBeLessThan(afterLoad.focusDistance)

    galleryFocus(3)
    advanceGallery(1)
    const nextPhoto = updateGalleryCameraPose(pose, settings, { ...options, focusDistance: returning.focusDistance })
    expect(gallerySnapshot().focus).toBe(3)
    expect(nextPhoto.camera).not.toEqual(returning.camera)
  })

  it('rotates an asymmetric collage center into world X and Z in on-column focus', () => {
    const memory = GALLERY_MEMORIES.find(candidate => candidate.images[1] && candidate.images[2])!
    expect(memory).toBeDefined()
    galleryFocus(null)
    advanceGallery(2)
    galleryFocus(memory.order)
    advanceGallery(10)

    const settings = normalizeConfig({ schemaVersion: 24, scenes: { gallery: {
      galleryLayoutVariant: 'on-columns',
      collagePhotoScale: 0.9,
      collagePhotoGap: 0.3,
    } } }).scenes.gallery
    setGalleryPhotoAspect(memory.id, 'main', 1.1)
    setGalleryPhotoAspect(memory.id, 2, 0.58)
    setGalleryPhotoAspect(memory.id, 3, 1.8)

    const pose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    let focusDistance = 4.8
    let focusCenter: readonly [number, number] = [0, 0]
    let frame!: ReturnType<typeof updateGalleryCameraPose>
    for (let step = 0; step < 32; step += 1) {
      frame = updateGalleryCameraPose(pose, settings, {
        delta: 0.05,
        speed: 1,
        paused: true,
        reducedMotion: false,
        aspect: 16 / 9,
        focusDistance,
        focusCenter,
      })
      focusDistance = frame.focusDistance
      focusCenter = frame.focusCenter
    }

    expect(Math.abs(frame.collageFrame.centerX)).toBeGreaterThan(0.1)
    const mainTarget = memoryPosition(memory, settings.galleryWidth, 'on-columns', settings.galleryLayoutA, settings)
    const yaw = galleryPhotoYaw(memory, 'on-columns')
    const expectedX = mainTarget[0] + Math.cos(yaw) * frame.collageFrame.centerX
    const expectedZ = mainTarget[2] - Math.sin(yaw) * frame.collageFrame.centerX
    const expectedY = mainTarget[1] + frame.collageFrame.centerY - 0.2

    expect(frame.target[0]).toBeCloseTo(expectedX, 3)
    expect(frame.target[1]).toBeCloseTo(expectedY, 3)
    expect(frame.target[2]).toBeCloseTo(expectedZ, 3)
    expect(frame.camera.x).toBeCloseTo(expectedX + Math.sin(yaw) * focusDistance, 3)
    expect(frame.camera.z).toBeCloseTo(expectedZ + Math.cos(yaw) * focusDistance, 3)
  })

  it('keeps the camera in front of the opposite photo when a collage has a top photo', () => {
    const memory = GALLERY_MEMORIES.find(candidate => candidate.id === '2026_10_Planetarium')!
    expect(memory.images[3]).toBeDefined()
    galleryFocus(null)
    advanceGallery(10)
    galleryFocus(memory.order)
    advanceGallery(10)

    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
    const oppositeMemory = { ...memory, side: memory.side === 1 ? -1 as const : 1 as const }
    const oppositePhoto = memoryPosition(oppositeMemory, settings.galleryWidth, settings.galleryLayoutVariant, layout, settings)
    const pose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 }
    let focusDistance = 4.8
    let focusCenter: readonly [number, number] = [0, 0]
    let frame!: ReturnType<typeof updateGalleryCameraPose>

    for (let step = 0; step < 32; step += 1) {
      frame = updateGalleryCameraPose(pose, settings, {
        delta: 0.05,
        speed: 1,
        paused: true,
        reducedMotion: false,
        aspect: 2551 / 1167,
        focusDistance,
        focusCenter,
      })
      focusDistance = frame.focusDistance
      focusCenter = frame.focusCenter
    }

    expect(memory.side * (frame.camera.x - oppositePhoto[0])).toBeGreaterThan(0.75)
  })

  it('backs the planetarium camera away enough to fit the complete collage and caption', () => {
    const memory = GALLERY_MEMORIES.find(candidate => candidate.id === '2026_10_Planetarium')!
    galleryFocus(null)
    advanceGallery(2)
    galleryFocus(memory.order)
    advanceGallery(10)

    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
    const aspect = 16 / 10
    const pose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    let focusDistance = 4.8
    let focusCenter: readonly [number, number] = [0, 0]
    let frame!: ReturnType<typeof updateGalleryCameraPose>

    for (let step = 0; step < 48; step += 1) {
      frame = updateGalleryCameraPose(pose, settings, {
        delta: 0.05,
        speed: 1,
        paused: true,
        reducedMotion: false,
        aspect,
        focusDistance,
        focusCenter,
      })
      focusDistance = frame.focusDistance
      focusCenter = frame.focusCenter
    }

    const fittedDistance = getGalleryCollageFocusDistance(
      frame.collageFrame,
      aspect,
      70,
    )
    expect(frame.focusDistance).toBeCloseTo(fittedDistance, 1)
  })
})
