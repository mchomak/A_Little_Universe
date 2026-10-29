import { describe, expect, it } from 'vitest'
import { gsap } from 'gsap'
import { initialFilmState } from '../../engine/film'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { portraitCell, portraitSample, portraitReveal } from './identityMorph'

describe('04.4 portrait delivery', () => {
  it('delivers photographic highlights and contrast before flat dark background', () => {
    const detail = portraitCell(.8, .45, 32, 51)
    const background = portraitCell(.03, 0, 32, 51)
    const wall = portraitCell(.95, 0, 32, 51)
    expect(detail[0]).toBeLessThan(background[0])
    expect(detail[2]).toBeLessThan(background[2])
    expect(detail[2]).toBeLessThan(wall[2])
    expect(portraitReveal(15.5, detail)).toBeGreaterThan(portraitReveal(15.5, background))
  })

  it('staggers arrivals but completes inside 04.4, without affecting adjacent shots', () => {
    const deliveries = new Set<number>()
    for (let y = 0; y < 112; y++) for (let x = 0; x < 112; x++) {
      const cell = portraitCell((x % 7) / 6, (y % 5) / 4, x, y)
      expect(13 + cell[0] + cell[1]).toBeLessThan(17)
      expect(cell[2]).toBeGreaterThan(13 + cell[0] + cell[1] * .6)
      expect(portraitReveal(13, cell)).toBe(0)
      expect(portraitReveal(17, cell)).toBe(1)
      deliveries.add(cell[2])
    }
    expect(deliveries.size).toBeGreaterThan(10000)
  })

  it('derives structure from the unchanged source image with clamped border sampling', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255,
      0, 0, 0, 255, 255, 255, 255, 255,
    ])
    expect(portraitSample(pixels, 2, 2, 0, 0)[0]).toBe(0)
    expect(portraitSample(pixels, 2, 2, 0, 0)[1]).toBeCloseTo(1)
    expect(portraitSample(pixels, 2, 2, 1, 1)[0]).toBeCloseTo(1)
    expect(Array.from(pixels)).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('reconstructs identical cell delivery on reverse seek and replay', () => {
    const cell = portraitCell(.4, .2, 58, 30)
    const runtime = createFilmRuntime()
    const clock = createFilmClock({ state: { ...initialFilmState, scene: 'identity', mode: 'playing', paused: true }, runtime, dispatch: () => {} })
    const cursor = { time: 0 }
    let opacity = 0
    const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { opacity = portraitReveal(cursor.time, cell) } })
      .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
    try {
      for (const time of [13, 14, 15.5, 16.5, 17, 16.5, 15.5, 13, 0, 15.5]) {
        clock.timeline.time(time)
        expect(opacity).toBeCloseTo(portraitReveal(time, cell), 8)
        expect(clock.timeline.paused()).toBe(true)
      }
    } finally {
      scene.dispose()
      clock.dispose()
    }
  })
})
