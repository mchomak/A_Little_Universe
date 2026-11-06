import type { SceneId } from '../engine/filmConfig'

const SCENE_STATUS_LABELS: Record<SceneId, string> = {
  prologue: 'Сцена 01 · пролог',
  growth: 'Сцена 02 · семечко и рост лилии',
  bloom: 'Сцена 03 · раскрытие лилии',
  identity: 'Сцена 04 · растворение лилии',
  gallery: 'Сцена 05 · лунная галерея',
  cosmos: 'Сцена 07 · космос',
  greeting: 'Сцена 08 · поздравление',
  ending: 'Сцена 09 · финал',
}

export function getImplementationStatus(scene: SceneId): string {
  return SCENE_STATUS_LABELS[scene]
}
