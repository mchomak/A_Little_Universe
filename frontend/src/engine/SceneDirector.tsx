import { Suspense, useCallback, useLayoutEffect, useState } from 'react'
import type { SceneProps } from './sceneTypes'
import type { FilmRuntime } from './runtime'
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
import { BloomGestureTarget } from '../scenes/lily/BloomGestureTarget'
import type { LilyParticleSource } from '../scenes/shared/identityParticles'
import { GalaxyExperience } from '../scenes/galaxy/GalaxyExperience'
import { shouldKeepGrowthWorld } from './sceneContinuity'


const modules = { prologue: PrologueScene, bloom: BloomScene, gallery: GalleryScene, eye: EyeScene, cosmos: CosmosScene, greeting: GreetingScene, ending: EndingScene }

function IdentityLoading({ runtime }: { runtime: FilmRuntime }) {
  useLayoutEffect(() => runtime.hold(), [runtime])
  return null
}

export function SceneDirector(props: SceneProps) {
  const { scene, elapsed } = props.state
  const Scene = scene === 'growth' || scene === 'identity' ? null : modules[scene]
  const [lilyParticleSource, setLilyParticleSource] = useState<LilyParticleSource | null>(null)
  const publishLilyParticleSource = useCallback((source: LilyParticleSource) => {
    setLilyParticleSource((current) => current ?? source)
  }, [])
  // Keep the same world and its floor, rings, mound and moonlight through the
  // touch scene and the first seconds of the 04 handoff.
  const keepGrowthWorld = shouldKeepGrowthWorld(scene, elapsed)
  return <>
    <color attach="background" args={['#080914']} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[-3, 5, 4]} intensity={2.4} color="#FFF0E8" />
    <directionalLight position={[3, 1, -2]} intensity={1.1} color="#B9A4E8" />
    {keepGrowthWorld && <GrowthScene key="persistent-growth-world" {...props} environmentOnly={scene !== 'growth'} />}
    <Suspense fallback={null}><AnimatedLily {...props} onParticleSource={publishLilyParticleSource} /></Suspense>
    <BloomGestureTarget {...props} />
    <GalaxyExperience {...props} />
    {scene === 'identity' && (lilyParticleSource ? <Suspense fallback={<IdentityLoading runtime={props.runtime} />}>
      <IdentityScene key={`${scene}:${props.state.revision}`} {...props} particleSource={lilyParticleSource} />
    </Suspense> : <IdentityLoading runtime={props.runtime} />)}
    {Scene && <Scene key={`${scene}:${props.state.revision}`} {...props} />}
  </>
}
