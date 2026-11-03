import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { MediaSession } from '../systems/media/MediaSession'
import { resetConfig, updateConfig } from '../systems/scene-config/config'
import { PreparationScreen } from './PreparationScreen'

function renderPreparation(step: 'settings' | 'checking' | 'ready' = 'settings') {
  const session = {
    subscribe: () => () => undefined,
    getSnapshot: () => ({ options: { gaze: false, recording: false, upload: false } }),
  } as unknown as MediaSession
  return renderToStaticMarkup(createElement(PreparationScreen, {
    step,
    session,
    preparation: { ready: true, offline: 'verified', warnings: [], errors: [] },
    checked: false,
    starting: false,
    onOptions: () => undefined,
    onPrepare: () => undefined,
    onContinue: () => undefined,
    onWithoutMedia: () => undefined,
    onEdit: () => undefined,
    onStart: () => undefined,
  }))
}

it('uses a custom inline light mark instead of a heading emoji', () => {
  const markup = renderPreparation()

  expect(markup).not.toContain('✨')
  expect(markup).toContain('class="preparation-light-mark"')
})

it('keeps the shared phone image beneath the preparation content', () => {
  const markup = renderPreparation()

  expect(markup).toContain('class="phone-background"')
  expect(markup).toContain('aria-hidden="true"')
})

it('keeps the three switches without printing their off state', () => {
  const markup = renderPreparation()

  expect(markup).not.toContain('выкл')
  expect(markup.match(/role="switch"/g)).toHaveLength(3)
})

it('states that gaze response is unavailable without a connected tracker', () => {
  const settingsMarkup = renderPreparation()
  const checkingMarkup = renderPreparation('checking')

  expect(settingsMarkup).toContain('Реакция на взгляд недоступна: трекер взгляда не подключён.')
  expect(settingsMarkup).not.toContain('Подготовим фронтальную камеру для будущего эффекта.')
  expect(checkingMarkup).toContain('Недоступна без подключённого трекера взгляда.')
  expect(checkingMarkup).not.toContain('Глаз работает автономно.')
})

it('does not create a second point inside the ready screen', () => {
  const markup = renderPreparation('ready')

  expect(markup).not.toContain('class="ready-light"')
})

it('applies the active preparation typography and card values as live CSS variables', async () => {
  await updateConfig({ scenes: { preparation: { typeScale: 1.1, lineHeight: 1.2, cardOpacity: 0.9 } } })
  try {
    const markup = renderPreparation()

    expect(markup).toContain('--preparation-type-scale:1.1')
    expect(markup).toContain('--preparation-line-height:1.2')
    expect(markup).toContain('--preparation-card-opacity:0.9')

    await resetConfig('preparation')
    const resetMarkup = renderPreparation()
    expect(resetMarkup).toContain('--preparation-type-scale:1')
    expect(resetMarkup).toContain('--preparation-line-height:1.08')
    expect(resetMarkup).toContain('--preparation-card-opacity:1')
  } finally {
    await resetConfig('preparation')
  }
})
