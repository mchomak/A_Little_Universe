import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { createFilmRuntime } from '../engine/runtime'
import { initialFilmState } from '../engine/film'
import { SceneOverlay } from './SceneOverlay'

it('shows no touch invitation or waiting text during automatic lily bloom', () => {
  const html = renderToStaticMarkup(createElement(SceneOverlay, {
    state: { ...initialFilmState, scene: 'bloom', mode: 'playing' },
    dispatch: () => undefined,
    runtime: createFilmRuntime(),
    reducedMotion: false,
  }))

  expect(html).not.toContain('Некоторые вещи')
  expect(html).not.toContain('становятся красивее')
  expect(html).not.toContain('прикасаешься')
  expect(html).not.toContain('Проведи пальцем по цветку')
  expect(html).not.toContain('bloom-overlay')
})
