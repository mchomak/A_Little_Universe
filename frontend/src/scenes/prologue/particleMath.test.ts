import { expect, it } from 'vitest'
import { gsap } from 'gsap'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { createFilmRuntime } from '../../engine/runtime'
import {
  getFractureFront,
  getParticleBirthTime,
  getParticleFadeStart,
  getParticleSceneOpacity,
  groupGlyphFragmentsByLine,
  getPrologueParticleVertexCount,
  resolvePrologueParticleCount,
} from './particleMath'

it('uses travel duration for the full lifetime and fade duration for its own fade window', () => {
  expect(getParticleFadeStart(4, 2.4)).toBeCloseTo(1.6, 5)
  expect(getParticleFadeStart(4, 1)).toBe(3)
  expect(getParticleFadeStart(4, 6)).toBe(0)
})

it('fades the particle field smoothly to zero at the fixed scene gate', () => {
  expect(getParticleSceneOpacity(18.5, 16, 21, 2.4, false)).toBe(1)
  expect(getParticleSceneOpacity(19.8, 16, 21, 2.4, false)).toBeCloseTo(0.5, 5)
  expect(getParticleSceneOpacity(21, 16, 21, 2.4, false)).toBe(0)
  expect(getParticleSceneOpacity(19.8, 16, 21, 2.4, true)).toBe(0)
})

it('starts an unfractured edge particle at its x position in the dissolve window', () => {
  const birthTime = getParticleBirthTime({
    xNormalized: 0.25,
    yNormalized: 0.5,
    fractureWidth: 0,
    dissolveStart: 16,
    fractureDuration: 2.6,
    seed: 1420577,
  })

  expect(birthTime).toBeCloseTo(16.65, 5)
})

it('places the first and last pixels at the exact ends of the fracture interval', () => {
  const input = {
    xNormalized: 0,
    yNormalized: 0.5,
    fractureWidth: 0.18,
    dissolveStart: 16,
    fractureDuration: 2.6,
    seed: 1420577,
  }

  expect(getParticleBirthTime(input)).toBe(16)
  expect(getParticleBirthTime({ ...input, xNormalized: 1 })).toBeCloseTo(18.6, 5)
})

it('keeps the noisy fracture front anchored at the edges and varied by height', () => {
  expect(getFractureFront(0, 0.25, 0.18, 31)).toBe(0)
  expect(getFractureFront(1, 0.75, 0.18, 31)).toBe(1)
  expect(getFractureFront(0.5, 0.1, 0.08, 31)).not.toBe(getFractureFront(0.5, 0.9, 0.08, 31))
})

it('births a pixel when its seeded noisy front first reaches it', () => {
  const input = {
    xNormalized: 0.63,
    yNormalized: 0.12,
    fractureWidth: 0.08,
    dissolveStart: 16,
    fractureDuration: 2.6,
    seed: 91,
  }
  const birth = getParticleBirthTime(input)
  const progress = (birth - input.dissolveStart) / input.fractureDuration

  expect(getFractureFront(progress, input.yNormalized, input.fractureWidth, input.seed)).toBeGreaterThanOrEqual(input.xNormalized)
  expect(getFractureFront(progress - 0.0001, input.yNormalized, input.fractureWidth, input.seed)).toBeLessThan(input.xNormalized)
  expect(getParticleBirthTime(input)).toBe(birth)
})

it('maps wrapped glyph fragments to each visual line origin', () => {
  const lines = groupGlyphFragmentsByLine(
    [
      { text: 'f', left: 20, top: 104, right: 26, bottom: 116 },
      { text: 'i', left: 27, top: 104, right: 30, bottom: 116 },
      { text: 'r', left: 31, top: 104, right: 37, bottom: 116 },
      { text: 's', left: 38, top: 104, right: 44, bottom: 116 },
      { text: 't', left: 45, top: 104, right: 50, bottom: 116 },
      { text: ' ', left: 51, top: 104, right: 55, bottom: 116 },
      { text: 's', left: 35, top: 130, right: 41, bottom: 142 },
      { text: 'e', left: 42, top: 130, right: 48, bottom: 142 },
      { text: 'c', left: 49, top: 130, right: 55, bottom: 142 },
      { text: 'o', left: 56, top: 130, right: 62, bottom: 142 },
      { text: 'n', left: 63, top: 130, right: 69, bottom: 142 },
      { text: 'd', left: 70, top: 130, right: 76, bottom: 142 },
    ],
    [
      { left: 20, top: 100, right: 100, bottom: 124 },
      { left: 35, top: 126, right: 100, bottom: 150 },
    ],
  )

  expect(lines).toEqual([
    { text: 'first ', left: 20, top: 100 },
    { text: 'second', left: 35, top: 126 },
  ])
})

it('reduces the bounded point count for low quality, high DPR, and compact screens', () => {
  const standard = resolvePrologueParticleCount(1800, 'standard', 1, false)

  expect(standard).toBe(1800)
  expect(resolvePrologueParticleCount(1800, 'low', 1, false)).toBeLessThanOrEqual(900)
  expect(resolvePrologueParticleCount(1800, 'standard', 2, false)).toBeLessThan(standard)
  expect(resolvePrologueParticleCount(1800, 'standard', 1, true)).toBeLessThan(standard)
  expect(resolvePrologueParticleCount(9000, 'standard', 1, false)).toBe(6000)
  expect(resolvePrologueParticleCount(-1, 'standard', 1, false)).toBe(0)
})

it('keeps point geometry counts safe when fewer than four particles are requested', () => {
  for (const count of [0, 1, 2, 3]) {
    const adapted = resolvePrologueParticleCount(count, 'standard', 1, false)
    expect(adapted).toBe(count)
    expect(getPrologueParticleVertexCount(adapted)).toBe(0)
  }
})

it('reproduces the same particle age when the shared runtime seeks back and forward', () => {
  const runtime = createFilmRuntime()
  const cursor = { time: 0 }
  const scene = createSceneTimeline(
    () => gsap.timeline().to(cursor, { time: 21, duration: 21, ease: 'none' }),
    runtime,
  )
  const birth = getParticleBirthTime({
    xNormalized: 0.5,
    yNormalized: 0.5,
    fractureWidth: 0,
    dissolveStart: 16,
    fractureDuration: 2.6,
    seed: 1420577,
  })

  runtime.publish(18)
  const ageAt18 = cursor.time - birth
  runtime.publish(17)
  expect(cursor.time - birth).toBeLessThan(0)
  runtime.publish(18)
  expect(cursor.time - birth).toBe(ageAt18)
  expect(ageAt18).toBeCloseTo(0.7, 4)
  scene.dispose()
})
