export interface SceneLighting {
  ambientIntensity: number
  keyIntensity: number
  keyColor: string
  fillIntensity: number
  fillColor: string
}

const ORIGINAL_SCENE_LIGHTING: SceneLighting = {
  ambientIntensity: 0.9,
  keyIntensity: 2.4,
  keyColor: '#FFF0E8',
  fillIntensity: 1.1,
  fillColor: '#B9A4E8',
}

/** Keeps the shared film rig unchanged and derives a separate cool rig only for Scene 05. */
export function getSceneLighting(scene: string, coldLightIntensity: number): SceneLighting {
  if (scene !== 'gallery') return ORIGINAL_SCENE_LIGHTING
  const intensity = Number.isFinite(coldLightIntensity) ? Math.max(0, Math.min(1.8, coldLightIntensity)) : 0.8
  return {
    ambientIntensity: 0.32 * intensity,
    keyIntensity: 0.58 * intensity,
    keyColor: '#b8cde8',
    fillIntensity: 0.24 * intensity,
    fillColor: '#7895bb',
  }
}
