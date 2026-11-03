import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { AssetManager } from '../systems/assets/AssetManager'
import { getConfig, updateConfig } from '../systems/scene-config/config'
import { Preloader } from './Preloader'

it('reflects the active preload glow setting in its rendered canvas', async () => {
  const previous = getConfig().scenes.preload
  await updateConfig({ scenes: { preload: { glow: 1.6 } } })
  const markup = renderToStaticMarkup(createElement(Preloader, {
    manager: {} as AssetManager,
    onReady: () => undefined,
  }))
  await updateConfig({ scenes: { preload: previous } })

  expect(markup).toContain('--preload-glow:1.6')
})

it('keeps the shared phone image behind the loading content', () => {
  const markup = renderToStaticMarkup(createElement(Preloader, {
    manager: {} as AssetManager,
    onReady: () => undefined,
  }))

  expect(markup).toContain('class="phone-background"')
  expect(markup).toContain('aria-hidden="true"')
})
