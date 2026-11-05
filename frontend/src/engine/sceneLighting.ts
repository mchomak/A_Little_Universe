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

const GROWTH_SHADOW_LIGHTING: SceneLighting = {
  ambientIntensity: 0.1,
  keyIntensity: 0.2,
  keyColor: '#FFF0E8',
  fillIntensity: 0.08,
  fillColor: '#B9A4E8',
}

const GROWTH_MOONLIT_LIGHTING: SceneLighting = {
  ambientIntensity: 0.35,
  keyIntensity: 1.3,
  keyColor: '#FFF0E8',
  fillIntensity: 0.4,
  fillColor: '#B9A4E8',
}

/** Scene 02 starts in shadow, fills moderately after impact and restores the shared rig during settle. */
export function getSceneLighting(
  scene: string,
  coldLightIntensity: number,
  growthMoonlightProgress = 0,
  growthSettleProgress = 0,
): SceneLighting {
  if (scene === 'growth') {
    const moonlight = Number.isFinite(growthMoonlightProgress) ? Math.min(1, Math.max(0, growthMoonlightProgress)) : 0
    const settle = Number.isFinite(growthSettleProgress) ? Math.min(1, Math.max(0, growthSettleProgress)) : 0
    const moonlitAmbient = interpolate(GROWTH_SHADOW_LIGHTING.ambientIntensity, GROWTH_MOONLIT_LIGHTING.ambientIntensity, moonlight)
    const moonlitKey = interpolate(GROWTH_SHADOW_LIGHTING.keyIntensity, GROWTH_MOONLIT_LIGHTING.keyIntensity, moonlight)
    const moonlitFill = interpolate(GROWTH_SHADOW_LIGHTING.fillIntensity, GROWTH_MOONLIT_LIGHTING.fillIntensity, moonlight)
    return {
      ambientIntensity: interpolate(moonlitAmbient, ORIGINAL_SCENE_LIGHTING.ambientIntensity, settle),
      keyIntensity: interpolate(moonlitKey, ORIGINAL_SCENE_LIGHTING.keyIntensity, settle),
      keyColor: ORIGINAL_SCENE_LIGHTING.keyColor,
      fillIntensity: interpolate(moonlitFill, ORIGINAL_SCENE_LIGHTING.fillIntensity, settle),
      fillColor: ORIGINAL_SCENE_LIGHTING.fillColor,
    }
  }
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

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
