import { describe, expect, it } from 'vitest'
import { advanceCollageRevealPlayback, advanceCollageRevealTimeline, collageParticleOpacity, collagePhotoOpacity, createCollageRevealPlayback, createCollageRevealGeometry, DEFAULT_COLLAGE_REVEAL_SETTINGS, getCollageRevealPlaybackFrame, getCollageRevealFrame, getCollageRevealTimelineDuration, getFocusedGalleryCollagePhotos, getGalleryCollagePhotoLayout, getGalleryCollagePhotos, markCollageRevealTextureReady } from './collage'

describe('gallery collage layout', () => {
  it('keeps only available extra photo slots and preserves their numbered positions', () => {
    expect(getGalleryCollagePhotos(['main.jpg', undefined, '3.jpg', undefined])).toEqual([
      { slot: 3, url: '3.jpg' },
    ])
    expect(getGalleryCollagePhotos(['main.jpg'])).toEqual([])
  })

  it('returns populated extra-photo slots only for the focused memory', () => {
    const images = ['main.jpg', '2.jpg', '3.jpg', '4.jpg']
    expect(getFocusedGalleryCollagePhotos(images, 0, null)).toEqual([])
    expect(getFocusedGalleryCollagePhotos(images, 0, 1)).toEqual([])
    expect(getFocusedGalleryCollagePhotos(images, 0, 0)).toEqual([
      { slot: 2, url: '2.jpg' },
      { slot: 3, url: '3.jpg' },
      { slot: 4, url: '4.jpg' },
    ])
    expect(getFocusedGalleryCollagePhotos(['main.jpg', undefined, undefined, '4.jpg'], 0, 0)).toEqual([
      { slot: 4, url: '4.jpg' },
    ])
  })

  it('places numbered photos in a non-overlapping row and biases each wall collage away from the passage', () => {
    const mainWidth = 3.3
    const mainHeight = 3.3
    const wallYaw = 1.15
    const leftSlot2 = getGalleryCollagePhotoLayout(2, -1, 3.3, 3.3, 0.75)
    const leftSlot3 = getGalleryCollagePhotoLayout(3, -1, 3.3, 3.3, 0.75)
    const rightSlot2 = getGalleryCollagePhotoLayout(2, 1, 3.3, 3.3, 0.75)
    const rightSlot3 = getGalleryCollagePhotoLayout(3, 1, 3.3, 3.3, 0.75)

    expect(leftSlot2.position[0]).toBeLessThan(0)
    expect(leftSlot3.position[0]).toBeGreaterThan(0)
    expect(rightSlot2.position[0]).toBeLessThan(0)
    expect(rightSlot3.position[0]).toBeGreaterThan(0)
    expect(leftSlot2.position[0] + leftSlot2.width / 2).toBeLessThan(-mainWidth / 2)
    expect(leftSlot3.position[0] - leftSlot3.width / 2).toBeGreaterThan(mainWidth / 2)
    expect(rightSlot2.position[0] + rightSlot2.width / 2).toBeLessThan(-mainWidth / 2)
    expect(rightSlot3.position[0] - rightSlot3.width / 2).toBeGreaterThan(mainWidth / 2)
    expect(leftSlot2.position[1]).toBeCloseTo(leftSlot3.position[1])
    expect(leftSlot2.width).toBeLessThan(mainWidth)
    expect(leftSlot2.width / leftSlot2.height).toBeCloseTo(0.75)
    const leftTop = getGalleryCollagePhotoLayout(4, -1, mainWidth, mainHeight, 1.4)
    expect(leftTop.position[0]).toBe(0)
    expect(leftTop.position[1]).toBeGreaterThan(mainHeight / 2)

    const leftYaw = wallYaw
    const rightYaw = -wallYaw
    expect(-1 * Math.sin(leftYaw) * leftSlot3.position[2]).toBeGreaterThan(0)
    expect(1 * Math.sin(rightYaw) * rightSlot2.position[2]).toBeGreaterThan(0)
    expect(leftSlot3.position[2]).toBeLessThan(leftSlot2.position[2])
    expect(rightSlot2.position[2]).toBeLessThan(rightSlot3.position[2])
  })

  it('keeps portrait and wide photos at the configured scale and centered above or beside the main photo', () => {
    for (const mainHeight of [2.15, 3.3]) {
      for (const side of [-1, 1] as const) {
        for (const aspect of [0.55, 0.75, 1.4, 2.4]) {
          const sideSlot = side < 0 ? 2 : 3
          const lower = getGalleryCollagePhotoLayout(sideSlot, side, 2.6, mainHeight, aspect)
          const upper = getGalleryCollagePhotoLayout(4, side, 2.6, mainHeight, aspect)

          expect(Math.max(lower.width, lower.height)).toBeCloseTo(Math.max(2.6, mainHeight) * 0.9)
          expect(lower.height).toBeCloseTo(lower.width / aspect)
          expect(Math.max(upper.width, upper.height)).toBeCloseTo(Math.max(2.6, mainHeight) * 0.9)
          expect(upper.height).toBeCloseTo(upper.width / aspect)
          expect(upper.position[0]).toBe(0)
          expect(upper.position[1] - upper.height / 2).toBeCloseTo(mainHeight / 2 + 0.3)
          expect(lower.position[0] * side).toBeGreaterThan(0)
          expect(Math.abs(lower.position[0]) - lower.width / 2 - 2.6 / 2).toBeCloseTo(0.3)
        }
      }
    }
  })

  it('keeps two and three additional photos at 90% scale with a clear configured gap', () => {
    const settings = { photoScale: 0.9, photoGap: 0.3 }
    const left = getGalleryCollagePhotoLayout(2, -1, 3.3, 3.3, 0.75, settings)
    const right = getGalleryCollagePhotoLayout(3, -1, 3.3, 3.3, 1.4, settings)
    const upper = getGalleryCollagePhotoLayout(4, -1, 3.3, 3.3, 1.2, settings)

    expect(Math.max(left.width, left.height)).toBeCloseTo(2.97)
    expect(left.height).toBeCloseTo(left.width / 0.75)
    expect(Math.abs(left.position[0]) - left.width / 2 - 3.3 / 2).toBeCloseTo(0.3)
    expect((right.position[0] - right.width / 2) - 3.3 / 2).toBeCloseTo(0.3)
    expect(Math.max(upper.width, upper.height)).toBeCloseTo(2.97)
    expect(upper.position[1] - upper.height / 2 - 3.3 / 2).toBeCloseTo(0.3)
  })

  it('places B collage photos left, right, and above the main photo with the configured gaps', () => {
    const settings = { photoScale: 0.9, photoGap: 0.3 }
    const first = getGalleryCollagePhotoLayout(2, -1, 3.3, 2.4, 0.72, settings, 'between-columns')
    const second = getGalleryCollagePhotoLayout(3, -1, 3.3, 2.4, 1.4, settings, 'between-columns')
    const top = getGalleryCollagePhotoLayout(4, -1, 3.3, 2.4, 0.55, settings, 'between-columns')

    expect(first.position[0]).toBeLessThan(0)
    expect(second.position[0]).toBeGreaterThan(0)
    expect(top.position[0]).toBe(0)
    expect(Math.abs(first.position[0]) - first.width / 2 - 3.3 / 2).toBeCloseTo(0.3)
    expect(second.position[0] - second.width / 2 - 3.3 / 2).toBeCloseTo(0.3)
    expect(top.position[1] - top.height / 2 - 2.4 / 2).toBeCloseTo(0.3)
    expect(first.position[1]).toBeCloseTo(-2.4 / 2 + first.height / 2 + 0.3)
    expect(second.position[1]).toBeCloseTo(-2.4 / 2 + second.height / 2 + 0.3)
    expect(first.position[2]).toBe(0.85)
    expect(second.position[2]).toBe(0.85)
    expect(Math.max(first.width, first.height)).toBeCloseTo(2.97)
    expect(Math.max(second.width, second.height)).toBeCloseTo(2.97)
    expect(Math.max(top.width, top.height)).toBeCloseTo(2.97)
    for (const photo of [first, second, top]) {
      expect(0.75 + photo.position[1] - photo.height / 2).toBeGreaterThan(-2.35)
    }
  })

  it('uses reproducible particles and eases from particles into the image on focus', () => {
    const first = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    const second = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    expect(first.getAttribute('position').array).toEqual(second.getAttribute('position').array)
    expect(first.getAttribute('targetPosition').count).toBe(48)
    expect(collageParticleOpacity(0)).toBe(0)
    expect(collageParticleOpacity(0.25)).toBeGreaterThan(0)
    expect(collagePhotoOpacity(0)).toBe(0)
    expect(collageParticleOpacity(1)).toBe(0)
    expect(collagePhotoOpacity(1)).toBe(1)
    first.dispose()
    second.dispose()
  })

  it('samples deterministic photo UVs while keeping scatter and targets inside the numbered slot', () => {
    const first = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    const second = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    const firstUv = first.getAttribute('photoUv')
    const secondUv = second.getAttribute('photoUv')

    expect(firstUv).toBeDefined()
    expect(firstUv.count).toBe(48)
    expect(firstUv.array).toEqual(secondUv.array)
    const uvs = firstUv.array as Float32Array
    const positions = first.getAttribute('position').array as Float32Array
    const targets = first.getAttribute('targetPosition').array as Float32Array
    for (let i = 0; i < firstUv.count; i++) {
      const u = uvs[i * 2]!
      const v = uvs[i * 2 + 1]!
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(positions[i * 3]!)).toBeLessThanOrEqual(1.02 / 2)
      expect(Math.abs(positions[i * 3 + 1]!)).toBeLessThanOrEqual(1.36 / 2)
      expect(Math.abs(targets[i * 3]!)).toBeLessThanOrEqual(1.02 / 2)
      expect(Math.abs(targets[i * 3 + 1]!)).toBeLessThanOrEqual(1.36 / 2)
    }
    first.dispose()
    second.dispose()
  })

  it('uses configured durations as seconds while keeping numbered slot stagger', () => {
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, assembleDuration: 0.5, revealDuration: 0.5, staggerDelay: 0.1 }
    const slot2Assembled = getCollageRevealFrame(0.5, 2, settings)
    const slot3Starting = getCollageRevealFrame(0.1, 3, settings)
    const slot4Assembled = getCollageRevealFrame(0.7, 4, settings)

    expect(slot2Assembled).toMatchObject({ assemblyProgress: 1, photoProgress: 0 })
    expect(slot3Starting).toMatchObject({ assemblyProgress: 0, photoProgress: 0 })
    expect(slot4Assembled.assemblyProgress).toBeCloseTo(1)
    expect(slot4Assembled.photoProgress).toBe(0)
    expect(getCollageRevealFrame(4.5, 2, settings).photoProgress).toBe(1)
    expect(getCollageRevealFrame(4.25, 2, settings).photoProgress).toBeCloseTo(0.5)
    expect(getCollageRevealFrame(0.6, 4, { ...settings, particleEnabled: false }).particleOpacity).toBe(0)
    expect(getCollageRevealFrame(0.6, 4, { ...settings, assembleDuration: 2, revealDuration: 2 }).assemblyProgress).toBeCloseTo(0.2)
  })

  it('holds the default five-second particle assembly before the progressive photo reveal begins', () => {
    const settings = DEFAULT_COLLAGE_REVEAL_SETTINGS
    const beforeAssembly = getCollageRevealFrame(4.99, 2, settings)
    const assemblyComplete = getCollageRevealFrame(5, 2, settings)
    const holdComplete = getCollageRevealFrame(8.5, 2, settings)
    const revealMiddle = getCollageRevealFrame(9.75, 2, settings)
    const revealComplete = getCollageRevealFrame(11, 2, settings)

    expect(settings.assembleDuration).toBe(5)
    expect(settings.revealDuration).toBe(2.5)
    expect(beforeAssembly.assemblyProgress).toBeCloseTo(0.998)
    expect(beforeAssembly.photoProgress).toBe(0)
    expect(assemblyComplete).toMatchObject({ assemblyProgress: 1, photoProgress: 0 })
    expect(holdComplete).toMatchObject({ assemblyProgress: 1, photoProgress: 0, particleOpacity: 0.8 })
    expect(revealMiddle.photoProgress).toBeCloseTo(0.5)
    expect(revealMiddle.photoOpacity).toBeGreaterThan(0)
    expect(revealMiddle.photoOpacity).toBeLessThan(1)
    expect(revealComplete.photoOpacity).toBe(1)
    expect(getCollageRevealTimelineDuration(4, settings)).toBeCloseTo(11.28)
  })

  it('reverses by elapsed film time and reaches zero before the controller drops focus', () => {
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, assembleDuration: 2, revealDuration: 2, staggerDelay: 0.2 }
    const focusTime = 1.4
    const partlyReturned = advanceCollageRevealTimeline(focusTime, 0.2, -1, 0.5, 4, settings)
    expect(partlyReturned).toBeLessThan(focusTime)
    expect(partlyReturned).toBeGreaterThan(0)
    expect(partlyReturned).toBeCloseTo(focusTime * (Math.log(0.5 / 0.001) / 3.8) / (Math.log(0.5 / 0.001) / 3.8 + 0.2))
    expect(advanceCollageRevealTimeline(partlyReturned, 0.1, 1, 0.5, 4, settings)).toBeGreaterThan(partlyReturned)
    expect(advanceCollageRevealTimeline(0.2, 0.5, -1, 0.001, 4, settings)).toBe(0)
    expect(advanceCollageRevealTimeline(0.2, 0.1, 0, 1, 4, settings)).toBe(0.2)
  })

  it('waits for the matching image load before advancing a staggered timeline, without jumping on late load', async () => {
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, assembleDuration: 0.5, revealDuration: 0.5, staggerDelay: 0.1 }
    const session = {}
    let playback = createCollageRevealPlayback(session)
    let resolveImage!: (result: 'loaded' | 'error') => void
    const imageLoad = new Promise<'loaded' | 'error'>(resolve => { resolveImage = resolve })

    playback = advanceCollageRevealPlayback(playback, 0.4, 1, 1, 4, settings)
    expect(playback.elapsedSeconds).toBe(0)
    expect(getCollageRevealPlaybackFrame(playback, 4, settings).assemblyProgress).toBe(0)

    resolveImage('loaded')
    const result = await imageLoad
    playback = markCollageRevealTextureReady(playback, session, result)
    expect(getCollageRevealPlaybackFrame(playback, 4, settings)).toMatchObject({
      assemblyProgress: 0,
      photoOpacity: 0,
      particleOpacity: 0,
    })

    playback = advanceCollageRevealPlayback(playback, 0.1, 1, 1, 4, settings)
    expect(playback.elapsedSeconds).toBe(0)
    playback = advanceCollageRevealPlayback(playback, 0.1, 1, 1, 4, settings)
    const firstVisibleStep = getCollageRevealPlaybackFrame(playback, 4, settings)
    expect(firstVisibleStep.assemblyProgress).toBeGreaterThan(0)
    expect(firstVisibleStep.assemblyProgress).toBeLessThan(1)
    expect(firstVisibleStep.photoOpacity).toBe(0)
  })

  it('ignores stale URL completions, treats load errors as fallback-ready, and pauses without advancing', () => {
    const oldSession = {}
    const session = {}
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, staggerDelay: 0.2 }
    let playback = createCollageRevealPlayback(session)

    expect(markCollageRevealTextureReady(playback, oldSession, 'loaded')).toBe(playback)
    expect(playback.textureReady).toBe(false)

    playback = markCollageRevealTextureReady(playback, session, 'error')
    expect(playback).toMatchObject({ textureReady: true, usingFallback: true, startPending: true })
    playback = advanceCollageRevealPlayback(playback, 0.1, 1, 1, 3, settings, false, true)
    expect(playback.focusedSeconds).toBe(0)
    expect(playback.elapsedSeconds).toBe(0)

    playback = advanceCollageRevealPlayback(playback, 0.3, 1, 1, 3, settings)
    expect(playback.elapsedSeconds).toBe(0)
    playback = advanceCollageRevealPlayback(playback, 0.3, 1, 1, 3, settings)
    expect(playback.focusedSeconds).toBeCloseTo(0.3)
    expect(playback.elapsedSeconds).toBeCloseTo(0.1)
    playback = advanceCollageRevealPlayback(playback, 0.3, -1, 0.5, 3, settings)
    expect(playback.elapsedSeconds).toBeLessThan(0.1)
  })

  it('keeps a late texture invisible after focus returns before loading finishes', async () => {
    const session = {}
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, staggerDelay: 0.1 }
    let playback = createCollageRevealPlayback(session)
    let resolveImage!: () => void
    const imageLoad = new Promise<void>(resolve => { resolveImage = resolve })

    playback = advanceCollageRevealPlayback(playback, 0.08, 1, 0.2, 3, settings)
    playback = advanceCollageRevealPlayback(playback, 0.1, -1, 0.1, 3, settings)
    expect(playback.focusedSeconds).toBe(0)
    expect(playback.elapsedSeconds).toBe(0)

    resolveImage()
    await imageLoad
    playback = markCollageRevealTextureReady(playback, session, 'loaded')
    expect(getCollageRevealPlaybackFrame(playback, 3, settings)).toMatchObject({
      assemblyProgress: 0,
      photoOpacity: 0,
      particleOpacity: 0,
    })
    playback = advanceCollageRevealPlayback(playback, 0.05, -1, 0.1, 3, settings)
    expect(getCollageRevealPlaybackFrame(playback, 3, settings).photoOpacity).toBe(0)
  })

  it('starts reduced-motion photo reveals without particle stagger after texture readiness', () => {
    const session = {}
    let playback = markCollageRevealTextureReady(createCollageRevealPlayback(session), session, 'loaded')
    const settings = { ...DEFAULT_COLLAGE_REVEAL_SETTINGS, assembleDuration: 0.5, revealDuration: 0.5, staggerDelay: 0.4 }

    playback = advanceCollageRevealPlayback(playback, 0.1, 1, 1, 4, settings, true)
    expect(getCollageRevealPlaybackFrame(playback, 4, settings, true).photoOpacity).toBe(0)
    playback = advanceCollageRevealPlayback(playback, 0.1, 1, 1, 4, settings, true)
    expect(getCollageRevealPlaybackFrame(playback, 4, settings, true).photoOpacity).toBeGreaterThan(0)
    expect(getCollageRevealPlaybackFrame(playback, 4, settings, true).particleOpacity).toBe(0)
  })
})
