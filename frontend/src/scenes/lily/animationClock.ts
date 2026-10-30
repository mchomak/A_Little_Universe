import type { FilmRuntime } from '../../engine/runtime'

export function subscribeLilyAnimationClock(
  runtime: FilmRuntime,
  update: (time: number) => void,
  idleClosedWaiting: boolean,
  reducedMotion: boolean,
): () => void {
  const unsubscribeFrame = runtime.subscribeFrame(update)
  const unsubscribePresentation = idleClosedWaiting && !reducedMotion
    ? runtime.subscribePresentation(update)
    : () => undefined
  return () => {
    unsubscribeFrame()
    unsubscribePresentation()
  }
}
