import { useEffect, useSyncExternalStore } from 'react'
import type { DesktopRecordingSession } from '../systems/media/DesktopRecordingSession'
import './media.css'

const sourceNames = { camera: 'Камера', microphone: 'Микрофон', screen: 'Экран' } as const

export function DesktopRecordingControls({ session, filmActive = false, onStopViewing }: { session: DesktopRecordingSession; filmActive?: boolean; onStopViewing?: () => void }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  useEffect(() => {
    void session.refreshRecoveryStatus()
    const timer = setInterval(() => { void session.refreshRecoveryStatus() }, 2_000)
    return () => clearInterval(timer)
  }, [session])
  const recoveryPending = snapshot.recovery.status === 'error' || (snapshot.recovery.status !== 'idle' && (snapshot.recovery.pending > 0 || snapshot.recovery.currentSessionId !== null))
  const recoveryMessage = snapshot.recovery.status === 'paused'
    ? filmActive ? 'Восстановление ожидает завершения просмотра.' : 'Восстановление отложено до завершения записи.'
    : snapshot.recovery.status === 'recovering' ? `Восстанавливаем запись ${snapshot.recovery.currentSessionId ?? ''}…`
      : snapshot.recovery.status === 'error' ? `Ошибка восстановления: ${snapshot.recovery.error ?? 'неизвестная ошибка'}`
        : `Восстановление ожидает очереди · осталось сессий: ${snapshot.recovery.pending}`
  const stopViewingAction = filmActive && recoveryPending && onStopViewing
    ? <button type="button" onClick={onStopViewing}>{['starting', 'recording', 'stopping'].includes(snapshot.status) ? 'Завершить просмотр' : 'Завершить просмотр и восстановить'}</button>
    : null
  const retryAction = snapshot.recovery.retryable
    ? <button type="button" onClick={() => { void session.retryRecovery() }}>Повторить восстановление</button>
    : null
  if (!['starting', 'recording', 'stopping', 'saved', 'error'].includes(snapshot.status) || !snapshot.sessionId) {
    if (!recoveryPending) return null
    return <aside className="recording-controls" aria-label="Восстановление записи"><span role="status" aria-live="polite">{recoveryMessage}</span>{stopViewingAction}{retryAction}</aside>
  }
  const minutes = Math.floor(snapshot.durationMs / 60_000)
  const seconds = Math.floor(snapshot.durationMs / 1_000) % 60
  const finalizationLabel = snapshot.finalizationStatus === 'complete' ? 'Итоговые файлы проверены.'
    : snapshot.finalizationStatus === 'partial' ? 'Часть файлов сохранена; см. ошибки ниже.'
      : snapshot.finalizationStatus === 'error' ? 'Не удалось собрать итоговые файлы; сегменты доступны в папке.'
        : snapshot.finalizationStatus === 'finalizing' ? 'Проверяем сегменты и собираем итоговые файлы…' : ''
  return <aside className="recording-controls" aria-label="Локальная запись фильма" data-testid="desktop-recording-controls">
    <span role="status" aria-live="polite">
      <span className={`recording-dot${snapshot.status === 'saved' ? ' recording-dot-complete' : snapshot.status === 'error' ? ' recording-dot-error' : ''}`} aria-hidden="true" />
      {snapshot.status === 'starting' ? 'Запрашиваем разрешения и начинаем запись…' : snapshot.status === 'stopping' ? finalizationLabel || 'Сохраняем последние фрагменты…' : snapshot.status === 'saved' ? `Запись сохранена · ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}. ${finalizationLabel}` : snapshot.status === 'error' ? `Часть записи остановлена с ошибкой. ${finalizationLabel}` : `Запись идёт · ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      {(['camera', 'microphone', 'screen'] as const).map((source) => <span className="recording-source" key={source}>{sourceNames[source]}: {snapshot.sources[source] === 'recording' ? 'идёт' : snapshot.sources[source] === 'error' ? 'ошибка' : snapshot.sources[source] === 'saved' ? 'сохранено' : 'ожидание'}. </span>)}
    </span>
    {recoveryPending && <span role="status" aria-live="polite">{recoveryMessage}</span>}
    {stopViewingAction}
    {retryAction}
    <button type="button" disabled={!['starting', 'recording', 'error'].includes(snapshot.status)} onClick={() => { void session.stop() }}>Stop &amp; Save</button>
    {['saved', 'error'].includes(snapshot.status) && <button type="button" onClick={() => { void session.openFolder() }}>Открыть папку записи</button>}
    {snapshot.errors.length > 0 && <ul className="recording-errors" aria-label="Ошибки записи">{snapshot.errors.map((error, index) => <li key={`${error}:${index}`}>{error}</li>)}</ul>}
  </aside>
}
