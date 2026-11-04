import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { MediaOptions, MediaSession } from '../systems/media/MediaSession'
import type { PreparationResult } from '../systems/assets/AssetManager'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import { PhoneBackground } from '../components/PhoneBackground'
import type { FilmStartupError } from './filmStartup'
import './preparation.css'

export type PreparationStep = 'settings' | 'checking' | 'ready'
interface Props {
  step: PreparationStep
  session: MediaSession
  preparation: PreparationResult
  checked: boolean
  starting: boolean
  startError?: FilmStartupError | null
  onOptions(options: MediaOptions): void
  onPrepare(): void
  onContinue(): void
  onWithoutMedia(): void
  onEdit(): void
  onStart(): void
}

function OptionIcon({ kind }: { kind: 'gaze' | 'recording' | 'upload' }) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
    {kind === 'gaze' ? <><path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16Z" /><circle cx="16" cy="16" r="4" /></>
      : kind === 'recording' ? <><circle cx="16" cy="16" r="12" /><circle cx="16" cy="16" r="4" fill="currentColor" /></>
        : <><path d="M5 21v8h22v-8M16 24V3m-7 7 7-7 7 7" /></>}
  </svg>
}

export function PreparationScreen({ step, session, preparation, checked, starting, startError, onOptions, onPrepare, onContinue, onWithoutMedia, onEdit, onStart }: Props) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [step])
  const options = snapshot.options
  const visual = config.scenes.preparation
  const fontFamily = ART_FONT_CATALOG.find((font) => font.id === visual.fontFamily)?.family ?? 'Palatino Linotype'
  const style = {
    '--preparation-spacing': `${visual.spacing}px`,
    '--preparation-entrance-duration': `${visual.entranceDuration}s`,
    '--preparation-font-family': `"${fontFamily}", var(--serif)`,
    '--preparation-type-scale': String(visual.typeScale),
    '--preparation-line-height': String(visual.lineHeight),
    '--preparation-card-opacity': String(visual.cardOpacity),
  } as CSSProperties
  const title = step === 'settings' ? 'Почти всё готово' : step === 'checking' ? 'Проверка камеры' : 'Всё готово. Это для тебя.'
  return <section className={`preparation preparation-${step}`} style={style} aria-labelledby="preparation-title" data-testid="preparation" data-step={step}>
    <PhoneBackground />
    <header className="preparation-header"><span>A LITTLE UNIVERSE FOR YOU</span><span>00.1 / {step === 'settings' ? 'ПОДГОТОВКА' : step === 'checking' ? 'ПРОВЕРКА КАМЕРЫ' : 'ГОТОВО'}</span></header>
    <div className="preparation-content">
      <h1 id="preparation-title" ref={heading} tabIndex={-1}>{title}{step === 'settings' && <svg className="preparation-light-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.25c.7 4.35 2.65 6.55 7.5 7.5-4.85.95-6.8 3.15-7.5 7.5-.7-4.35-2.65-6.55-7.5-7.5 4.85-.95 6.8-3.15 7.5-7.5Z" /><circle cx="19.75" cy="18.75" r="1" /></svg>}</h1>
      {step === 'settings' ? <>
        <p className="preparation-subtitle">Для тебя подготовлено кое-что необычное.<br />Осталось несколько настроек.</p>
        <div className="permission-options">
          {([
            ['gaze', 'Анимация, реагирующая на взгляд', 'Реакция на взгляд недоступна: трекер взгляда не подключён.'],
            ['recording', 'Запись реакции', 'Камера и микрофон сохранят видео со звуком только на этом устройстве. Запись начнётся при открытии подарка.'],
            ['upload', 'Передача записи автору', 'Пока недоступно: защищённый сервер для отправки не подключён. Видео никуда не отправляется.'],
          ] as const).map(([kind, label, description], index) => <label className="permission-option" key={kind}>
            <span className="permission-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="permission-icon"><OptionIcon kind={kind} /></span>
            <span className="permission-copy"><strong>{label}</strong><span id={`${kind}-description`}>{description}</span></span>
            <span className="permission-switch"><input role="switch" type="checkbox" data-testid={`${kind === 'recording' ? 'record' : kind}-switch`} aria-label={label} aria-describedby={`${kind}-description`} checked={Boolean(options[kind])} disabled={kind === 'upload'} onChange={(event) => onOptions({ ...options, [kind]: event.target.checked })} /><span className="switch-track" aria-hidden="true" /></span>
          </label>)}
        </div>
        <p className="permission-note"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg><span>Камера и микрофон включаются только с твоего разрешения. Без них подарок тоже работает.</span></p>
        <button type="button" className="preparation-primary" data-testid="settings-continue" onClick={onPrepare}>Продолжить <span aria-hidden="true">→</span></button>
        <button type="button" className="preparation-link" onClick={onWithoutMedia}>Продолжить без разрешений</button>
      </> : step === 'checking' ? <>
        <p className="preparation-subtitle">Проверим выбранные функции перед началом истории.</p>
        <div className="permission-check" data-testid="permission-status" role="status" aria-live="polite">
          <div className="camera-emblem" aria-hidden="true"><OptionIcon kind="gaze" /><span>ТОЛЬКО НА УСТРОЙСТВЕ</span></div>
          <dl><div><dt>Камера</dt><dd>{snapshot.preparing ? 'Ожидаем разрешения браузера…' : snapshot.cameraMessage || (snapshot.cameraStatus === 'error' ? 'Недоступна — фильм продолжится' : 'Не запрашивалась')}</dd></div><div><dt>Реакция на взгляд</dt><dd>Недоступна без подключённого трекера взгляда.</dd></div><div><dt>Микрофон и запись</dt><dd>{!options.recording ? 'Не запрашивались' : snapshot.recordingStatus === 'ready' ? 'Готовы. Запись ещё не началась.' : snapshot.preparing ? 'Проверяем после камеры…' : 'Запись недоступна. Фильм продолжится.'}</dd></div></dl>
        </div>
        {snapshot.error && <p className="permission-error" role="status">{snapshot.error}</p>}
        {checked && <button type="button" className="preparation-primary" onClick={onContinue}>Продолжить <span aria-hidden="true">→</span></button>}
        <button type="button" className="preparation-link" onClick={onWithoutMedia}>{snapshot.preparing ? 'Отменить проверку и продолжить без камеры' : 'Продолжить без камеры и записи'}</button>
        <button type="button" className="preparation-link" onClick={onEdit}>Изменить настройки</button>
      </> : <>
        <p className="preparation-subtitle">Маленькая вселенная ждёт твоего прикосновения.</p>
        {(startError || snapshot.error) && <p className={`permission-error${startError ? ' start-error-message' : ''}`} role={startError ? 'alert' : 'status'} data-testid={startError ? `start-error-${startError.source}` : undefined}>
          {startError && <>{startError.source === 'particles' ? 'Не удалось подготовить световой вихрь' : 'Не удалось открыть подарок'}: {startError.message}</>}
          {snapshot.error && <span>{startError ? ` ${snapshot.error}` : snapshot.error}</span>}
        </p>}
        {options.recording && snapshot.recordingStatus === 'ready' && <p className="permission-note">При открытии подарка начнётся локальная запись видео и звука.</p>}
        <button type="button" className="preparation-primary" data-testid="start" disabled={starting} onClick={onStart}>{starting ? 'Открываем…' : startError ? 'Повторить' : 'Открыть подарок'}<span aria-hidden="true">→</span></button>
        <button type="button" className="preparation-link" disabled={starting} onClick={onEdit}>Изменить настройки</button>
      </>}
      {preparation.offline !== 'verified' && <p className="offline-note">{preparation.offline === 'development' ? 'Режим разработки: автономный запуск проверяется в production-сборке.' : 'Фильм загружен. Запуск после перезагрузки без сети пока не подтверждён.'}</p>}
    </div>
  </section>
}
