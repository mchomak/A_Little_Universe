import { useSyncExternalStore } from 'react'
import type { MediaSession } from '../systems/media/MediaSession'
import './media.css'

export function RecordingControls({ session }: { session: MediaSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const active = snapshot.recordingStatus === 'recording'
  const stopping = snapshot.recordingStatus === 'stopping'
  if (!active && !stopping) return null
  return <aside className="recording-controls" aria-label="Запись реакции">
    <span role="status"><span className="recording-dot" aria-hidden="true" />{stopping ? 'Сохраняем фрагменты…' : 'Записываем видео и звук · только на этом устройстве'}</span>
    <button type="button" disabled={stopping} onClick={() => { void session.stop() }}>Остановить запись</button>
  </aside>
}
