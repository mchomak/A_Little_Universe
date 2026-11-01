import { expect, it } from 'vitest'
import { createPortraitCameraBasis, getPortraitHermitePosition, getPortraitStageReveal, placePortraitTargets, projectPortraitPoint, samplePortraitTargets, selectPortraitCandidates, type PortraitPixelSource } from './portraitTargets'
import { portraitFixtureHeight, portraitFixtureWidth, portraitMatteLumaBase64, portraitPhotoLumaBase64 } from './portraitTargets.source-fixture'

function makePortraitPixels(): PortraitPixelSource {
  const width = 10, height = 10
  const photoRgba = new Uint8ClampedArray(width * height * 4)
  const matteRgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    const tone = 24 + x * 23 + y * 11
    photoRgba.set([tone, tone, tone, 255], offset)
    const foreground = x >= 1 && x <= 8 && y >= 1 && y <= 8
    matteRgba.set(foreground ? [255, 255, 255, 255] : [0, 0, 0, 255], offset)
  }
  return { photoRgba, matteRgba, width, height }
}

function makeShippedPortraitPixels(): PortraitPixelSource {
  const decode = (base64: string) => Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  const toRgba = (luma: Uint8Array) => {
    const rgba = new Uint8ClampedArray(luma.length * 4)
    for (let index = 0; index < luma.length; index++) {
      const offset = index * 4
      rgba[offset] = luma[index]!
      rgba[offset + 1] = luma[index]!
      rgba[offset + 2] = luma[index]!
      rgba[offset + 3] = 255
    }
    return rgba
  }
  return {
    width: portraitFixtureWidth,
    height: portraitFixtureHeight,
    photoRgba: toRgba(decode(portraitPhotoLumaBase64)),
    matteRgba: toRgba(decode(portraitMatteLumaBase64)),
  }
}

it('samples deterministic, masked portrait points with source-derived tones and staged regions', () => {
  const source = makePortraitPixels()
  const first = samplePortraitTargets(source, 240, 1)
  const replay = samplePortraitTargets(source, 240, 1)

  expect(first).toEqual(replay)
  expect(first).toHaveLength(240)
  expect(new Set(first.map((target) => target.stage))).toEqual(new Set([0, 2, 3]))
  expect(Math.min(...first.map((target) => target.tone))).toBeLessThan(Math.max(...first.map((target) => target.tone)))
  for (const { uv, stage, tone, contrast, seed } of first) {
    expect(uv[0]).toBeGreaterThanOrEqual(0)
    expect(uv[0]).toBeLessThan(1)
    expect(uv[1]).toBeGreaterThanOrEqual(0)
    expect(uv[1]).toBeLessThan(1)
    expect(stage).toBeGreaterThanOrEqual(0)
    expect(stage).toBeLessThanOrEqual(3)
    expect(tone).toBeGreaterThanOrEqual(0)
    expect(tone).toBeLessThanOrEqual(1)
    expect(contrast).toBeGreaterThanOrEqual(0)
    expect(contrast).toBeLessThanOrEqual(1)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(1)
    const x = Math.floor(uv[0] * source.width), y = Math.floor(uv[1] * source.height)
    expect(source.matteRgba[(y * source.width + x) * 4]).toBe(255)
  }
})

it('orders the shipped portrait from head contour to photo features, then remaining silhouette and detail', () => {
  const source = makeShippedPortraitPixels()
  const first = samplePortraitTargets(source, 640, 1)
  const replay = samplePortraitTargets(source, 640, 1)
  const byStage = [0, 1, 2, 3].map((stage) => first.filter((target) => target.stage === stage))
  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]!
  const maskAt = (x: number, y: number) => source.matteRgba[(y * source.width + x) * 4]! / 255
  const edgeAt = (x: number, y: number) => Math.max(
    Math.abs(maskAt(x, y) - maskAt(Math.max(0, x - 1), y)),
    Math.abs(maskAt(x, y) - maskAt(Math.min(source.width - 1, x + 1), y)),
    Math.abs(maskAt(x, y) - maskAt(x, Math.max(0, y - 1))),
    Math.abs(maskAt(x, y) - maskAt(x, Math.min(source.height - 1, y + 1))),
  )
  const pointsIn = (targets: typeof first, [u0, v0, u1, v1]: [number, number, number, number]) => targets.filter(({ uv }) =>
    uv[0] >= u0 && uv[0] <= u1 && uv[1] >= v0 && uv[1] <= v1)
  const pointContrast = ({ uv }: typeof first[number]) => {
    const x = Math.min(source.width - 1, Math.floor(uv[0] * source.width))
    const y = Math.min(source.height - 1, Math.floor(uv[1] * source.height))
    const toneAt = (px: number, py: number) => source.photoRgba[(py * source.width + px) * 4]! / 255
    return (Math.abs(toneAt(x, y) - toneAt(Math.max(0, x - 1), y))
      + Math.abs(toneAt(x, y) - toneAt(Math.min(source.width - 1, x + 1), y))
      + Math.abs(toneAt(x, y) - toneAt(x, Math.max(0, y - 1)))
      + Math.abs(toneAt(x, y) - toneAt(x, Math.min(source.height - 1, y + 1)))) / 4
  }

  expect(first).toEqual(replay)
  expect(first).toHaveLength(640)
  expect(new Set(first.map((target) => target.stage))).toEqual(new Set([0, 1, 2, 3]))
  expect(byStage[1]).toHaveLength(Math.floor(first.length * 0.3))
  for (const target of first) {
    const x = Math.min(source.width - 1, Math.floor(target.uv[0] * source.width))
    const y = Math.min(source.height - 1, Math.floor(target.uv[1] * source.height))
    expect(maskAt(x, y)).toBeGreaterThanOrEqual(0.16)
  }
  const headOutline = pointsIn(byStage[0]!, [0.28, 0.08, 0.86, 0.7])
  const raisedArm = [0.06, 0.06, 0.32, 0.6] as [number, number, number, number]
  const armInOutline = pointsIn(byStage[0]!, raisedArm).length / byStage[0]!.length
  const headEdgeFraction = headOutline.filter(({ uv }) => edgeAt(
    Math.min(source.width - 1, Math.floor(uv[0] * source.width)),
    Math.min(source.height - 1, Math.floor(uv[1] * source.height)),
  ) >= 0.2).length / headOutline.length
  const faceTargets = byStage[1]!
  const eye = [0.6, 0.29, 0.79, 0.41] as [number, number, number, number]
  const nose = [0.61, 0.39, 0.77, 0.5] as [number, number, number, number]
  const mouth = [0.6, 0.48, 0.76, 0.58] as [number, number, number, number]
  const stageTwo = byStage[2]!
  const hair = [0.28, 0.32, 0.56, 0.78] as [number, number, number, number]
  const shoulders = [0.76, 0.62, 0.99, 0.9] as [number, number, number, number]
  const remainingPhoto = [0.35, 0.7, 0.98, 0.99] as [number, number, number, number]

  expect(headEdgeFraction).toBeGreaterThan(0.12)
  expect(armInOutline).toBeLessThan(0.18)
  expect(median(headOutline.map(({ uv }) => uv[1]))).toBeLessThan(median(faceTargets.map(({ uv }) => uv[1])))
  expect(pointsIn(faceTargets, eye).length).toBeGreaterThan(0)
  expect(pointsIn(faceTargets, nose).length).toBeGreaterThan(0)
  expect(pointsIn(faceTargets, mouth).length).toBeGreaterThan(0)
  expect(median(faceTargets.map(pointContrast))).toBeGreaterThan(median(stageTwo.map(pointContrast)))
  expect(median(faceTargets.map((target) => target.contrast ?? 0))).toBeGreaterThan(0.5)
  expect(pointsIn(stageTwo, hair).length).toBeGreaterThan(0)
  expect(pointsIn(stageTwo, shoulders).length).toBeGreaterThan(0)
  expect(pointsIn(stageTwo, raisedArm).length).toBeGreaterThan(0)
  expect(pointsIn(byStage[3]!, remainingPhoto).length).toBeGreaterThan(0)
  expect(new Set(first.map(({ tone }) => Math.round(tone * 20))).size).toBeGreaterThan(5)
})

it('allocates photo-derived high-contrast samples across the eyes, nose, and mouth', () => {
  const source = makeShippedPortraitPixels()
  const faceTargets = samplePortraitTargets(source, 960, 1.5).filter(({ stage }) => stage === 1)
  const pointContrast = ({ uv }: typeof faceTargets[number]) => {
    const x = Math.min(source.width - 1, Math.floor(uv[0] * source.width))
    const y = Math.min(source.height - 1, Math.floor(uv[1] * source.height))
    const toneAt = (px: number, py: number) => source.photoRgba[(py * source.width + px) * 4]! / 255
    return (Math.abs(toneAt(x, y) - toneAt(Math.max(0, x - 1), y))
      + Math.abs(toneAt(x, y) - toneAt(Math.min(source.width - 1, x + 1), y))
      + Math.abs(toneAt(x, y) - toneAt(x, Math.max(0, y - 1)))
      + Math.abs(toneAt(x, y) - toneAt(x, Math.min(source.height - 1, y + 1)))) / 4
  }
  const featureRegions = [
    [0.6, 0.29, 0.79, 0.41],
    [0.61, 0.39, 0.77, 0.5],
    [0.6, 0.48, 0.76, 0.58],
  ] as const
  const highContrastCounts = featureRegions.map(([u0, v0, u1, v1]) => faceTargets.filter(({ uv }) =>
    uv[0] >= u0 && uv[0] <= u1 && uv[1] >= v0 && uv[1] <= v1).filter((target) => pointContrast(target) >= 0.12).length)

  expect(highContrastCounts[0]).toBeGreaterThanOrEqual(20)
  expect(highContrastCounts[1]).toBeGreaterThanOrEqual(20)
  expect(highContrastCounts[2]).toBeGreaterThanOrEqual(15)
})

it('routes at least 70 percent from the near, right-to-left projected stream when enough candidates exist', () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    index,
    screenDeltaX: index < 6 ? -0.02 - index * 0.001 : 0.01 + index * 0.001,
    depth: index + 1,
  }))

  const selected = selectPortraitCandidates(candidates, 5)
  const replay = selectPortraitCandidates(candidates, 5)

  expect(selected).toEqual(replay)
  expect(selected).toHaveLength(5)
  expect(selected.filter((index) => index < 5).length).toBeGreaterThanOrEqual(4)
})

it('moves smoothly from the sampled vortex position and settles at a fixed target', () => {
  const start: [number, number, number] = [0, 0, 0]
  const velocity: [number, number, number] = [1, 0, 0]
  const target: [number, number, number] = [2, 1, -1]

  expect(getPortraitHermitePosition(start, velocity, target, 0, 2)).toEqual(start)
  expect(getPortraitHermitePosition(start, velocity, target, 0.5, 2)).toEqual([0.59375, 0.15625, -0.15625])
  expect(getPortraitHermitePosition(start, velocity, target, 2, 2)).toEqual(target)
  expect(getPortraitHermitePosition(start, velocity, target, 4, 2)).toEqual(target)
})

it('reveals overlapping portrait stages from absolute scene time and replays the same frame', () => {
  const firstStageWhileSecondStarts = getPortraitStageReveal(14.4, 12, 8.5, 0)
  const secondStageStarts = getPortraitStageReveal(14.4, 12, 8.5, 1)

  expect(firstStageWhileSecondStarts).toBeGreaterThan(0)
  expect(firstStageWhileSecondStarts).toBeLessThan(1)
  expect(secondStageStarts).toBeGreaterThan(0)
  expect(getPortraitStageReveal(20.5, 12, 8.5, 3)).toBe(1)
  expect(getPortraitStageReveal(14.4, 12, 8.5, 0)).toBe(firstStageWhileSecondStarts)
})

it('fits the square portrait to the camera frame and limits offsets by remaining space', () => {
  const basis = createPortraitCameraBasis({ eye: [0, 0, 6], lookAt: [0, 0, 0], aspect: 4 / 3, fovDegrees: 38, planeDistance: 3.4 })
  const corners = placePortraitTargets([
    { uv: [0, 0], stage: 0, tone: 0.5, seed: 0 },
    { uv: [1, 1], stage: 3, tone: 0.5, seed: 0 },
  ], 1, basis, 1.25, 1, -1)

  for (const point of corners) {
    const projected = projectPortraitPoint(point, basis)
    expect(Math.abs(projected.x)).toBeLessThanOrEqual(1.001)
    expect(Math.abs(projected.y)).toBeLessThanOrEqual(1.001)
  }
})
