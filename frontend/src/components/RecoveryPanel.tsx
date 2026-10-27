import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MediaSession, RecordingInfo } from '../systems/media/MediaSession'
import './media.css'

export function RecoveryPanel({ session }: { session: MediaSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const urls = useRef(new Set<string>())
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  const download = async (info: RecordingInfo) => {
    setBusy(info.id); setMessage('Собираем файл из сохранённых фрагментов…')
    try {
      const exported = await session.export(info.id)
      const url = URL.createObjectURL(exported.blob)
      urls.current.add(url)
      const link = document.createElement('a')
      link.href = url; link.download = exported.filename
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 30_000)
      setMessage(`Запрос скачивания отправлен браузеру. Проверь файл в загрузках.${exported.incomplete ? ' Это неполная запись: последние фрагменты могут отсутствовать, воспроизведение не гарантировано.' : ''}`)
    } catch { setMessage('Не удалось собрать файл. Сохранённые фрагменты остаются на устройстве; можно повторить экспорт.') }
    finally { setBusy(null) }
  }
  const remove = async (id: string) => {
    setBusy(id)
    try { await session.delete(id); setConfirmDelete(null); setMessage('Локальная запись удалена.') }
    catch { setMessage('Удаление не подтверждено. Попробуй ещё раз.') }
    finally { setBusy(null) }
  }
  const sessions = snapshot.sessions.filter((info) => info.id !== snapshot.activeSessionId)
  if (!sessions.length && !snapshot.error && !message) return null
  return <details className="recovery-panel">
    <summary>Записи на этом устройстве{sessions.length ? ` · ${sessions.length}` : ''}</summary>
    {snapshot.error && <p role="status">{snapshot.error}</p>}
    <p className="media-note">Запись хранится в браузере, без отправки автору. При закрытии страницы последние фрагменты могут потеряться. Хранилище браузера может быть очищено — экспортируй важный файл.</p>
    {sessions.map((info) => <div className="recovery-entry" key={info.id}>
      <p><time dateTime={new Date(info.createdAt).toISOString()}>{new Date(info.createdAt).toLocaleString('ru-RU')}</time> · {(info.bytes / 1024 / 1024).toFixed(1)} МБ</p>
      <p>{info.status === 'complete' ? 'Фрагменты сохранены локально.' : 'Неполная запись: последние фрагменты могут отсутствовать. Воспроизведение не гарантировано.'}</p>
      <div className="media-actions">
        <button type="button" disabled={busy !== null || !info.chunks} onClick={() => { void download(info) }}>Скачать{info.status !== 'complete' ? ' сохранённую часть' : ' видео'}</button>
        {confirmDelete === info.id ? <>
          <button type="button" disabled={busy !== null} onClick={() => { void remove(info.id) }}>Удалить безвозвратно</button>
          <button type="button" disabled={busy !== null} onClick={() => setConfirmDelete(null)}>Отмена</button>
        </> : <button type="button" disabled={busy !== null} onClick={() => setConfirmDelete(info.id)}>Удалить</button>}
      </div>
    </div>)}
    {message && <p role="status">{message}</p>}
  </details>
}
