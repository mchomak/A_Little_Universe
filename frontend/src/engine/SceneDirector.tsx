import { Suspense, useSyncExternalStore } from 'react'
import type { SceneProps } from './sceneTypes'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getSceneLighting } from './sceneLighting'
import { PrologueScene } from '../scenes/PrologueScene'
import { GrowthScene } from '../scenes/GrowthScene'
import { BloomScene } from '../scenes/BloomScene'
import { IdentityScene } from '../scenes/IdentityScene'
import { GalleryScene } from '../scenes/GalleryScene'
import { EyeScene } from '../scenes/EyeScene'
import { CosmosScene } from '../scenes/CosmosScene'
import { GreetingScene } from '../scenes/GreetingScene'
import { EndingScene } from '../scenes/EndingScene'
import { AnimatedLily } from '../scenes/lily/AnimatedLily'
import { GalaxyExperience } from '../scenes/galaxy/GalaxyExperience'


const modules = { prologue: PrologueScene, growth: GrowthScene, bloom: BloomScene, identity: IdentityScene, gallery: GalleryScene, eye: EyeScene, cosmos: CosmosScene, greeting: GreetingScene, ending: EndingScene }

export function SceneDirector(props: SceneProps) {
  const Scene = modules[props.state.scene]
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const lighting = getSceneLighting(props.state.scene, config.scenes.gallery.coldLightIntensity)
  return <>
    <color attach="background" args={['#080914']} />
    <ambientLight intensity={lighting.ambientIntensity} />
    <directionalLight position={[-3, 5, 4]} intensity={lighting.keyIntensity} color={lighting.keyColor} />
    <directionalLight position={[3, 1, -2]} intensity={lighting.fillIntensity} color={lighting.fillColor} />
    <Suspense fallback={null}><AnimatedLily {...props} /></Suspense>
    <GalaxyExperience {...props} />
    <Scene key={`${props.state.scene}:${props.state.revision}`} {...props} />
  </>
}
