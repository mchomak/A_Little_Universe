type Note = Record<string, unknown>
const text = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()

/** Paths are relative to the export's directory (or ZIP root). */
export function buildReviewMarkdown(notes: Note[]) {
  const ordered = [...notes].sort((a, b) => text(a.sceneId).localeCompare(text(b.sceneId)) || text(a.frameId).localeCompare(text(b.frameId)) || Number(a.localTimeSeconds) - Number(b.localTimeSeconds))
  const lines = ['# Правки Scene Editor для Codex', '', 'Изучи репозиторий и существующую архитектуру, затем исправь перечисленные замечания. Не затрагивай другие кадры без необходимости. Выполни подходящие проектные проверки. После работы не закрывай замечания автоматически: переведи их на проверку, а done подтверждает пользователь.', '', 'Пути снимков указаны относительно каталога этого файла.', '']
  let scene = ''; let frame = ''
  for (const note of ordered) {
    const currentScene = text(note.sceneId); const currentFrame = text(note.frameId)
    if (scene !== currentScene) { scene = currentScene; frame = ''; lines.push(`## ${scene}`, '') }
    if (frame !== currentFrame) { frame = currentFrame; lines.push(`### ${frame}`, '') }
    const captured = text(note.capturedMode)
    const content = String(note.text ?? '').replace(/\r\n/g, '\n').split('\n').map(line => `> ${line}`).join('\n')
    lines.push(`- ID: ${text(note.id)}`, `- Локальное время сцены: ${note.localTimeSeconds} с`, `- Режим / checkpoint: ${captured} / ${JSON.stringify(note.checkpoint ?? {})}`, `- Приоритет: ${text(note.priority)}; статус: ${text(note.status)}`, `- Снимок: [${text(note.screenshotPath)}](${text(note.screenshotPath)})`, `- Viewport / DPR: ${JSON.stringify(note.viewport ?? {})}`, '', content, '', '<details><summary>Снимок конфигурации</summary>', '', '```json', JSON.stringify(note.config ?? {}, null, 2), '```', '', '</details>', '')
  }
  return `${lines.join('\n')}\n`
}
