import { useMemo, useSyncExternalStore } from 'react'
import type { SceneProps } from '../engine/sceneTypes'
import { getGreetingFrames } from '../engine/filmConfig'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { CalligraphyMatter } from './shared/CalligraphyMatter'

/** Scene 08 shares the prologue's ink atlas and particle dissolve for its two phrases. */
export function GreetingScene(props: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getGreetingFrames(config), [config])
  if (props.state.returnToEnding) return null
  return <CalligraphyMatter {...props} frames={frames} selector="[data-greeting-line]" layoutEvent="greeting-layout" overlaySelector=".greeting-overlay" />
}
