import { expect, it } from 'vitest'

it('uses only assigned portrait routes and the shader braking value for the final landing time', async () => {
  const photoReveal = await import('./portraitPhotoReveal').catch(() => null)
  const arrival = photoReveal?.getLilyPortraitPhotoLastArrivalTime(
    new Float32Array([
      2, 3, 0.4, 1.2,
      5, 4, 0.6, 1.1,
      30, 10, 0.7, 0,
    ]),
    new Float32Array([1, 1, 0]),
    1.5,
  )

  expect(arrival).toBe(11)
  expect(photoReveal?.getLilyPortraitPhotoLastArrivalTime(
    new Float32Array([2, 3, 0.4, 1.2, 5, 4, 0.6, 1.1, 30, 10, 0.7, 0]),
    new Float32Array([1, 1, 0]),
    0.5,
  )).toBe(7)
})

it('keeps the original fully transparent through the pause and follows absolute scene time on seeks', async () => {
  const photoReveal = await import('./portraitPhotoReveal')

  expect(photoReveal.getLilyPortraitPhotoRevealProgress(10, 10)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(10.85, 10)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(12.45, 10)).toBeCloseTo(0.5)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(14.05, 10)).toBe(1)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(10, 20)).toBe(0)
})
