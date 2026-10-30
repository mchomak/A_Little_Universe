import { Suspense } from 'react'
import type { SceneProps } from './sceneTypes'
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
  return <>
    <color attach="background" args={['#080914']} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[-3, 5, 4]} intensity={2.4} color="#FFF0E8" />
    <directionalLight position={[3, 1, -2]} intensity={1.1} color="#B9A4E8" />
    <Suspense fallback={null}><AnimatedLily {...props} /></Suspense>
    <GalaxyExperience {...props} />
    <Scene key={`${props.state.scene}:${props.state.revision}`} {...props} />
  </>
}
