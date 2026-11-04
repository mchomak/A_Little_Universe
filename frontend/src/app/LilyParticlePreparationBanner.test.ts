import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LilyParticlePreparationBanner } from './LilyParticlePreparationBanner'

describe('LilyParticlePreparationBanner', () => {
  it('shows active recalculation and hides in production or when ready', () => {
    const props = { development: true, onRetry: vi.fn() }
    const preparing = renderToStaticMarkup(createElement(LilyParticlePreparationBanner, { ...props, snapshot: { status: 'preparing', key: 'current' } }))
    const production = renderToStaticMarkup(createElement(LilyParticlePreparationBanner, { ...props, development: false, snapshot: { status: 'preparing', key: 'current' } }))
    const ready = renderToStaticMarkup(createElement(LilyParticlePreparationBanner, { ...props, snapshot: { status: 'ready', key: 'current' } }))

    expect(preparing).toContain('Подготавливаем световой вихрь для актуальных настроек')
    expect(production).toBe('')
    expect(ready).toBe('')
  })

  it('offers retry when preparation fails', () => {
    const markup = renderToStaticMarkup(createElement(LilyParticlePreparationBanner, {
      development: true,
      snapshot: { status: 'error', key: 'current', error: 'worker unavailable' },
      onRetry: vi.fn(),
    }))

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Повторить')
  })
})
