import { TIMING } from './filmConfig'
import type { SceneId } from './film'

/** Keep the 02 world mounted through 03 and the visible GLB handoff in 04. */
export function shouldKeepGrowthWorld(scene: SceneId, elapsed: number, duration: number = TIMING.identity.flower[1]): boolean {
  if (scene === 'growth' || scene === 'bloom') return true
  return scene === 'identity' && Number.isFinite(elapsed) && elapsed < duration
}
