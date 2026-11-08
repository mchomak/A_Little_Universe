import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { MediaSession } from '../systems/media/MediaSession'
import { PreparationScreen } from './PreparationScreen'
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: (current: unknown) => ({ current }),
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown, getServerSnapshot?: () => unknown) => getServerSnapshot?.() ?? getSnapshot(),
  }
})

interface Handlers {
  onPrepare(): void
  onWithoutMedia(): void
  onStart(): void
}

function createPreparationTree(
  step: 'checking' | 'ready' = 'ready',
  startError?: { source: 'gift' | 'particles'; message: string },
  desktopRecording = false,
  snapshotPatch: Partial<ReturnType<MediaSession['getSnapshot']>> = {},
  handlers: Partial<Handlers> = {},
  starting = false,
) {
  const snapshot = {
    options: { gaze: false, recording: false, upload: false },
    preparing: false,
    cameraStatus: 'idle' as const,
    cameraMessage: '',
    recordingStatus: 'idle' as const,
    error: null,
    sessions: [],
    activeSessionId: null,
    uploadAvailable: false as const,
    ...snapshotPatch,
  }
  const session = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  } as unknown as MediaSession
  return PreparationScreen({
    step,
    session,
    preparation: { ready: true, offline: 'verified', warnings: [], errors: [] },
    checked: false,
    starting,
    ...(startError ? { startError } : {}),
    onPrepare: handlers.onPrepare ?? vi.fn(),
    onWithoutMedia: handlers.onWithoutMedia ?? vi.fn(),
    onStart: handlers.onStart ?? vi.fn(),
    desktopRecording,
  })
}

function findByTestId(node: ReactNode, testId: string): ReactElement | undefined {
  if (!isValidElement(node)) return undefined
  const props = node.props as { 'data-testid'?: string; children?: ReactNode }
  if (props['data-testid'] === testId) return node
  for (const child of Children.toArray(props.children)) {
    const found = findByTestId(child, testId)
    if (found) return found
  }
  return undefined
}

function click(node: ReactElement | undefined) {
  const handler = (node?.props as { onClick?: () => void } | undefined)?.onClick
  expect(handler).toBeTypeOf('function')
  handler?.()
}

function renderPreparation(
  step: 'checking' | 'ready' = 'ready',
  startError?: { source: 'gift' | 'particles'; message: string },
  desktopRecording = false,
  snapshotPatch: Partial<ReturnType<MediaSession['getSnapshot']>> = {},
) {
  return renderToStaticMarkup(createPreparationTree(step, startError, desktopRecording, snapshotPatch))
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

it('shows one local-recording consent action without a settings screen', () => {
  const markup = renderPreparation()

  expect(markup).toContain('Начать фильм')
  expect(markup).not.toContain('data-step="settings"')
  expect(markup).not.toContain('role="switch"')
  expect(markup).not.toContain('Изменить настройки')
  expect(markup).not.toContain('Передача записи автору')
  expect(markup.match(/class="preparation-primary"/g)).toHaveLength(1)
})

it('keeps the desktop recording consent local and explicit', () => {
  const markup = renderPreparation('ready', undefined, true)
  expect(markup).toContain('Камера, микрофон и окно фильма будут записаны только на этом Mac.')
  expect(markup).toContain('Ничего не отправляется')
  expect(markup).toContain('data-testid="recording-consent"')
  expect(markup).toContain('Начать фильм')
  expect(markup).not.toContain('role="switch"')
})

it('shows device-check progress while Electron capture starts', () => {
  const tree = createPreparationTree('checking', undefined, true, {}, {}, true)
  const markup = renderToStaticMarkup(tree)

  expect(markup).toContain('Запрашиваем разрешения устройства…')
  expect(markup).toContain('Проверяем локальную запись…')
})

it('calls the start callback when the viewer accepts local recording', () => {
  const onStart = vi.fn()
  const tree = createPreparationTree('ready', undefined, false, {}, { onStart })

  click(findByTestId(tree, 'recording-consent'))

  expect(onStart).toHaveBeenCalledOnce()
})

it('uses retry and no-recording callbacks for status-level media failures', () => {
  const onPrepare = vi.fn()
  const onWithoutMedia = vi.fn()
  const tree = createPreparationTree('checking', undefined, false, {
    cameraStatus: 'error',
    recordingStatus: 'error',
  }, { onPrepare, onWithoutMedia })
  const markup = renderToStaticMarkup(tree)

  expect(markup).toContain('Камера недоступна. Локальная запись недоступна.')
  expect(markup).not.toContain('Проверка завершена. Переходим к фильму')
  click(findByTestId(tree, 'retry-check'))
  click(findByTestId(tree, 'continue-without-recording'))

  expect(onPrepare).toHaveBeenCalledOnce()
  expect(onWithoutMedia).toHaveBeenCalledOnce()
})

it('routes a ready-state recording error through retry and fallback callbacks', () => {
  const onPrepare = vi.fn()
  const onWithoutMedia = vi.fn()
  const tree = createPreparationTree('ready', undefined, false, {
    recordingStatus: 'error',
  }, { onPrepare, onWithoutMedia })
  const markup = renderToStaticMarkup(tree)

  expect(markup).toContain('data-testid="recording-consent"')
  expect(markup).toContain('Повторить проверку')
  expect(markup).toContain('data-testid="continue-without-recording"')
  click(findByTestId(tree, 'recording-consent'))
  click(findByTestId(tree, 'continue-without-recording'))

  expect(onPrepare).toHaveBeenCalledOnce()
  expect(onWithoutMedia).toHaveBeenCalledOnce()
})

it('shows one specific media alert when gift startup and media status report the same failure', () => {
  const tree = createPreparationTree('ready', { source: 'gift', message: 'Audio unavailable' }, false, {
    cameraStatus: 'error',
    recordingStatus: 'error',
    error: 'Camera permission denied.',
  })
  const markup = renderToStaticMarkup(tree)

  expect(markup.match(/role="alert"/g)).toHaveLength(1)
  expect(markup).toContain('Camera permission denied.')
  expect(markup).not.toContain('data-testid="start-error-gift"')
  expect(markup).toContain('data-testid="recording-consent"')
  expect(markup).toContain('data-testid="continue-without-recording"')
})
it('keeps compact and short ready-state errors scrollable above the primary action', () => {
  const css = readFileSync(new URL('./preparation.css', import.meta.url), 'utf-8')

  expect(css).toMatch(/@media \(max-width: 620px\) \{\s*\.preparation-ready \.preparation-errors \{[^}]*inset-block-end: 26%;[^}]*overflow-y: auto;/)
  expect(css).toMatch(/@media \(max-height: 760px\) \{\s*\.preparation-ready \.preparation-errors \{[^}]*inset-block-end: 26%;[^}]*overflow-y: auto;/)
})

it('shows a real recording failure and offers retry or continuation without recording', () => {
  const markup = renderPreparation('checking', undefined, false, {
    cameraStatus: 'error',
    recordingStatus: 'recording',
    error: 'Доступ к камере не разрешён.',
  })

  expect(markup).toContain('data-step="checking"')
  expect(markup).toContain('role="alert"')
  expect(markup).toContain('Доступ к камере не разрешён.')
  expect(markup).toContain('Состояние записи не подтверждено.')
  expect(markup).not.toContain('Запись идёт.')
  expect(markup).toContain('data-testid="retry-check"')
  expect(markup).toContain('data-testid="continue-without-recording"')
  expect(markup).toContain('Продолжить без записи')
})

it('keeps the checking status and heading keyboard accessible', () => {
  const markup = renderPreparation('checking', undefined, false, { recordingStatus: 'ready' })

  expect(markup).toContain('aria-labelledby="preparation-title"')
  expect(markup).toContain('id="preparation-title" tabindex="-1"')
  expect(markup).toContain('data-testid="permission-status" role="status" aria-live="polite"')
  expect(markup).toContain('Локальная запись')
  expect(markup).toContain('Готова к началу; запись ещё не началась.')
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
  const onWithoutMedia = vi.fn()
  const tree = createPreparationTree('ready', { source: 'gift', message: 'Recorder unavailable' }, true, {}, { onWithoutMedia })
  const markup = renderToStaticMarkup(tree)

  expect(markup).toContain('role="alert"')
  expect(markup).toContain('Не удалось открыть подарок')
  expect(markup).toContain('Recorder unavailable')
  expect(markup).not.toContain('Не удалось подготовить световой вихрь')
  expect(markup).toContain('Повторить')
  expect(markup).toContain('data-testid="continue-without-recording"')
  click(findByTestId(tree, 'continue-without-recording'))
  expect(onWithoutMedia).toHaveBeenCalledOnce()
})

it('keeps the preparation typography defaults without reintroducing scene-config fields', () => {
  const markup = renderPreparation()
  expect(markup).toContain('--preparation-entrance-duration:0.8s')
  expect(markup).toContain('--preparation-type-scale:1')
  expect(markup).toContain('--preparation-line-height:1.08')
  expect(markup).toContain('--preparation-card-opacity:1')
})
