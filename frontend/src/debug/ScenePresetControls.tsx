import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { exportScenePresetJson, importScenePresetJson, listScenePresets, readScenePreset, saveScenePreset, type ScenePresetSummary } from './scenePresetApi'
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
  const fileInput = useRef<HTMLInputElement>(null)
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
      const saved = await saveScenePreset(preset, scope)
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
  const exportSelected = async () => {
    if (!selectedId) return
    setBusy(true); setMessage('')
    try {
      const preset = await readScenePreset(scope, selectedId)
      const json = exportScenePresetJson(preset, scope)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = `preset-${scope}-${safeFilename(preset.name)}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
      }
      setMessage(`Экспортирован пресет «${preset.name}».`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось экспортировать пресет.') }
    finally { setBusy(false) }
  }
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBusy(true); setMessage('')
    try {
      let json: string
      try { json = await file.text() } catch { throw new Error('Не удалось прочитать выбранный файл пресета.') }
      const preset = importScenePresetJson(json, scope)
      await onApply(preset)
      setSelectedId('')
      setMessage(`Импортирован пресет «${preset.name}».`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось импортировать пресет.') }
    finally { input.value = ''; setBusy(false) }
  }
  return <section className="scene-presets" aria-label="Пресеты сцены">
    <label htmlFor="scene-preset-name">Пресет сцены</label>
    <div className="inspector-history">
      <input id="scene-preset-name" aria-label="Название пресета сцены" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Название пресета" />
      <button type="button" onClick={() => { void save() }} disabled={busy || loading}>Сохранить</button>
    </div>
    <label htmlFor="scene-preset-select">Выбранный пресет</label>
    <select id="scene-preset-select" value={selectedId} disabled={busy || loading} onChange={event => { void apply(event.target.value) }}>
      <option value="">{loading ? 'Загрузка пресетов…' : items.length ? 'Выберите пресет' : 'Пресетов пока нет'}</option>
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <div className="inspector-history">
      <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || loading} title="Применяет настройки из файла только к этой сцене.">Импортировать JSON</button>
      <button type="button" onClick={() => { void exportSelected() }} disabled={busy || loading || !selectedId} title="Скачивает JSON выбранного пресета только этой сцены.">Экспортировать JSON</button>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Файл пресета JSON" onChange={event => { void importFile(event) }} hidden />
    </div>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>
}

function safeFilename(value: string): string {
  const printable = [...value].filter(character => {
    const code = character.charCodeAt(0)
    return code >= 32 && (code < 127 || code > 159)
  }).join('')
  return printable.trim().replace(/[<>:"/\\|?*]/gu, '-').replace(/\s+/gu, '-').slice(0, 80) || 'scene'
}
