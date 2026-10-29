import type { SceneId } from '../engine/filmConfig'

export function getImplementationStatus(scene: SceneId): string {
  return scene === 'growth'
    ? 'Сцена 02 · формирование семечка'
    : 'Сцены 03, 06–09 · placeholders'
}
