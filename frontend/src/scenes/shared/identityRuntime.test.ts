import { gsap } from 'gsap'
import { expect, it } from 'vitest'
import { initialFilmState } from '../../engine/film'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { identityFrame } from './identityFrame'
import { nameAssembly, nameWave } from './identityName'
import { getPortraitStageReveal } from '../lily/portraitTargets'
import { createLilyDissolveUniforms, createLilyParticleMaterial, updateLilyPortraitSettings } from '../lily/dissolve'

it('scrubs identity frames on the shared clock, holds pause, changes speed and replays cleanly', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, elapsed: 0, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  let frame = identityFrame(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  clock.timeline.time(23)
  expect(frame.photo).toBeCloseTo(.35)
  expect(frame.ascii).toBe(1)
  clock.timeline.time(26)
  expect(frame.photo).toBeCloseTo(.74)
  expect(clock.timeline.paused()).toBe(true)
  clock.sync({ ...state, speed: 2 })
  expect(clock.timeline.timeScale()).toBe(2)
  expect(frame.photo).toBeCloseTo(.74)
  clock.timeline.time(4)
  expect(frame).toEqual(identityFrame(4))
  scene.dispose()
  clock.dispose()
  const replayClock = createFilmClock({ state: { ...state, revision: 3 }, runtime, dispatch: () => {} })
  const replay = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  replayClock.timeline.time(34)
  expect(frame).toEqual(identityFrame(34))
  replay.dispose()
  replayClock.dispose()
})

it('rebuilds the paused identity clock after seek and restart without retaining the previous frame', async () => {
  const { filmReducer } = await import('../../engine/film')
  const runtime = createFilmRuntime()
  let state = { ...filmReducer(initialFilmState, { type: 'dev-jump', scene: 'identity' }, true), paused: true }
  let clock = createFilmClock({ state, runtime, dispatch: () => {} })
  let frame = identityFrame(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  for (const time of [25, 10]) {
    state = filmReducer(state, { type: 'dev-seek', time }, true)
    clock.dispose()
    clock = createFilmClock({ state, runtime, dispatch: () => {} })
    expect(clock.timeline.paused()).toBe(true)
    expect(runtime.time).toBe(time)
    expect(frame).toEqual(identityFrame(time))
  }
  state = filmReducer(state, { type: 'dev-restart' }, true)
  clock.dispose()
  clock = createFilmClock({ state: { ...state, paused: true }, runtime, dispatch: () => {} })
  expect(runtime.time).toBe(0)
  expect(frame).toEqual(identityFrame(0))
  scene.dispose()
  clock.dispose()
})

it('seeks name assembly and its single wave backwards without retaining motion history', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  const sample = (time: number) => ({
    streams: [0, 1, 2].map((stream) => nameAssembly(time, stream, .5)),
    wave: nameWave(time, 1),
  })
  let frame = sample(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = sample(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  for (const time of [7.9, 8, 8.6, 9.4, 10.2, 12.9, 13, 17, 8.6, 10.2, 7.9]) {
    clock.timeline.time(time)
    expect(frame).toEqual(sample(time))
    expect(clock.timeline.paused()).toBe(true)
  }
  scene.dispose()
  clock.dispose()
})

it('replays the portrait stages from absolute identity time after backward and forward seeks', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  const uniforms = createLilyDissolveUniforms()
  const material = createLilyParticleMaterial(uniforms)
  const settings = { portraitStart: 12, portraitDuration: 8.5, portraitBrightness: 1.5, portraitSize: 1.2 }
  const sample = (time: number) => [0, 1, 2, 3].map((stage) => getPortraitStageReveal(time, 12, 8.5, stage))
  let portraitStages = sample(runtime.time)
  const unsubscribe = runtime.subscribeFrame((time) => {
    portraitStages = sample(time)
    updateLilyPortraitSettings(uniforms, time, settings)
  })
  const samplesByTime = new Map<number, number[]>()

  // These literals independently pin the GLSL reveal schedule; do not derive
  // the expectations from the CPU helper that mirrors it.
  expect(material.vertexShader).toMatch(/float stageOffset = stage < 0\.5 \? 0\.0 : stage < 1\.5 \? 0\.24\s+: stage < 2\.5 \? 0\.5 : 0\.74;/)
  expect(material.vertexShader).toContain('stageStart + uLilyPortraitDuration * 0.28;')
  expect(material.vertexShader).toContain('float stageStart = uLilyPortraitStart + stageOffset * uLilyPortraitDuration + travelDuration * 0.2;')
  expect(material.vertexShader).toContain('portraitReveal = smoothstep(stageStart, max(stageStart + 0.001, stageEnd), uLilySceneTime);')

  for (const time of [12, 14.4, 18.6, 20.5, 12, 20.5]) {
    clock.timeline.time(time)
    expect(runtime.time).toBe(time)
    expect(uniforms.uLilySceneTime.value).toBe(time)
    const prior = samplesByTime.get(time)
    if (prior) expect(portraitStages).toEqual(prior)
    else samplesByTime.set(time, portraitStages.slice())
    if (time === 14.4) {
      expect(portraitStages[0]).toBeGreaterThan(0.96)
      expect(portraitStages[0]).toBeLessThan(1)
      expect(portraitStages[1]).toBeGreaterThan(0)
      expect(portraitStages[1]).toBeLessThan(0.01)
      expect(portraitStages.slice(2)).toEqual([0, 0])
    }
    if (time === 18.6) {
      expect(portraitStages.slice(0, 2)).toEqual([1, 1])
      expect(portraitStages[2]).toBeGreaterThan(0.9)
      expect(portraitStages[3]).toBeGreaterThan(0)
      expect(portraitStages[3]).toBeLessThan(0.01)
    }
    if (time === 20.5) expect(portraitStages).toEqual([1, 1, 1, 1])
  }
  unsubscribe()
  material.dispose()
  clock.dispose()
})
