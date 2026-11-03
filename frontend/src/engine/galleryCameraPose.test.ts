import { beforeEach, describe, expect, it } from 'vitest'
import { advanceGallery, galleryFocus, galleryMotion, gallerySnapshot, galleryStart, resetGallery, resetGalleryInstruction } from '../scenes/gallery/controller'
import { GALLERY } from '../scenes/gallery/content'
import { DEFAULT_SCENE_COMPOSER_CONFIG, normalizeConfig } from '../systems/scene-config/config'
import { updateGalleryCameraPose } from './galleryCameraPose'

describe('gallery camera layout switching', () => {
  beforeEach(() => {
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
    } } }).scenes.gallery
    const progress = galleryMotion.progress

    const frameA = updateGalleryCameraPose(pose, settingsA, { delta: 1, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 })
    const frameB = updateGalleryCameraPose(pose, settingsB, { delta: 1, speed: 1, paused: true, reducedMotion: false, aspect: 16 / 9 })

    expect(gallerySnapshot().focus).toBe(2)
    expect(frameA.memory.order).toBe(frameB.memory.order)
    expect(frameA.target).not.toEqual(frameB.target)
    expect(frameA.camera).not.toEqual(frameB.camera)
    expect(galleryMotion.progress).toBe(progress)
  })
})
