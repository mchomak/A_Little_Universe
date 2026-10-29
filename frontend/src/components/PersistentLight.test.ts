import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { getPrologueLightPose } from '../scenes/prologue/lightPose'
import { PersistentLight } from './PersistentLight'

it('uses deterministic film time for breathing and a stable reduced-motion source', () => {
  const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue
  const first = getPrologueLightPose(18, 20, 'waiting', settings, false)
  const next = getPrologueLightPose(18, 22, 'waiting', settings, false)
  expect(next.gain).not.toBe(first.gain)
  expect(getPrologueLightPose(18, 20, 'waiting', settings, false)).toEqual(first)
  expect(getPrologueLightPose(18, 20, 'waiting', settings, true)).toEqual(getPrologueLightPose(18, 22, 'waiting', settings, true))
})

it('exposes one native activation target only at the deliberate gate', () => {
  const waiting = renderToStaticMarkup(createElement(PersistentLight, { phase: 'prologue', interactive: true, onActivate: () => undefined }))
  const playing = renderToStaticMarkup(createElement(PersistentLight, { phase: 'prologue' }))
  expect((waiting.match(/<button/g) ?? []).length).toBe(1)
  expect(waiting).toContain('tabindex="0"')
  expect(waiting).not.toContain('disabled=""')
  expect(playing).toContain('disabled=""')
  expect(playing).toContain('tabindex="-1"')
})

it('keeps the preparation light free of cinematic dust layout children', () => {
  const ready = renderToStaticMarkup(createElement(PersistentLight, { phase: 'ready' }))
  expect(ready).not.toContain('light-arrival-dust')
})
