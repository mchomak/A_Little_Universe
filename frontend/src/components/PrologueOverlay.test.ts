import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialFilmState } from '../engine/film'
import { createFilmRuntime } from '../engine/runtime'
import { createSceneTimeline } from '../engine/useSceneTimeline'
import * as filmConfig from '../engine/filmConfig'
import { getConfig, updateConfig } from '../systems/scene-config/config'
import * as prologueOverlay from './PrologueOverlay'
import { PrologueOverlay } from './PrologueOverlay'

it('scales the configured prologue font size into the responsive text rule', async () => {
  const initial = getConfig().scenes.prologue.fontSize
  await updateConfig({ scenes: { prologue: { fontSize: 24 } } })
  try {
    const markup = renderToStaticMarkup(createElement(PrologueOverlay, {
      state: initialFilmState, dispatch: () => undefined, runtime: createFilmRuntime(), reducedMotion: false,
    }))

    expect(markup).toContain('font-size:clamp(16px, 2.65vw, 24px)')
  } finally {
    await updateConfig({ scenes: { prologue: { fontSize: initial } } })
  }
})

it('keeps each narrative phrase whole and preserves Marck Script for the touch prompt', async () => {
  const markup = renderToStaticMarkup(createElement(PrologueOverlay, {
    state: initialFilmState, dispatch: () => undefined, runtime: createFilmRuntime(), reducedMotion: false,
  }))
  const prompt = markup.match(/<p class="prologue-prompt"[^>]*>/)?.[0] ?? ''

  expect(markup).not.toContain('prologue-glyph')
  expect(prompt).toContain('Marck Script')
})

it('keeps sampled particles hidden after the dissolve reaches the wait gate', () => {
  const opacityAt = Reflect.get(filmConfig, 'getPrologueParticleOpacity') as
    ((time: number, frames: ReturnType<typeof filmConfig.getPrologueFrames>, reducedMotion: boolean) => number) | undefined
  expect(opacityAt).toBeTypeOf('function')
  if (!opacityAt) return

  const frames = filmConfig.getPrologueFrames(getConfig().scenes.prologue)
  expect(opacityAt(15.5, frames, false)).toBeGreaterThan(0)
  expect(opacityAt(16, frames, false)).toBe(0)
  expect(opacityAt(frames.duration, frames, false)).toBe(0)
  expect(opacityAt(frames.duration + 50, frames, false)).toBe(0)
})

it('replays writing, a readable hold, fallback dissolve and the invitation through the shared runtime', () => {
  type Target = {
    opacity: number
    style: { setProperty: (name: string, value: string) => void; getPropertyValue: (name: string) => string }
  }
  type Targets = { first: Target; second: Target; prompt: Target }
  type BuildTimeline = (
    targets: Targets,
    frames: ReturnType<typeof filmConfig.getPrologueFrames>,
    settings: ReturnType<typeof getConfig>['scenes']['prologue'],
    reducedMotion: boolean,
  ) => ReturnType<typeof createSceneTimeline>['timeline']
  const createTimeline = Reflect.get(prologueOverlay, 'createPrologueOverlayTimeline') as unknown as BuildTimeline | undefined
  expect(createTimeline).toBeTypeOf('function')
  if (!createTimeline) return

  const makeTarget = (): Target => {
    const values = new Map<string, string>()
    return {
      opacity: 0,
      style: {
        setProperty: (name, value) => values.set(name, value),
        getPropertyValue: (name) => values.get(name) ?? '',
      },
    }
  }
  const targets: Targets = { first: makeTarget(), second: makeTarget(), prompt: makeTarget() }
  const settings = getConfig().scenes.prologue
  const frames = filmConfig.getPrologueFrames(settings)
  const runtime = createFilmRuntime()
  const scene = createSceneTimeline(() => createTimeline(targets, frames, settings, false), runtime)
  const progress = (target: Target, name: string) => Number.parseFloat(target.style.getPropertyValue(name))
  const snapshot = () => JSON.stringify([
    targets.first.opacity, progress(targets.first, '--write-progress'), progress(targets.first, '--fracture-progress'), targets.first.style.getPropertyValue('--fracture-clip'),
    targets.second.opacity, progress(targets.second, '--write-progress'), progress(targets.second, '--fracture-progress'), targets.second.style.getPropertyValue('--fracture-clip'),
    targets.prompt.opacity, progress(targets.prompt, '--write-progress'),
  ])

  runtime.publish(4)
  const reveal = snapshot()
  expect(progress(targets.first, '--write-progress')).toBeGreaterThan(0)
  expect(progress(targets.first, '--write-progress')).toBeLessThan(104)
  expect(targets.second.opacity).toBe(0)

  runtime.publish(12)
  const hold = snapshot()
  expect(progress(targets.first, '--write-progress')).toBe(104)
  expect(progress(targets.second, '--write-progress')).toBe(104)
  expect(targets.first.opacity).toBe(1)
  expect(targets.second.opacity).toBe(1)

  runtime.publish(frames.firstDissolve[0] + (frames.firstDissolve[1] - frames.firstDissolve[0]) * 0.5)
  const dissolve = snapshot()
  expect(progress(targets.first, '--fracture-progress')).toBeCloseTo(50, 0)
  expect(progress(targets.second, '--fracture-progress')).toBeCloseTo(0, 0)
  expect(targets.first.style.getPropertyValue('--fracture-clip')).toBe('none')
  expect(targets.first.opacity).toBeCloseTo(0.5)
  runtime.publish(12)
  expect(snapshot()).toBe(hold)
  runtime.publish(frames.firstDissolve[0] + (frames.firstDissolve[1] - frames.firstDissolve[0]) * 0.5)
  expect(snapshot()).toBe(dissolve)

  runtime.publish(16.325)
  const promptWriting = snapshot()
  expect(progress(targets.prompt, '--write-progress')).toBeGreaterThan(0)
  expect(progress(targets.prompt, '--write-progress')).toBeLessThan(104)
  runtime.publish(frames.duration)
  const gate = snapshot()
  expect([targets.first.opacity, targets.second.opacity, targets.prompt.opacity]).toEqual([0, 0, 1])
  expect(progress(targets.prompt, '--write-progress')).toBe(104)
  scene.dispose()

  const replayTargets: Targets = { first: makeTarget(), second: makeTarget(), prompt: makeTarget() }
  runtime.publish(4)
  const replay = createSceneTimeline(() => createTimeline(replayTargets, frames, settings, false), runtime)
  const replaySnapshot = () => JSON.stringify([
    replayTargets.first.opacity, progress(replayTargets.first, '--write-progress'), progress(replayTargets.first, '--fracture-progress'), replayTargets.first.style.getPropertyValue('--fracture-clip'),
    replayTargets.second.opacity, progress(replayTargets.second, '--write-progress'), progress(replayTargets.second, '--fracture-progress'), replayTargets.second.style.getPropertyValue('--fracture-clip'),
    replayTargets.prompt.opacity, progress(replayTargets.prompt, '--write-progress'),
  ])
  expect(replaySnapshot()).toBe(reveal)
  runtime.publish(12)
  expect(replaySnapshot()).toBe(hold)
  runtime.publish(frames.firstDissolve[0] + (frames.firstDissolve[1] - frames.firstDissolve[0]) * 0.5)
  expect(replaySnapshot()).toBe(dissolve)
  runtime.publish(16.325)
  expect(replaySnapshot()).toBe(promptWriting)
  runtime.publish(frames.duration)
  expect(replaySnapshot()).toBe(gate)
  runtime.publish(16.325)
  expect(replaySnapshot()).toBe(promptWriting)
  replay.dispose()
})

it('keeps reduced-motion text static while preserving the touch gate timing', () => {
  type Target = {
    opacity: number
    style: { setProperty: (name: string, value: string) => void; getPropertyValue: (name: string) => string }
  }
  type Targets = { first: Target; second: Target; prompt: Target }
  type BuildTimeline = (
    targets: Targets,
    frames: ReturnType<typeof filmConfig.getPrologueFrames>,
    settings: ReturnType<typeof getConfig>['scenes']['prologue'],
    reducedMotion: boolean,
  ) => ReturnType<typeof createSceneTimeline>['timeline']
  const createTimeline = Reflect.get(prologueOverlay, 'createPrologueOverlayTimeline') as unknown as BuildTimeline | undefined
  expect(createTimeline).toBeTypeOf('function')
  if (!createTimeline) return

  const makeTarget = (): Target => {
    const values = new Map<string, string>()
    return { opacity: 0, style: { setProperty: (name, value) => values.set(name, value), getPropertyValue: (name) => values.get(name) ?? '' } }
  }
  const targets: Targets = { first: makeTarget(), second: makeTarget(), prompt: makeTarget() }
  const settings = getConfig().scenes.prologue
  const frames = filmConfig.getPrologueFrames(settings)
  const runtime = createFilmRuntime()
  const scene = createSceneTimeline(() => createTimeline(targets, frames, settings, true), runtime)

  runtime.publish(frames.first[0])
  expect([targets.first.opacity, targets.first.style.getPropertyValue('--write-progress')]).toEqual([1, '104%'])
  runtime.publish(frames.second[0])
  expect([targets.second.opacity, targets.second.style.getPropertyValue('--write-progress')]).toEqual([1, '104%'])
  runtime.publish(frames.firstDissolve[0] + 0.7)
  expect([targets.first.opacity, targets.second.opacity]).toEqual([0, 1])
  runtime.publish(frames.secondDissolve[0] + 0.7)
  expect([targets.first.opacity, targets.second.opacity]).toEqual([0, 0])
  runtime.publish(frames.dissolve[1] - 0.01)
  expect(targets.prompt.opacity).toBe(0)
  runtime.publish(frames.prompt)
  expect([targets.prompt.opacity, targets.prompt.style.getPropertyValue('--write-progress')]).toEqual([1, '104%'])
  scene.dispose()
})

it.each([
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
])('keeps both prologue blocks clear of the centered light at $width×$height', ({ width, height }) => {
  type Input = {
    viewport: { width: number; height: number }
    lightBounds: { top: number; bottom: number }
    firstHeight: number
    secondHeight: number
    firstPositionY: number
    gap: number
  }
  type Layout = (input: Input) => { firstTop: number; secondTop: number }
  const getLayout = Reflect.get(prologueOverlay, 'layoutPrologueCopyBlocks') as unknown as Layout | undefined
  expect(getLayout).toBeTypeOf('function')
  if (!getLayout) return

  const light = { top: (height - 64) / 2, bottom: (height + 64) / 2 }
  const layout = getLayout({
    viewport: { width, height }, lightBounds: light,
    firstHeight: 72, secondHeight: 168, firstPositionY: 40, gap: 24,
  })

  expect(layout.firstTop + 72).toBeLessThanOrEqual(light.top - 24)
  expect(layout.secondTop).toBeGreaterThanOrEqual(light.bottom + 24)
})
