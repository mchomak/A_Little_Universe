import { useEffect, useState } from 'react'
import { listScenePresets, readScenePreset, saveScenePreset, type ScenePresetSummary } from './scenePresetApi'
import { type ScenePresetScope, type ScenePresetV1 } from './scenePresetModel'

export default function ScenePresetControls({ scope, capture, onApply }: {
  scope: ScenePresetScope
  capture(name: string): ScenePresetV1
  onApply(preset: ScenePresetV1): void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<ScenePresetSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = async (currentScope: ScenePresetScope) => {
    setLoading(true)
    try { const next = await listScenePresets(currentScope); setItems(next); setSelectedId(current => next.some(item => item.id === current) ? current : '') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить пресеты.') }
    finally { setLoading(false) }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(scope) }, 0); return () => window.clearTimeout(timer) }, [scope])
  const save = async () => {
    const cleanName = name.trim()
    if (!cleanName || cleanName.length > 80) { setMessage('Введите название длиной до 80 символов.'); return }
    setBusy(true); setMessage('')
    try {
      const duplicate = items.find(item => item.name.localeCompare(cleanName, undefined, { sensitivity: 'accent' }) === 0)
      let preset = capture(cleanName)
      if (duplicate) {
        if (!window.confirm(`Пресет «${duplicate.name}» уже существует. Заменить его?`)) return
        preset = { ...preset, id: duplicate.id }
      }
      const saved = await saveScenePreset(preset)
      const next = await listScenePresets(scope)
      setItems(next); setSelectedId(saved.id); setName(''); setMessage(`Сохранён пресет «${saved.name}».`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить пресет.') }
    finally { setBusy(false) }
  }
  const apply = async (id: string) => {
    setSelectedId(id)
    if (!id) return
    setBusy(true); setMessage('')
    try { await onApply(await readScenePreset(scope, id)) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось применить пресет.'); setSelectedId('') }
    finally { setBusy(false) }
  }
  return <section className="scene-presets" aria-label="Пресеты сцены">
    <label htmlFor="scene-preset-name">Пресет сцены</label>
    <div className="inspector-history">
      <input id="scene-preset-name" aria-label="Название пресета сцены" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Название пресета" />
      <button type="button" onClick={() => { void save() }} disabled={busy || loading}>Сохранить</button>
    </div>
    <label htmlFor="scene-preset-select">Загруженный вариант</label>
    <select id="scene-preset-select" value={selectedId} disabled={busy || loading} onChange={event => { void apply(event.target.value) }}>
      <option value="">{loading ? 'Загрузка пресетов…' : items.length ? 'Выберите пресет' : 'Пресетов пока нет'}</option>
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>
}
