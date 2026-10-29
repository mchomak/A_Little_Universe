import type { FilmAction } from '../engine/film'

export interface LoopRange { start: number; end: number }
export function validLoop(start: number, end: number, duration: number) {
  return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(duration) && start >= 0 && end - start >= 0.1 && end <= duration
}
/** Listens to the one film clock. A pending seek is issued once until the new revision publishes its start. */
export function createLoopListener(range: LoopRange, dispatch: (action: FilmAction) => void) {
  let pending = false
  return (time: number) => {
    if (time < range.end) { pending = false; return }
    if (!pending) { pending = true; dispatch({ type: 'dev-seek', time: range.start }) }
  }
}
