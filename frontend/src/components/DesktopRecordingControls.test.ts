import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DesktopRecordingControls } from './DesktopRecordingControls'
import type { DesktopRecordingSession, DesktopRecordingSnapshot } from '../systems/media/DesktopRecordingSession'

it('offers an accessible way to end viewing when crash recovery is pending', () => {
  const snapshot = {
    status: 'idle', sessionId: null,
    recovery: { status: 'paused', pending: 2, currentSessionId: null, error: null, failed: 0, retryable: false },
  } as DesktopRecordingSnapshot
  const session = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  } as unknown as DesktopRecordingSession

  const markup = renderToStaticMarkup(createElement(DesktopRecordingControls, {
    session,
    filmActive: true,
    onStopViewing: () => undefined,
  }))

  expect(markup).toContain('Завершить просмотр и восстановить')
  expect(markup).toContain('aria-label="Восстановление записи"')
})

it('shows an explicit retry action for a failed recovery', () => {
  const snapshot = {
    status: 'idle', sessionId: null,
    recovery: { status: 'error', pending: 1, currentSessionId: null, error: 'ffmpeg failed', failed: 1, retryable: true },
  } as DesktopRecordingSnapshot
  const session = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  } as unknown as DesktopRecordingSession

  const markup = renderToStaticMarkup(createElement(DesktopRecordingControls, { session }))
  expect(markup).toContain('Повторить восстановление')
  expect(markup).toContain('ffmpeg failed')
})
