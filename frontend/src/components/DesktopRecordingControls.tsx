import { useSyncExternalStore } from 'react'
import type { DesktopRecordingSession } from '../systems/media/DesktopRecordingSession'
import './media.css'

const sourceNames = { camera: 'Камера', microphone: 'Микрофон', screen: 'Экран' } as const

export function DesktopRecordingControls({ session }: { session: DesktopRecordingSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  if (!['starting', 'recording', 'stopping', 'error'].includes(snapshot.status) || !snapshot.sessionId) return null
  const minutes = Math.floor(snapshot.durationMs / 60_000)
  const seconds = Math.floor(snapshot.durationMs / 1_000) % 60
  return <aside className="recording-controls" aria-label="Локальная запись фильма" data-testid="desktop-recording-controls">
    <span role="status" aria-live="polite">
      <span className="recording-dot" aria-hidden="true" />
      {snapshot.status === 'starting' ? 'Запрашиваем разрешения и начинаем запись…' : snapshot.status === 'stopping' ? 'Сохраняем последние фрагменты…' : snapshot.status === 'error' ? 'Часть записи остановлена с ошибкой.' : `Запись идёт · ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      {(['camera', 'microphone', 'screen'] as const).map((source) => <span className="recording-source" key={source}>{sourceNames[source]}: {snapshot.sources[source] === 'recording' ? 'идёт' : snapshot.sources[source] === 'error' ? 'ошибка' : snapshot.sources[source] === 'saved' ? 'сохранено' : 'ожидание'}. </span>)}
    </span>
    <button type="button" disabled={!['starting', 'recording'].includes(snapshot.status)} onClick={() => { void session.stop() }}>Stop &amp; Save</button>
    {snapshot.status === 'error' && <button type="button" onClick={() => { void session.openFolder() }}>Открыть папку</button>}
    {snapshot.errors.length > 0 && <ul className="recording-errors" aria-label="Ошибки записи">{snapshot.errors.map((error, index) => <li key={`${error}:${index}`}>{error}</li>)}</ul>}
  </aside>
}
