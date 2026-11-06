import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { AssetManager, PreparationResult } from '../systems/assets/AssetManager'
import { getConfig, updateConfig } from '../systems/scene-config/config'
import { Preloader, PreloaderRecovery } from './Preloader'
import { runPreloaderAttempt } from './preloaderFlow'

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

it('calls onReady only after the manager resolves ready and the ready delay elapses', async () => {
  let resolvePreparation!: (result: PreparationResult) => void
  const manager = { prepare: vi.fn(() => new Promise<PreparationResult>((resolve) => { resolvePreparation = resolve })) }
  const onResult = vi.fn()
  const onReady = vi.fn()
  const scheduled: (() => void)[] = []
  const scheduleReady = vi.fn((callback: () => void, delay: number) => { scheduled.push(callback); expect(delay).toBe(1250) })
  const attempt = runPreloaderAttempt({ manager: manager as unknown as AssetManager,
    onProgress: vi.fn(), onResult, onReady, isCurrent: () => true, scheduleReady,
  })

  await Promise.resolve()
  expect(manager.prepare).toHaveBeenCalledTimes(1)
  expect(onResult).not.toHaveBeenCalled()
  expect(onReady).not.toHaveBeenCalled()

  const ready: PreparationResult = { ready: true, offline: 'development', errors: [], warnings: [] }
  resolvePreparation(ready)
  await attempt
  expect(onResult).toHaveBeenCalledWith(ready)
  expect(scheduleReady).toHaveBeenCalledTimes(1)
  expect(onReady).not.toHaveBeenCalled()

  scheduled[0]!()
  expect(onReady).toHaveBeenCalledWith(ready)
})

it('keeps a failed attempt on the preloader with an actionable retry and no ready callback', async () => {
  const failed: PreparationResult = {
    ready: false, offline: 'unavailable', recovery: 'retry', errors: ['portrait: Worker unavailable'], warnings: [],
  }
  const manager = { prepare: vi.fn(async () => failed) }
  const onResult = vi.fn()
  const onReady = vi.fn()
  const scheduleReady = vi.fn()
  await runPreloaderAttempt({ manager: manager as unknown as AssetManager,
    onProgress: vi.fn(), onResult, onReady, isCurrent: () => true, scheduleReady,
  })

  const retry = vi.fn()
  const reload = vi.fn()
  const recovery = PreloaderRecovery({ result: failed, onRetry: retry, onReload: reload })
  const markup = renderToStaticMarkup(createElement(PreloaderRecovery, { result: failed, onRetry: retry, onReload: reload }))
  const buttons = (recovery.props.children as ReactElement[]).filter((child) => child.type === 'button')
  const retryButton = buttons[0] as ReactElement<{ onClick: () => void }>

  expect(onResult).toHaveBeenCalledWith(failed)
  expect(onReady).not.toHaveBeenCalled()
  expect(scheduleReady).not.toHaveBeenCalled()
  expect(markup).toContain('class="preloader-recovery"')
  expect(markup).toContain('Попробовать ещё раз')
  expect(buttons).toHaveLength(2)
  retryButton.props.onClick()
  expect(retry).toHaveBeenCalledOnce()
})
