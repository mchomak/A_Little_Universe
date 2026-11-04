import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialFilmState } from '../engine/film'
import { DEFAULT_SCENE_COMPOSER_CONFIG, updateConfig } from '../systems/scene-config/config'
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

it('exposes the gallery layout switch and independently editable active layout', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: { ...initialFilmState, scene: 'gallery' },
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
    route: 'film',
  }))

  expect(markup).toContain('Лунная галерея')
  expect(markup).toContain('Вариант расположения картин')
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutVariant"/)
  expect(markup).toMatch(/<option value="between-columns" selected="">B · Между колоннами/)
  expect(markup).toContain('На колоннах')
  expect(markup).toContain('Между колоннами')
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-laneWidth"[^>]*min="6" max="12" step="0\.1" value="7"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetX"[^>]*value="2"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetY"[^>]*value="0\.75"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetZ"[^>]*value="2\.1"/)
  expect(markup).not.toContain('composer-scenes-gallery-galleryLayoutA-laneWidth')
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryPhotoFacingMaxDegrees"[^>]*value="45"/)
  expect(markup).toContain('Колонны и геометрия галереи')
  expect(markup).toMatch(/id="composer-scenes-gallery-columnVisible"[^>]*type="checkbox"[^>]*checked/)
  expect(markup).toMatch(/id="composer-scenes-gallery-galleryWidth"[^>]*min="6" max="12" step="0.1" value="7"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-columnScale"[^>]*min="0.75" max="3" step="0.05" value="1"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-columnDepth"[^>]*min="0.02" max="2" step="0.01" value="0.15"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-columnOffsetX"[^>]*min="-2" max="2" step="0.05" value="0"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-columnOffsetY"[^>]*min="-2" max="2" step="0.05" value="0"/)
  expect(markup).toContain('Арка у Луны')
  expect(markup).toMatch(/id="composer-scenes-gallery-archVisible"[^>]*type="checkbox"[^>]*checked/)
  expect(markup).toMatch(/id="composer-scenes-gallery-archScale"[^>]*min="8" max="28" step="0.25" value="19"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-archOpacity"[^>]*min="0.1" max="1" step="0.01" value="0.78"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-archPositionZ"[^>]*min="-140" max="-65" step="0.5" value="-82"/)
  expect(markup).toContain('Far Clouds · дальний слой')
  expect(markup).toContain('Mid Clouds · боковые массы')
  expect(markup).toContain('Near Low Clouds · за фотографиями')
  expect(markup).toContain('Waterline Clouds · дымка над водой')
  expect(markup).toContain('Moon Clouds · облака у Луны')
  expect(markup).toContain('Мягкость края')
  expect(markup).toContain('Скорость дрейфа')
  expect(markup).toContain('Высота дымки')
  expect(markup).toContain('Лунный свет на облаках')
  expect(markup).toContain('Общий лунный свет')
  expect(markup).toContain('Интенсивность ореола Луны')
  expect(markup).toContain('Цвет лунного света')
  expect(markup).toContain('Интенсивность god rays')
  expect(markup).toMatch(/id="composer-scenes-gallery-moonPositionY"[^>]*min="4" max="24" step="0.1" value="24"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonTargetY"[^>]*min="-12" max="14" step="0.05" value="5.2"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonTargetZ"[^>]*min="-180" max="40" step="1" value="-34"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonGodRaysIntensity"[^>]*min="0" max="0.8" step="0.01" value="0.12"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonLightColor"[^>]*type="color"[^>]*value="#C3D8F2"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-frameIntensity"[^>]*min="0" max="2" step="0.05" value="1"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-particleCount"[^>]*min="0" max="600" step="1" value="220"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonBrightness"[^>]*min="0" max="2" step="0.05" value="0.8"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonSize"[^>]*min="0.4" max="1.8" step="0.05" value="1.2"/)
  const cloudLayers = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.cloudLayers
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-far-count"[^>]*min="0" max="12" step="1" value="${cloudLayers.far.count}"`))
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-far-density"[^>]*min="0" max="1.8" step="0.05" value="0.84"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-mid-scale"[^>]*min="0.55" max="2" step="0.05" value="1.16"/)
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-nearLow-count"[^>]*min="0" max="24" step="1" value="${cloudLayers.nearLow.count}"`))
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-nearLow-brightness"[^>]*min="0" max="2" step="0.05" value="1.08"/)
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-waterline-count"[^>]*min="0" max="32" step="1" value="${cloudLayers.waterline.count}"`))
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-moon-count"[^>]*min="0" max="8" step="1" value="${cloudLayers.moon.count}"`))
  expect(markup).toContain('Счётчик управляет только этой группой; количество других облаков на него не влияет.')
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-far-driftSpeed"[^>]*min="0" max="3" step="0.05" value="0.48"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-waterline-driftSpeed"[^>]*min="0" max="3" step="0.05" value="0.52"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudLayers-waterline-softness"[^>]*min="0" max="1" step="0.025" value="0.58"/)
  expect(markup).not.toContain('composer-scenes-gallery-cloudDensity')
  expect(markup).not.toContain('composer-scenes-gallery-cloudLayerCount')
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudDriftVariation"[^>]*min="0" max="1" step="0.05" value="0.65"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudCoolTint"[^>]*min="0" max="1.5" step="0.025" value="1.35"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-cloudWhiteHighlight"[^>]*min="0" max="1.5" step="0.025" value="0.24"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-hazeDensity"[^>]*min="0" max="1.8" step="0.05" value="0.3"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-hazeHeight"[^>]*min="-3" max="3" step="0.1" value="0"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-hazeMotionSpeed"[^>]*min="0" max="3" step="0.025" value="0.35"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterBaseBrightness"[^>]*min="0" max="1.5" step="0.01" value="0.72"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-reflectionStrength"[^>]*min="0" max="0.9" step="0.01" value="0.64"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-reflectionBlur"[^>]*min="0.3" max="1.5" step="0.01" value="0.62"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-reflectionFalloff"[^>]*min="0.25" max="2.5" step="0.01" value="1.25"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterDistortion"[^>]*min="0" max="0.14" step="0.001" value="0.02"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterDistortionScale"[^>]*min="0.25" max="4.5" step="0.01" value="0.87"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterRippleSpeed"[^>]*min="0" max="3" step="0.01" value="1"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterNormalStrength"[^>]*min="0" max="3" step="0.01" value="0.5"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonHighlightStrength"[^>]*min="0" max="2" step="0.01" value="1.1"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonReflectionSpread"[^>]*min="0.25" max="4" step="0.01" value="2"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-waterOpacity"[^>]*min="0" max="1" step="0.01" value="1"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-threadOpacity"[^>]*min="0" max="0.8" step="0.01" value="0.38"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-coldLightIntensity"[^>]*min="0" max="1.8" step="0.05" value="0.58"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonLightIntensity"[^>]*min="0" max="3" step="0.05" value="1.4"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonFillIntensity"[^>]*min="0" max="1.2" step="0.025" value="0.22"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonHaloIntensity"[^>]*min="0" max="2" step="0.05" value="1.8"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonCloudLightIntensity"[^>]*min="0" max="2" step="0.05" value="0.72"/)
  expect(markup).toMatch(/id="composer-scenes-gallery-moonScatteringIntensity"[^>]*min="0" max="1.5" step="0.025" value="0.62"/)
  expect(markup).not.toContain('Сохранить A')
  expect(markup).not.toContain('Показать A')
})

it('keeps independent cloud count controls with no shared render limit', () => {
  const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
    state: { ...initialFilmState, scene: 'gallery', quality: 'low' },
    dispatch: () => undefined,
    reducedMotion: false,
    onPreload: () => undefined,
    onPermissions: () => undefined,
    route: 'film',
  }))

  const cloudLayers = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.cloudLayers
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-waterline-count"[^>]*min="0" max="32" step="1" value="${cloudLayers.waterline.count}"`))
  expect(markup).toMatch(new RegExp(`id="composer-scenes-gallery-cloudLayers-moon-count"[^>]*min="0" max="8" step="1" value="${cloudLayers.moon.count}"`))
  expect(markup).not.toContain('не более 24 объёмных масс')
})

it('shows the B profile values when the between-columns layout is active', async () => {
  await updateConfig({ scenes: { gallery: {
    galleryLayoutVariant: 'between-columns',
    galleryLayoutA: { laneWidth: 6.5, offsetX: 0.3, offsetY: -0.2, offsetZ: 1 },
    galleryLayoutB: { laneWidth: 8.6, offsetX: -0.4, offsetY: 0.5, offsetZ: -2.1 },
  } } })
  try {
    const markup = renderToStaticMarkup(createElement(DeveloperPanel, {
      state: { ...initialFilmState, scene: 'gallery' },
      dispatch: () => undefined,
      reducedMotion: false,
      onPreload: () => undefined,
      onPermissions: () => undefined,
      route: 'film',
    }))

    expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutVariant"/)
    expect(markup).toMatch(/<option value="between-columns" selected="">B · Между колоннами/)
    expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-laneWidth"[^>]*min="6" max="12" step="0\.1" value="8\.6"/)
    expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetX"[^>]*min="-2\.5" max="3" step="0\.05" value="-0\.4"/)
    expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetY"[^>]*value="0\.5"/)
    expect(markup).toMatch(/id="composer-scenes-gallery-galleryLayoutB-offsetZ"[^>]*value="-2\.1"/)
    expect(markup).toMatch(/id="composer-scenes-gallery-galleryPhotoFacingMaxDegrees"[^>]*min="0" max="45" step="1" value="45"/)
    expect(markup).toContain('Максимальный разворот картин к зрителю')
    expect(markup).not.toContain('composer-scenes-gallery-galleryLayoutA-laneWidth')
  } finally {
    await updateConfig(DEFAULT_SCENE_COMPOSER_CONFIG)
  }
})

