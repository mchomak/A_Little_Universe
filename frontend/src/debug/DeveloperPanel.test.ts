import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialFilmState } from '../engine/film'
import DeveloperPanel from './DeveloperPanel'

it('shows bounded ash-motion controls and does not expose the removed return setting', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: initialFilmState,
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
  }))

  expect(markup).toContain('Ветер · 1,15 ×')
  expect(markup).toMatch(/id="composer-scenes-prologue-windStrength"[^>]*min="0.2" max="3" step="0.05" value="1.15"/)
  expect(markup).toContain('Турбулентность · 0,3 ×')
  expect(markup).toMatch(/id="composer-scenes-prologue-turbulence"[^>]*min="0" max="1" step="0.05" value="0.3"/)
  expect(markup).toContain('Ширина фронта · 8 %')
  expect(markup).toMatch(/id="composer-scenes-prologue-fractureWidth"[^>]*min="0" max="18" step="1" value="8"/)
  expect(markup).toContain('Длительность фронта · 1,5 с')
  expect(markup).toContain('Длительность движения частиц · 2,2 с')
  expect(markup).toMatch(/id="composer-scenes-prologue-particleDuration"[^>]*min="0.1" max="20" step="0.1" value="2.2"/)
  expect(markup).toContain('Длительность затухания пыли · 1,2 с')
  expect(markup).toMatch(/id="composer-scenes-prologue-particleFadeDuration"[^>]*min="0.5" max="4" step="0.1" value="1.2"/)
  expect(markup).toContain('Рукописное появление подсказки · 0,65 с')
  expect(markup).not.toContain('particleReturnFraction')
})

it('renders bounded typography and surface controls for preparation', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: initialFilmState,
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
    route: 'settings',
  }))

  expect(markup).toContain('Масштаб заголовка · 100 %')
  expect(markup).toMatch(/id="composer-scenes-preparation-typeScale"[^>]*min="90" max="110" step="5" value="100"/)
  expect(markup).toContain('Межстрочный интервал заголовка · 1,08 ×')
  expect(markup).toMatch(/id="composer-scenes-preparation-lineHeight"[^>]*min="0\.9" max="1\.5" step="0\.01" value="1\.08"/)
  expect(markup).toContain('Непрозрачность поверхности · 100 %')
  expect(markup).toMatch(/id="composer-scenes-preparation-cardOpacity"[^>]*min="85" max="100" step="1" value="100"/)
})

it('shows only the active scene controls and keeps playback in the timeline', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: { ...initialFilmState, scene: 'growth' },
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
    route: 'film',
  }))
  expect(markup).toContain('Качество семечка')
  expect(markup).toMatch(/id="composer-scenes-growth-formationDuration"[^>]*min="2\.5" max="3\.5" step="0\.1" value="3\.2"/)
  expect(markup).toMatch(/id="composer-scenes-growth-attractionStrength"[^>]*min="2" max="24" step="0\.5" value="11\.5"/)
  expect(markup).toContain('id="composer-scenes-growth-pearlColor"')
  expect(markup).not.toContain('composer-scenes-prologue-windStrength')
  expect(markup).not.toContain('composer-scenes-preparation-typeScale')
  expect(markup).not.toContain('dev-seek')
  expect(markup).toContain('Auto')
})

it('exposes bounded portrait assembly controls in the Scene 04 Inspector', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: { ...initialFilmState, scene: 'identity' },
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
    route: 'film',
  }))

  expect(markup).toContain('Сборка портрета из частиц')
  expect(markup).toMatch(/id="composer-scenes-identity-particleCount"[^>]*min="1000" max="100000"[^>]*value="80000"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitStartProgress"[^>]*min="0" max="100"[^>]*value="30"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitDuration"[^>]*min="2" max="16"[^>]*value="8\.5"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitFraction"[^>]*min="0" max="45"[^>]*value="40"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitMinTurns"[^>]*min="0" max="4"[^>]*value="0"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitMaxTurns"[^>]*min="0" max="4"[^>]*value="2"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitSteering"[^>]*min="0" max="2"[^>]*value="1"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitBraking"[^>]*min="0.25" max="2"[^>]*value="1"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitSettledBrightness"[^>]*min="1" max="2"[^>]*value="1\.15"/)
  expect(markup).toMatch(/id="composer-scenes-identity-vortexSpeedMultiplier"[^>]*min="0" max="2"[^>]*value="0\.9"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitBrightness"[^>]*min="1\.1" max="2"[^>]*value="1\.8"/)
  expect(markup).toMatch(/id="composer-scenes-identity-portraitSize"[^>]*min="0\.6" max="1\.8"[^>]*value="1\.8"/)
  expect(markup).toContain('composer-scenes-identity-portraitOffsetX')
  expect(markup).toContain('composer-scenes-identity-portraitOffsetY')
  expect(markup).not.toMatch(/id="composer-scenes-identity-portraitStart"/)
})

it('exposes the imported galaxy seed and optional black center in Scene 07 Inspector', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: { ...initialFilmState, scene: 'cosmos' },
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
  }))

  expect(markup).toContain('Seed генерации')
  expect(markup).toMatch(/id="composer-scenes-galaxy-seed"[^>]*type="text"[^>]*value="andromeda"/)
  expect(markup).toContain('Чёрный центр')
  expect(markup).toContain('Spore (R/B/Y/V)')
  expect(markup).not.toContain('scenes-galaxy-scatter')
  expect(markup).toContain('Сжатие разброса')
  expect(markup).toMatch(/id="composer-scenes-galaxy-rotationSpeed"[^>]*min="0" max="0\.1"[^>]*value="0\.045"/)
  expect(markup).toMatch(/id="composer-scenes-galaxy-backgroundStarCount"[^>]*max="10000"[^>]*value="5200"/)
})

