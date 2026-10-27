import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialFilmState } from '../engine/film'
import { createFilmRuntime } from '../engine/runtime'
import { createSceneTimeline } from '../engine/useSceneTimeline'
import * as filmConfig from '../engine/filmConfig'
import { COPY } from '../engine/filmConfig'
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

it('keeps sampled particles hidden after the dissolve reaches the wait gate', () => {
  const opacityAt = Reflect.get(filmConfig, 'getPrologueParticleOpacity') as
    ((time: number, frames: ReturnType<typeof filmConfig.getPrologueFrames>, reducedMotion: boolean) => number) | undefined
  expect(opacityAt).toBeTypeOf('function')
  if (!opacityAt) return

  const frames = filmConfig.getPrologueFrames(getConfig().scenes.prologue)
  expect(opacityAt(20.9, frames, false)).toBeGreaterThan(0)
  expect(opacityAt(frames.duration, frames, false)).toBe(0)
  expect(opacityAt(frames.duration + 50, frames, false)).toBe(0)
})

it('replays reveal and dissolve frames deterministically through the shared scene runtime', () => {
  type Target = { opacity: number; clipPath?: string; filter?: string; y?: number }
  type Targets = {
    first: Target
    firstGlyphs: Target[]
    second: Target
    secondGlyphs: Target[]
    prompt: Target
  }
  type BuildTimeline = (
    targets: Targets,
    frames: ReturnType<typeof filmConfig.getPrologueFrames>,
    rhythm: number,
    reducedMotion: boolean,
  ) => ReturnType<typeof createSceneTimeline>['timeline']
  const createTimeline = Reflect.get(prologueOverlay, 'createPrologueOverlayTimeline') as unknown as BuildTimeline | undefined
  expect(createTimeline).toBeTypeOf('function')
  if (!createTimeline) return

  const targets: Targets = {
    first: { opacity: 0 }, firstGlyphs: Array.from({ length: Array.from(COPY.prologueFirst).length }, () => ({ opacity: 0 })),
    second: { opacity: 0 }, secondGlyphs: Array.from({ length: Array.from(COPY.prologueSecond).length }, () => ({ opacity: 0 })),
    prompt: { opacity: 0, y: 5 },
  }
  const frames = filmConfig.getPrologueFrames(getConfig().scenes.prologue)
  const runtime = createFilmRuntime()
  const scene = createSceneTimeline(() => createTimeline(targets, frames, 0.82, false), runtime)
  const snapshot = () => JSON.stringify([
    targets.first.opacity, ...targets.firstGlyphs.map((glyph) => glyph.opacity),
    targets.second.opacity, ...targets.secondGlyphs.map((glyph) => glyph.opacity),
    targets.prompt.opacity, targets.prompt.y,
  ])

  runtime.publish(5.5)
  const reveal = snapshot()
  runtime.publish(18)
  const dissolve = snapshot()
  expect(targets.first.opacity).toBeGreaterThan(0)
  expect(targets.second.opacity).toBeGreaterThan(0)

  runtime.publish(5.5)
  expect(snapshot()).toBe(reveal)
  runtime.publish(18)
  expect(snapshot()).toBe(dissolve)
  runtime.publish(frames.duration)
  expect([targets.first.opacity, targets.second.opacity, targets.prompt.opacity]).toEqual([0, 0, 1])
  const waitFrame = snapshot()
  scene.dispose()

  const replayTargets: Targets = {
    first: { opacity: 0 }, firstGlyphs: Array.from({ length: Array.from(COPY.prologueFirst).length }, () => ({ opacity: 0 })),
    second: { opacity: 0 }, secondGlyphs: Array.from({ length: Array.from(COPY.prologueSecond).length }, () => ({ opacity: 0 })),
    prompt: { opacity: 0, y: 5 },
  }
  runtime.publish(5.5)
  const replay = createSceneTimeline(() => createTimeline(replayTargets, frames, 0.82, false), runtime)
  const replaySnapshot = () => JSON.stringify([
    replayTargets.first.opacity, ...replayTargets.firstGlyphs.map((glyph) => glyph.opacity),
    replayTargets.second.opacity, ...replayTargets.secondGlyphs.map((glyph) => glyph.opacity),
    replayTargets.prompt.opacity, replayTargets.prompt.y,
  ])
  expect(replaySnapshot()).toBe(reveal)
  runtime.publish(18)
  expect(replaySnapshot()).toBe(dissolve)
  runtime.publish(frames.duration)
  expect([replayTargets.first.opacity, replayTargets.second.opacity, replayTargets.prompt.opacity]).toEqual([0, 0, 1])
  expect(replaySnapshot()).toBe(waitFrame)
  replay.dispose()
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
