import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialFilmState } from '../engine/film'
import DeveloperPanel from './DeveloperPanel'

it('shows particle return as the renderer effective percentage and matching range', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: initialFilmState,
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
  }))

  expect(markup).toContain('Возврат частиц · 15 %')
  expect(markup).toMatch(/id="composer-scenes-prologue-particleReturnFraction"[^>]*min="0" max="20" step="1" value="15"/)
})

it('renders bounded typography and surface controls for preparation', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: initialFilmState,
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
  }))

  expect(markup).toContain('Масштаб заголовка · 100 %')
  expect(markup).toMatch(/id="composer-scenes-preparation-typeScale"[^>]*min="90" max="110" step="5" value="100"/)
  expect(markup).toContain('Межстрочный интервал заголовка · 1,08 ×')
  expect(markup).toMatch(/id="composer-scenes-preparation-lineHeight"[^>]*min="0\.9" max="1\.5" step="0\.01" value="1\.08"/)
  expect(markup).toContain('Непрозрачность поверхности · 100 %')
  expect(markup).toMatch(/id="composer-scenes-preparation-cardOpacity"[^>]*min="85" max="100" step="1" value="100"/)
})
