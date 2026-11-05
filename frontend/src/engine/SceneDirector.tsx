import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { AmbientLight, DirectionalLight } from 'three'
import type { SceneProps } from './sceneTypes'
import type { FilmRuntime } from './runtime'
import { PrologueScene } from '../scenes/PrologueScene'
import { GrowthScene } from '../scenes/GrowthScene'
import { BloomScene } from '../scenes/BloomScene'
import { GalleryScene } from '../scenes/GalleryScene'
import { EyeScene } from '../scenes/EyeScene'
import { CosmosScene } from '../scenes/CosmosScene'
import { GreetingScene } from '../scenes/GreetingScene'
import { EndingScene } from '../scenes/EndingScene'
import { AnimatedLily } from '../scenes/lily/AnimatedLily'
import type { LilySurfaceSource } from '../scenes/lily/particleSource'
import { LilyDissolveParticles } from '../scenes/lily/LilyDissolveParticles'
import { createLilyDissolveUniforms } from '../scenes/lily/dissolve'
import { GalaxyExperience } from '../scenes/galaxy/GalaxyExperience'
import { shouldKeepGrowthWorld } from './sceneContinuity'
import { getGrowthSceneFrames } from './filmConfig'
import { getGrowthProgress } from '../scenes/growth/seedProcedure'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getSceneLighting } from './sceneLighting'


const modules = { prologue: PrologueScene, bloom: BloomScene, gallery: GalleryScene, eye: EyeScene, cosmos: CosmosScene, greeting: GreetingScene, ending: EndingScene }

function IdentityLoading({ runtime }: { runtime: FilmRuntime }) {
  useLayoutEffect(() => runtime.hold(), [runtime])
  return null
}

export function SceneDirector(props: SceneProps) {
  const { scene, elapsed } = props.state
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const openingScene = scene === 'prologue' || scene === 'growth' || scene === 'bloom' || scene === 'identity'
  const growthFrames = useMemo(() => scene === 'growth' ? getGrowthSceneFrames(config.scenes.growth) : null,
    [config.scenes.growth, scene])
  const lighting = getSceneLighting(scene, config.scenes.gallery.coldLightIntensity, 0)
  const Scene = scene === 'growth' || scene === 'identity' ? null : modules[scene]
  const ambientLight = useRef<AmbientLight>(null)
  const keyLight = useRef<DirectionalLight>(null)
  const fillLight = useRef<DirectionalLight>(null)
  const [lilyParticleSource, setLilyParticleSource] = useState<LilySurfaceSource | null>(null)
  const dissolveUniforms = useMemo(() => createLilyDissolveUniforms(), [])
  const publishLilyParticleSource = useCallback((source: LilySurfaceSource) => {
    setLilyParticleSource((current) => current ?? source)
  }, [])
  useLayoutEffect(() => {
    if (scene !== 'growth' || !growthFrames) return
    const update = (time: number) => {
      const current = getSceneLighting(scene, config.scenes.gallery.coldLightIntensity,
        getGrowthProgress(time, growthFrames.moonlight), getGrowthProgress(time, growthFrames.settle))
      if (ambientLight.current) ambientLight.current.intensity = current.ambientIntensity
      if (keyLight.current) keyLight.current.intensity = current.keyIntensity
      if (fillLight.current) fillLight.current.intensity = current.fillIntensity
    }
    update(props.runtime.time)
    return props.runtime.subscribeFrame(update)
  }, [config.scenes.gallery.coldLightIntensity, growthFrames, props.runtime, scene, props.state.revision])
  // Keep the same world, lily and moonlight through the bloom and early 04 handoff.
  const keepGrowthWorld = shouldKeepGrowthWorld(scene, elapsed, config.scenes.identity.dissolveDuration)
  return <>
    {!openingScene && <color attach="background" args={['#080914']} />}
    <ambientLight ref={ambientLight} intensity={lighting.ambientIntensity} />
    <directionalLight ref={keyLight} position={[-3, 5, 4]} intensity={lighting.keyIntensity} color={lighting.keyColor} />
    <directionalLight ref={fillLight} position={[3, 1, -2]} intensity={lighting.fillIntensity} color={lighting.fillColor} />
    {keepGrowthWorld && <GrowthScene key="persistent-growth-world" {...props} environmentOnly={scene !== 'growth'} />}
    <Suspense fallback={null}><AnimatedLily {...props} onParticleSource={publishLilyParticleSource} dissolveUniforms={dissolveUniforms} /></Suspense>
    <GalaxyExperience {...props} />
    {scene === 'identity' && (lilyParticleSource
      ? <LilyDissolveParticles source={lilyParticleSource} uniforms={dissolveUniforms} runtime={props.runtime} low={props.state.quality === 'low' || props.reducedMotion} reducedMotion={props.reducedMotion} />
      : <IdentityLoading runtime={props.runtime} />)}
    {Scene && <Scene key={`${scene}:${props.state.revision}`} {...props} />}
  </>
}
