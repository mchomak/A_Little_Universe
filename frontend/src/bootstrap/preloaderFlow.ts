import type { AssetManager, PreparationProgress, PreparationResult } from '../systems/assets/AssetManager'

interface PreloaderAttemptOptions {
  manager: Pick<AssetManager, 'prepare'>
  onProgress: (progress: PreparationProgress) => void
  onResult: (result: PreparationResult) => void
  onReady: (result: PreparationResult) => void
  isCurrent: () => boolean
  scheduleReady: (callback: () => void, delay: number) => void
}

/** Apply one preparation result and schedule the ready callback only after success. */
export async function runPreloaderAttempt({
  manager, onProgress, onResult, onReady, isCurrent, scheduleReady,
}: PreloaderAttemptOptions) {
  const result = await manager.prepare(onProgress)
  if (!isCurrent()) return
  onResult(result)
  if (result.ready) scheduleReady(() => { if (isCurrent()) onReady(result) }, 1250)
}
