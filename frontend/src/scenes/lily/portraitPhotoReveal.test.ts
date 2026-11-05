import { expect, it } from 'vitest'
import { createLilyPortraitCameraBasisAtTime, placeLilyPortraitTargets } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS } from './approvedPortrait'

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
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(10.65, 10)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(13.55, 10)).toBeCloseTo(0.5)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(16.45, 10)).toBeCloseTo(1)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(10, 20)).toBe(0)
})

it('restarts the pause when replacement geometry or its texture becomes ready after the old reveal time', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  const anchor = photoReveal.getLilyPortraitPhotoRevealAnchor(31, 40)

  expect(anchor).toBe(40)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(40.64, anchor)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(40.65, anchor)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(43.55, anchor)).toBeCloseTo(0.5)
  expect(photoReveal.getLilyPortraitPhotoRequiredSceneDuration(anchor)).toBeCloseTo(51.45)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(0, anchor)).toBe(0)
})

it('keeps t28 continuous across replacement geometry, then replays from current routes without stale readiness time', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  const particles = await import('./dissolve')
  const originalAnchor = 20
  const replacementAnchor = photoReveal.getLilyPortraitPhotoRevealAnchor(12, 28)
  const stableAnchor = photoReveal.getLilyPortraitPhotoStableRevealAnchor(originalAnchor, replacementAnchor, 28)
  const completedProgress = photoReveal.getLilyPortraitPhotoRevealProgress(28, stableAnchor)

  expect(replacementAnchor).toBe(28)
  expect(stableAnchor).toBe(originalAnchor)
  expect(completedProgress).toBe(1)
  expect(particles.getLilyPortraitPhotoParticleOpacity(completedProgress, true)).toBe(0)
  expect(particles.getLilyPortraitPhotoParticleOpacity(completedProgress, false)).toBe(1)

  const beforeReveal = photoReveal.getLilyPortraitPhotoStableRevealAnchor(originalAnchor, replacementAnchor, 20.5)
  expect(beforeReveal).toBe(replacementAnchor)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(20.5, beforeReveal)).toBe(0)

  const replayAnchor = photoReveal.getLilyPortraitPhotoRevealAnchorForReplay(12)
  expect(replayAnchor).toBe(12)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(12.64, replayAnchor)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(12.65, replayAnchor)).toBe(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(12.66, replayAnchor)).toBeGreaterThan(0)
  expect(photoReveal.getLilyPortraitPhotoRevealProgress(18.45, replayAnchor)).toBeCloseTo(1)
})

it('reveals the face region before the hair and outer photo, then resolves to every original pixel', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  const progress = 0.2
  const face = photoReveal.getLilyPortraitPhotoRevealArrivalOrder(0.615, 0.645, 1)
  const hair = photoReveal.getLilyPortraitPhotoRevealArrivalOrder(0.28, 0.62, 1)
  const outerEdge = photoReveal.getLilyPortraitPhotoRevealArrivalOrder(0.98, 0.08, 1)

  expect(face).toBeLessThan(hair)
  expect(hair).toBeLessThan(outerEdge)
  expect(photoReveal.getLilyPortraitPhotoMaskAlpha(progress, face)).toBeGreaterThan(0.95)
  expect(photoReveal.getLilyPortraitPhotoMaskAlpha(progress, hair)).toBeLessThan(0.05)
  expect(photoReveal.getLilyPortraitPhotoMaskAlpha(1, outerEdge)).toBe(1)
})

it('registers photo corners to the exact approved camera plane and particle UV placement', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  const basisAtTime = createLilyPortraitCameraBasisAtTime({
    bloomSettings: { cameraTargetX: 0.27, cameraTargetY: 1.25, cameraFinalDistance: 2.3, cameraFinalHeight: 2.55 },
    identitySettings: { cameraPullback: 1.8, cameraRise: 0.65, cameraMoveDuration: 12 },
    aspect: 16 / 9,
    reducedMotion: false,
  })
  const basis = basisAtTime(12)
  const photoAspect = 1
  const targets = [photoPoint(0, 0), photoPoint(1, 0), photoPoint(0, 1), photoPoint(1, 1)]
  const expectedCorners = placeLilyPortraitTargets(targets, photoAspect, basis, APPROVED_PORTRAIT_SETTINGS)
  const plane = photoReveal.createLilyPortraitPhotoPlaneAttributes(basis, photoAspect, APPROVED_PORTRAIT_SETTINGS)
  const expectedPositions = [
    expectedCorners[0]!, expectedCorners[2]!, expectedCorners[1]!,
    expectedCorners[1]!, expectedCorners[2]!, expectedCorners[3]!,
  ].flatMap(([x, y, z]) => [x + basis.forward[0] * photoReveal.LILY_PORTRAIT_PHOTO_DEPTH_OFFSET,
    y + basis.forward[1] * photoReveal.LILY_PORTRAIT_PHOTO_DEPTH_OFFSET,
    z + basis.forward[2] * photoReveal.LILY_PORTRAIT_PHOTO_DEPTH_OFFSET])

  expect(Array.from(plane.positions)).toEqual(expectedPositions.map(Math.fround))
  expect(Array.from(plane.uvs)).toEqual([0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0])
})

it('keeps a full-photo hold in the required scene duration and uses a top-down reveal map', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  const edge = 8
  const map = photoReveal.createLilyPortraitPhotoRevealMap(edge, 1)
  const topU = (4 + 0.5) / edge, topV = 1 - 0.5 / edge
  const bottomU = topU, bottomV = 0.5 / edge

  expect(photoReveal.getLilyPortraitPhotoRequiredSceneDuration(24)).toBeCloseTo(35.45)
  expect(map[(edge - 1) * edge + 4]! / 255).toBeCloseTo(photoReveal.getLilyPortraitPhotoRevealArrivalOrder(topU, topV, 1), 2)
  expect(map[4]! / 255).toBeCloseTo(photoReveal.getLilyPortraitPhotoRevealArrivalOrder(bottomU, bottomV, 1), 2)
})

it('keeps the frame absent until photo reveal completes, then assembles over three seconds', async () => {
  const photoReveal = await import('./portraitPhotoReveal')
  expect(photoReveal.getLilyPortraitFrameAssemblyProgress(16.44, 10)).toBe(0)
  expect(photoReveal.getLilyPortraitFrameAssemblyProgress(16.45, 10)).toBe(0)
  expect(photoReveal.getLilyPortraitFrameAssemblyProgress(17.95, 10)).toBeCloseTo(0.5)
  expect(photoReveal.getLilyPortraitFrameAssemblyProgress(19.45, 10)).toBe(1)
})

function photoPoint(u: number, v: number) {
  return { u, v, tone: 0.5, contrast: 0, featureWeight: 0.5, seed: 0.5, photoColorLinear: [1, 1, 1] as const }
}
