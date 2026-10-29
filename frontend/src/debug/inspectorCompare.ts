import type { FilmState, SceneId } from '../engine/film'
export interface ComparisonPoint { scene: SceneId; mode: FilmState['mode']; time: number; revision: number }
export function comparisonPointValid(point: ComparisonPoint, state: Pick<FilmState, 'scene' | 'mode' | 'revision' | 'elapsed'>, duration: number) {
  return point.scene === state.scene && point.mode === state.mode && point.revision === state.revision && (point.mode === 'playing' ? point.time < duration : point.mode === 'waiting' && Math.abs(point.time - state.elapsed) <= 0.001)
}
