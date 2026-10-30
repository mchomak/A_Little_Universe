import type { SceneId } from '../engine/filmConfig'

export function getImplementationStatus(scene: SceneId): string {
  if (scene === 'growth') return 'Сцена 02 · семечко и рост лилии'
  if (scene === 'bloom') return 'Сцена 03 · раскрытие лилии'
  return 'Сцены 06–09 · placeholders'
}
