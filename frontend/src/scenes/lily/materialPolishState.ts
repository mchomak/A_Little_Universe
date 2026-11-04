export type LilyMaterialMode = 'original' | 'enhanced'
export type LilyMaterialStatus = 'idle' | 'loading' | 'ready' | 'error'
export type LilySceneId = 'growth' | 'bloom' | 'identity' | string

export interface LilyMaterialStateSnapshot {
  mode: LilyMaterialMode
  status: LilyMaterialStatus
}

let materialSnapshot: LilyMaterialStateSnapshot = { mode: 'original', status: 'idle' }
const materialListeners = new Set<() => void>()

export function getLilyMaterialSnapshot(): LilyMaterialStateSnapshot {
  return materialSnapshot
}

export function subscribeLilyMaterialExperiment(listener: () => void): () => void {
  materialListeners.add(listener)
  return () => materialListeners.delete(listener)
}

function updateMaterialSnapshot(next: LilyMaterialStateSnapshot): void {
  if (next.mode === materialSnapshot.mode && next.status === materialSnapshot.status) return
  materialSnapshot = next
  for (const listener of materialListeners) listener()
}

export function setLilyMaterialMode(mode: LilyMaterialMode): void {
  if (mode === materialSnapshot.mode) return
  updateMaterialSnapshot({ mode, status: mode === 'enhanced' ? 'loading' : 'idle' })
}

export function resetLilyMaterialModeOutsideBloom(scene: LilySceneId): void {
  if (scene !== 'bloom') setLilyMaterialMode('original')
}

export function setLilyMaterialStatus(status: LilyMaterialStatus): void {
  updateMaterialSnapshot({ ...materialSnapshot, status })
}

export function resetLilyMaterialExperiment(): void {
  updateMaterialSnapshot({ mode: 'original', status: 'idle' })
}

export function shouldUseEnhancedLilyMaterials(dev: boolean, scene: LilySceneId, mode: LilyMaterialMode): boolean {
  return dev && scene === 'bloom' && mode === 'enhanced'
}
