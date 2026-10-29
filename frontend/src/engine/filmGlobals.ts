import type { FilmAction } from './film'
import { getConfig, subscribeConfig, type SceneComposerConfig } from '../systems/scene-config/config'

/** Follow changes to configured globals without overriding an unrelated user choice. */
export function subscribeFilmGlobals(initial: SceneComposerConfig['global'], dispatch: (action: FilmAction) => void) {
  let previous = initial
  const sync = () => {
    const next = getConfig().global
    if (next.playbackSpeed !== previous.playbackSpeed) dispatch({ type: 'set-speed', speed: next.playbackSpeed })
    if (next.quality !== previous.quality) dispatch({ type: 'set-quality', quality: next.quality })
    previous = next
  }
  const unsubscribe = subscribeConfig(sync)
  sync()
  return unsubscribe
}
