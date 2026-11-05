import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  getGalleryCollageCameraFrame,
  getGalleryCollageFocusDistance,
  clearGalleryPhotoAspects,
  getGalleryPhotoAspectProfile,
  setGalleryPhotoAspect,
  type GalleryPhotoAspectProfile,
} from './galleryCameraFit'
import type { GalleryLayoutVariant, GalleryMemory } from './content'

const memory = (images: number, aspect = 1, side: -1 | 1 = 1): GalleryMemory => ({
  id: `camera-fit-${images}`,
  image: 'main.jpg',
  images: ['main.jpg', ...Array.from({ length: images }, (_, index) => `extra-${index}.jpg`)],
  title: 'A quieter event title',
  caption: 'A caption below the photograph',
  aspect,
  side,
  order: 4,
})

const settings = { collagePhotoScale: 0.9, collagePhotoGap: 0.3 }

function expectFrameInsideViewport(
  photoCount: number,
  viewportAspect: number,
  mainAspect: number,
  extraAspects: readonly number[],
  side: -1 | 1,
  layoutVariant: GalleryLayoutVariant = 'on-columns',
) {
  const exhibit = memory(photoCount, mainAspect, side)
  const aspects: GalleryPhotoAspectProfile = { main: mainAspect, extras: extraAspects }
  const frame = getGalleryCollageCameraFrame(exhibit, { ...settings, galleryLayoutVariant: layoutVariant }, aspects)
  const normalFov = viewportAspect < 1 ? 70 : 48
  const distance = getGalleryCollageFocusDistance(frame, viewportAspect, normalFov)
  const fitHeight = Math.max(frame.height, frame.width / Math.max(0.3, viewportAspect))
  const fov = Math.max(4, Math.min(70, 2 * Math.atan(fitHeight / (2 * distance * 0.75)) * 180 / Math.PI))
  const yaw = layoutVariant === 'between-columns'
    ? side < 0 ? Math.PI / 2 : -Math.PI / 2
    : side < 0 ? 1.15 : -1.15
  const frameCenter = new Vector3(frame.centerX, frame.centerY, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw)
  const camera = new PerspectiveCamera(fov, viewportAspect, 0.1, 100)
  camera.position.set(frameCenter.x + Math.sin(yaw) * distance, frameCenter.y + 0.12, frameCenter.z + Math.cos(yaw) * distance)
  camera.lookAt(frameCenter.x, frameCenter.y - 0.2, frameCenter.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()

  const projectedCorners = [
    [frame.minX, frame.minY], [frame.minX, frame.maxY],
    [frame.maxX, frame.minY], [frame.maxX, frame.maxY],
  ].map(([x, y]) => new Vector3(x!, y!, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw).project(camera))

  for (const corner of projectedCorners) {
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(0.85)
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(0.85)
  }
  return distance
}

describe('gallery collage camera fit', () => {
  it('fits two and three extra photos with mixed portrait and landscape aspects across viewport shapes', () => {
    const twoWide = expectFrameInsideViewport(2, 16 / 9, 1.35, [0.72, 1.8], 1, 'between-columns')
    const threeWide = expectFrameInsideViewport(3, 16 / 9, 0.72, [1.4, 0.62, 1.9], -1, 'between-columns')
    const threePortrait = expectFrameInsideViewport(3, 9 / 16, 1.4, [0.55, 1.8, 0.76], 1, 'between-columns')
    const twoPortrait = expectFrameInsideViewport(2, 3 / 4, 0.66, [2.2, 0.72], -1)

    expect(threeWide).toBeGreaterThan(twoWide)
    expect(threePortrait).toBeGreaterThan(4.8)
    expect(twoPortrait).toBeGreaterThan(4.8)
  })

  it('recomputes the frame when loaded texture aspects replace their fallback values', () => {
    const exhibit = memory(3, 1)
    const fallback = getGalleryCollageCameraFrame(exhibit, settings, { main: 1, extras: [1, 1, 1] })
    const loaded = getGalleryCollageCameraFrame(exhibit, settings, { main: 0.62, extras: [1.8, 0.55, 1.4] })

    expect(loaded.width).not.toBeCloseTo(fallback.width)
    expect(loaded.height).not.toBeCloseTo(fallback.height)
    expect(getGalleryCollageFocusDistance(loaded, 9 / 16, 70))
      .not.toBeCloseTo(getGalleryCollageFocusDistance(fallback, 9 / 16, 70))
  })

  it('gives short captions compact space and fits long captions with additional wrapped lines', () => {
    const exhibit = memory(0)
    const noCaption = getGalleryCollageCameraFrame({ ...exhibit, title: '', caption: '' }, settings)
    const short = getGalleryCollageCameraFrame({
      ...exhibit,
      title: 'Поездка в Тулу — май 2026',
      caption: 'Один хороший день.',
    }, settings)
    const long = getGalleryCollageCameraFrame({
      ...exhibit,
      title: 'Планетарий — октябрь 2026',
      caption: 'Тогда мы встретились и отправились смотреть на звёзды вместе. '.repeat(14),
    }, settings)

    expect(short.height - noCaption.height).toBeLessThan(1)
    expect(long.height).toBeGreaterThan(short.height + 1.5)
    expect(long.minY).toBeLessThan(short.minY)
  })

  it('centers the camera on a three-photo B frame to keep the selected image inside the corridor fade range', () => {
    const exhibit = memory(3, 1.36, -1)
    const frame = getGalleryCollageCameraFrame(exhibit, { ...settings, galleryLayoutVariant: 'between-columns' }, {
      main: 1.36,
      extras: [0.72, 1.4, 0.75],
    })
    const distance = getGalleryCollageFocusDistance(frame, 16 / 9, 48)
    const rawHalfHeight = frame.height / (2 * 1.2)
    const mainCenteredHeight = 2 * Math.max(
      Math.abs(frame.centerY - rawHalfHeight),
      Math.abs(frame.centerY + rawHalfHeight),
    ) * 1.2
    const mainCenteredDistance = getGalleryCollageFocusDistance({ ...frame, height: mainCenteredHeight }, 16 / 9, 48)

    expect(frame.centerY).toBeGreaterThan(0)
    expect(distance).toBeLessThan(mainCenteredDistance)
    expect(Math.hypot(distance, frame.centerY)).toBeLessThan(32)
  })

  it('retains only loaded aspect metadata per memory for camera updates', () => {
    clearGalleryPhotoAspects()
    setGalleryPhotoAspect('memory-a', 'main', 0.72)
    setGalleryPhotoAspect('memory-a', 2, 1.8)
    setGalleryPhotoAspect('memory-b', 3, 0.55)

    expect(getGalleryPhotoAspectProfile('memory-a')).toEqual({ main: 0.72, extras: [1.8, undefined, undefined] })
    expect(getGalleryPhotoAspectProfile('memory-b')).toEqual({ extras: [undefined, 0.55, undefined] })
    clearGalleryPhotoAspects('memory-a')
    expect(getGalleryPhotoAspectProfile('memory-a')).toEqual({})
    clearGalleryPhotoAspects()
  })
})
