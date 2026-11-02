import type { Dispatch } from 'react'
import type { FilmAction, FilmState } from './film'
import { retimeSceneElapsed } from './filmConfig'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'

interface FilmTimingSubscription {
  getState: () => FilmState
  getRuntimeTime: () => number
  dispatch: Dispatch<FilmAction>
  enabled: boolean
}

/** All config mutation paths share one retime point, including import, presets, history, reset and A/B restore. */
export function subscribeFilmTimingConfig({ getState, getRuntimeTime, dispatch, enabled }: FilmTimingSubscription): () => void {
  let previous = getConfig()
  return subscribeConfig((next) => {
    const before = previous
    const current = getState()
    const growthTimingChanged = before.scenes.growth.formationDuration !== next.scenes.growth.formationDuration
      || before.scenes.growth.seedFallDuration !== next.scenes.growth.seedFallDuration
      || before.scenes.growth.flowerGrowthDuration !== next.scenes.growth.flowerGrowthDuration
    const bloomTimingChanged = before.scenes.bloom.flowerBloomDuration !== next.scenes.bloom.flowerBloomDuration
    previous = next
    if (!enabled) return
    if (current.scene === 'growth' && growthTimingChanged) {
      const time = current.mode === 'playing' ? getRuntimeTime() : current.elapsed
      dispatch({ type: 'dev-seek', time: retimeSceneElapsed('growth', time, before, next, current.mode) })
    } else if (current.scene === 'bloom' && bloomTimingChanged) {
      const time = current.mode === 'playing' ? getRuntimeTime() : current.elapsed
      dispatch({ type: 'dev-seek', time: retimeSceneElapsed('bloom', time, before, next, current.mode) })
    }
  })
}
