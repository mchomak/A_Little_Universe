import { describe, expect, it } from 'vitest'
import type { SceneId } from '../engine/filmConfig'
import { getImplementationStatus } from './filmStatus'

const sceneLabels: readonly [SceneId, string][] = [
  ['prologue', 'Сцена 01 · пролог'],
  ['growth', 'Сцена 02 · семечко и рост лилии'],
  ['bloom', 'Сцена 03 · раскрытие лилии'],
  ['identity', 'Сцена 04 · растворение лилии'],
  ['gallery', 'Сцена 05 · лунная галерея'],
  ['cosmos', 'Сцена 07 · космос'],
  ['greeting', 'Сцена 08 · поздравление'],
  ['ending', 'Сцена 09 · финал'],
]

describe('film implementation status', () => {
  it.each(sceneLabels)('gives %s a specific label without claiming readiness or placeholder status', (scene, label) => {
    const status = getImplementationStatus(scene)
    expect(status).toBe(label)
    expect(status).not.toMatch(/placeholder|готово|готова|implemented/i)
  })
})
