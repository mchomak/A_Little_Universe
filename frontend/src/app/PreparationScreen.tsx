import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { MediaSession } from '../systems/media/MediaSession'
import type { PreparationResult } from '../systems/assets/AssetManager'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { PhoneBackground } from '../components/PhoneBackground'
import type { FilmStartupError } from './filmStartup'
import './preparation.css'

export type PreparationStep = 'checking' | 'ready'

const PREPARATION_VISUAL_DEFAULTS = {
  fontFamily: 'marck-script', entranceDuration: 0.8, typeScale: 1, lineHeight: 1.08, cardOpacity: 1,
} as const

interface Props {
  step: PreparationStep
  session: MediaSession
  preparation: PreparationResult
  checked: boolean
  starting: boolean
  startError?: FilmStartupError | null
  onPrepare(): void
  onWithoutMedia(): void
  onStart(): void
  desktopRecording?: boolean
}

export function PreparationScreen({ step, session, preparation, checked, starting, startError, onPrepare, onWithoutMedia, onStart, desktopRecording = false }: Props) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const heading = useRef<HTMLHeadingElement>(null)
  const checking = step === 'checking'
  const displayStep = checking ? 'checking' : 'ready'
  const mediaFailed = Boolean(snapshot.error) || snapshot.cameraStatus === 'error' || snapshot.recordingStatus === 'error'
  const mediaFailureMessage = snapshot.error ?? [
    snapshot.cameraStatus === 'error' ? 'Камера недоступна.' : '',
    snapshot.recordingStatus === 'error' ? 'Локальная запись недоступна.' : '',
  ].filter(Boolean).join(' ')
  const startFailed = Boolean(startError)
  const giftStartFailed = startError?.source === 'gift'
  const hasFailure = mediaFailed || startFailed

  useEffect(() => { heading.current?.focus() }, [step])

  const visual = PREPARATION_VISUAL_DEFAULTS
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === visual.fontFamily)?.family ?? 'Palatino Linotype'
  const style = {
    '--preparation-entrance-duration': `${visual.entranceDuration}s`,
    '--preparation-font-family': `"${fontFamily}", var(--serif)`,
    '--preparation-type-scale': String(visual.typeScale),
    '--preparation-line-height': String(visual.lineHeight),
    '--preparation-card-opacity': String(visual.cardOpacity),
  } as CSSProperties
  const title = checking ? 'Проверка перед началом' : 'Всё готово. Это для тебя.'
  const cameraStatus = desktopRecording
    ? checked ? 'Камера и микрофон готовы.' : starting ? 'Запрашиваем разрешения устройства…' : 'Ожидает проверки.'
    : snapshot.preparing
    ? 'Ожидаем разрешения браузера…'
    : snapshot.cameraStatus === 'ready'
      ? snapshot.cameraMessage || 'Камера доступна.'
      : snapshot.cameraStatus === 'error'
        ? 'Камера недоступна.'
        : 'Ожидает проверки.'
  const recordingStatus = desktopRecording
    ? checked ? 'Запись идёт.' : starting ? 'Проверяем локальную запись…' : 'Ожидает проверки.'
    : snapshot.error
    ? 'Состояние записи не подтверждено.'
    : snapshot.recordingStatus === 'recording'
      ? 'Запись идёт.'
      : snapshot.recordingStatus === 'ready'
        ? 'Готова к началу; запись ещё не началась.'
        : snapshot.recordingStatus === 'error'
          ? 'Состояние записи не подтверждено.'
          : snapshot.preparing
            ? 'Проверяем локальную запись…'
            : 'Ожидает проверки.'

  return <section className={`preparation preparation-${displayStep}`} style={style} aria-labelledby="preparation-title" data-testid="preparation" data-step={displayStep}>
    <PhoneBackground />
    <header className="preparation-header"><span>A LITTLE UNIVERSE FOR YOU</span><span>00.1 / {checking ? 'ПРОВЕРКА' : 'ГОТОВО'}</span></header>
    <div className={`preparation-content${hasFailure ? ' preparation-content-error' : ''}`}>
      <h1 id="preparation-title" ref={heading} tabIndex={-1}>{title}{!checking && <svg className="preparation-light-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.25c.7 4.35 2.65 6.55 7.5 7.5-4.85.95-6.8 3.15-7.5 7.5-.7-4.35-2.65-6.55-7.5-7.5 4.85-.95 6.8-3.15 7.5-7.5Z" /><circle cx="19.75" cy="18.75" r="1" /></svg>}</h1>
      {checking ? <>
        <p className="preparation-subtitle">Проверяем, что камера и локальная запись доступны. Фильм не зависит от камеры.</p>
        <div className="permission-check" data-testid="permission-status" role="status" aria-live="polite">
          <dl>
            <div><dt>Камера</dt><dd>{cameraStatus}</dd></div>
            <div><dt>Локальная запись</dt><dd>{recordingStatus}</dd></div>
          </dl>
        </div>
        {mediaFailed && <p className="permission-error" role="alert" data-testid="media-error">{mediaFailureMessage}</p>}
        {checked && !mediaFailed && <p className="permission-note" role="status">Проверка завершена. Переходим к фильму…</p>}
        {mediaFailed && <>
          <button type="button" className="preparation-primary" data-testid="retry-check" onClick={onPrepare} disabled={snapshot.preparing}>Повторить проверку<span aria-hidden="true">→</span></button>
          <button type="button" className="preparation-link" data-testid="continue-without-recording" onClick={onWithoutMedia}>Продолжить без записи</button>
        </>}
      </> : <>
        <p className="preparation-subtitle">Маленькая вселенная ждёт твоего прикосновения.</p>
        {hasFailure && <div className="preparation-errors" data-testid="preparation-errors">
          {startError && !(startError.source === 'gift' && mediaFailed) && <p className="permission-error start-error-message" role="alert" data-testid={`start-error-${startError.source}`}>
            {startError.source === 'particles' ? 'Не удалось подготовить световой вихрь' : 'Не удалось открыть подарок'}: {startError.message}
          </p>}
          {mediaFailed && <p className="permission-error" role="alert" data-testid="media-error">{mediaFailureMessage}</p>}
        </div>}
        <button
          type="button"
          className="preparation-primary"
          data-testid="recording-consent"
          disabled={starting}
          onClick={startFailed ? onStart : mediaFailed ? onPrepare : onStart}
        >
          {starting ? 'Готовим фильм…' : startFailed ? 'Повторить' : mediaFailed ? 'Повторить проверку' : 'Начать фильм'}
          <span aria-hidden="true">→</span>
        </button>
        {(mediaFailed || giftStartFailed) && <button type="button" className="preparation-link" data-testid="continue-without-recording" disabled={starting} onClick={onWithoutMedia}>Продолжить без записи</button>}
      </>}
      {preparation.offline !== 'verified' && <p className="offline-note">{preparation.offline === 'development' ? 'Режим разработки: автономный запуск проверяется в production-сборке.' : 'Фильм загружен. Запуск после перезагрузки без сети пока не подтверждён.'}</p>}
    </div>
  </section>
}
