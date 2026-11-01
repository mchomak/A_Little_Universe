import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { createFilmRuntime } from '../engine/runtime'
import { initialFilmState } from '../engine/film'
import { getConfig } from '../systems/scene-config/config'
import { BLOOM_COPY, BloomOverlay } from './BloomOverlay'
import { SceneOverlay } from './SceneOverlay'

it('keeps the four requested lines in the prologue calligraphy font without a button', () => {
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const }
  const html = renderToStaticMarkup(createElement(BloomOverlay, {
    state, dispatch: () => undefined, runtime: createFilmRuntime(), reducedMotion: false,
  }))

  expect(BLOOM_COPY).toEqual([
    'Некоторые вещи',
    'становятся красивее,',
    'когда к ним прикасаешься',
    'Проведи пальцем по цветку',
  ])
  expect(html.match(/<span data-bloom-line="">/g)).toHaveLength(4)
  expect(html).toContain(`font-family:&quot;${getConfig().scenes.prologue.fontFamily === 'great-vibes' ? 'Great Vibes' : 'Marck Script'}&quot;`)
  expect(html).not.toContain('<button')
  expect(html).not.toContain('flowerPrompt')
})

it('routes the bloom scene to the calligraphic invitation instead of the generic button', () => {
  const state = { ...initialFilmState, scene: 'bloom' as const, mode: 'waiting' as const }
  const html = renderToStaticMarkup(createElement(SceneOverlay, {
    state, dispatch: () => undefined, runtime: createFilmRuntime(), reducedMotion: false,
  }))
  expect(html).toContain('Некоторые вещи')
  expect(html).not.toContain('data-testid="interact"')
  expect(html).not.toContain('<button')
})
