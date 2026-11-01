import type { SceneProps } from '../engine/sceneTypes'
import { getPrologueFrames } from '../engine/filmConfig'
import { useMemo, useSyncExternalStore } from 'react'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { CalligraphyMatter } from './shared/CalligraphyMatter'
import { PrologueAtmosphere } from './prologue/PrologueAtmosphere'

// eslint-disable-next-line react-refresh/only-export-components -- retained public deterministic sampling seam.
export { sampleGlyphParticlePixels } from './prologue/letterMatter'

export function PrologueScene(props: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getPrologueFrames(config), [config])
  return <>
    <PrologueAtmosphere {...props} />
    <CalligraphyMatter {...props} frames={frames} selector="[data-prologue-line]" layoutEvent="prologue-layout" overlaySelector=".prologue-overlay" />
  </>
}
