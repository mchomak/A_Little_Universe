import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { MediaSession } from '../systems/media/MediaSession'
import { PreparationScreen } from './PreparationScreen'

function renderPreparation(step: 'settings' | 'checking' | 'ready' = 'settings', startError?: { source: 'gift' | 'particles'; message: string }) {
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
    ...(startError ? { startError } : {}),
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

it('explains an early particle preparation failure and labels the next start as a retry', () => {
  const markup = renderPreparation('ready', { source: 'particles', message: 'worker unavailable' })

  expect(markup).toContain('role="alert"')
  expect(markup).toContain('Не удалось подготовить световой вихрь')
  expect(markup).toContain('worker unavailable')
  expect(markup).toContain('Повторить')
})

it('explains gift-opening failures separately from particle preparation', () => {
  const markup = renderPreparation('ready', { source: 'gift', message: 'Audio unavailable' })

  expect(markup).toContain('role="alert"')
  expect(markup).toContain('Не удалось открыть подарок')
  expect(markup).toContain('Audio unavailable')
  expect(markup).not.toContain('Не удалось подготовить световой вихрь')
  expect(markup).toContain('Повторить')
})

it('uses the retired preparation typography defaults without reintroducing scene-config fields', () => {
  const markup = renderPreparation()
  expect(markup).toContain('--preparation-spacing:24px')
  expect(markup).toContain('--preparation-entrance-duration:0.8s')
  expect(markup).toContain('--preparation-type-scale:1')
  expect(markup).toContain('--preparation-line-height:1.08')
  expect(markup).toContain('--preparation-card-opacity:1')
})
