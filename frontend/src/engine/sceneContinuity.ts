import { TIMING } from './filmConfig'
import type { SceneId } from './film'

/** Keep the 02 world mounted through 03 and the visible GLB handoff in 04. */
export function shouldKeepGrowthWorld(scene: SceneId, elapsed: number, duration: number = TIMING.identity.flower[1]): boolean {
  if (scene === 'growth' || scene === 'bloom') return true
  return scene === 'identity' && Number.isFinite(elapsed) && elapsed < duration
}

/** Keep the world-space cloud sea with its island through bloom and the opening of identity. */
export function shouldMountGrowthClouds(environmentOnly: boolean): boolean {
  // The caller distinguishes active growth from its carried environment; both keep this layer.
  void environmentOnly
  return true
}

/** Fade the carried scene 02 environment over the active scene 04 dissolve. */
export function getIdentityEnvironmentOpacity(elapsed: number, duration: number): number {
  if (!Number.isFinite(elapsed)) return 1
  return 1 - Math.min(1, Math.max(0, elapsed / Math.max(duration, 0.001)))
}
