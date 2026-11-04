import type { FilmRuntime } from '../../engine/runtime'

export function subscribeLilyAnimationClock(
  runtime: FilmRuntime,
  update: (time: number) => void,
): () => void {
  return runtime.subscribeFrame(update)
}
