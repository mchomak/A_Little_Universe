import { Suspense, useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { SceneProps } from './sceneTypes'
import type { FilmRuntime } from './runtime'
import { getGrowthSceneFrames } from './filmConfig'
import { clearOpeningSceneBackground } from './openingSceneBackground'
import { PrologueScene } from '../scenes/PrologueScene'
import { GrowthScene } from '../scenes/GrowthScene'
import { BloomScene } from '../scenes/BloomScene'
import { GalleryScene } from '../scenes/GalleryScene'
import { CosmosScene } from '../scenes/CosmosScene'
import { GreetingScene } from '../scenes/GreetingScene'
import { EndingScene } from '../scenes/EndingScene'
import { AnimatedLily } from '../scenes/lily/AnimatedLily'
import type { LilySurfaceSource } from '../scenes/lily/particleSource'
import { LilyDissolveParticles } from '../scenes/lily/LilyDissolveParticles'
import { ParticlePreparationStatus } from '../scenes/lily/ParticlePreparationStatus'
import { createLilyDissolveUniforms } from '../scenes/lily/dissolve'
import { GalaxyExperience } from '../scenes/galaxy/GalaxyExperience'
import { shouldKeepGrowthWorld } from './sceneContinuity'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getSceneLighting } from './sceneLighting'
import { GrowthSky } from '../scenes/growth/GrowthSky'


const modules = { prologue: PrologueScene, bloom: BloomScene, gallery: GalleryScene, cosmos: CosmosScene, greeting: GreetingScene, ending: EndingScene }

function IdentityLoading({ runtime }: { runtime: FilmRuntime }) {
  useLayoutEffect(() => runtime.hold(), [runtime])
  return <ParticlePreparationStatus message="Подготавливаем поверхность лилии…" />
}

function IdentitySourceError({ runtime, onRetry }: { runtime: FilmRuntime; onRetry: () => void }) {
  useLayoutEffect(() => runtime.hold(), [runtime])
  return <Html center><div role="alert" style={{ color: 'white', background: '#080914', padding: 16 }}>
    Не удалось подготовить поверхность лилии. <button type="button" onClick={onRetry}>Повторить</button>
  </div></Html>
}

export function SceneDirector(props: SceneProps) {
  const { dispatch, runtime, state } = props
  const { scene, elapsed, revision } = state
  const renderScene = useThree(({ scene: currentScene }) => currentScene)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const openingScene = scene === 'prologue' || scene === 'growth' || scene === 'bloom' || scene === 'identity'
  const lilyScene = scene === 'growth' || scene === 'bloom' || scene === 'identity'
  const growthSkyScene = scene === 'growth' || scene === 'bloom' || scene === 'identity'
  const growthFallRange = useMemo(() => getGrowthSceneFrames(config.scenes.growth).fall, [config.scenes.growth])
  const nightEstablished = scene === 'bloom' || scene === 'identity'
    || (scene === 'growth' && runtime.time >= growthFallRange[1])
  const lighting = getSceneLighting(scene, config.scenes.gallery.coldLightIntensity)
  const Scene = scene === 'growth' || scene === 'identity' ? null : modules[scene]
  const [lilyParticleSource, setLilyParticleSource] = useState<LilySurfaceSource | null>(null)
  const [lilyParticleSourceError, setLilyParticleSourceError] = useState(false)
  const [sourceAttempt, setSourceAttempt] = useState(0)
  const dissolveUniforms = useMemo(() => createLilyDissolveUniforms(), [])
  const publishLilyParticleSource = useCallback((source: LilySurfaceSource) => {
    setLilyParticleSourceError(false)
    setLilyParticleSource((current) => current ?? source)
  }, [])
  const reportLilyParticleSourceError = useCallback(() => setLilyParticleSourceError(true), [])
  const retryLilyParticleSource = useCallback(() => {
    setLilyParticleSourceError(false)
    setSourceAttempt((value) => value + 1)
  }, [])
  const updateIdentityDuration = useCallback((duration: number, canResolve: boolean) => dispatch({
    type: canResolve ? 'set-identity-duration' : 'extend-identity-duration', duration, time: runtime.time, revision,
  }), [dispatch, runtime, revision])
  const setIdentityPreparationPending = useCallback((pending: boolean) => dispatch({
    type: 'set-identity-preparation-pending', pending, time: runtime.time, revision,
  }), [dispatch, runtime, revision])
  // Keep the same world and its island, mound and moonlight through the
  // touch scene and the first seconds of the 04 handoff.
  const keepGrowthWorld = shouldKeepGrowthWorld(scene, elapsed, config.scenes.identity.dissolveDuration)
  useLayoutEffect(() => {
    clearOpeningSceneBackground(renderScene, openingScene)
  }, [openingScene, renderScene])
  return <>
    {!openingScene && <color attach="background" args={['#080914']} />}
    <ambientLight intensity={lighting.ambientIntensity} />
    <directionalLight position={[-3, 5, 4]} intensity={lighting.keyIntensity} color={lighting.keyColor} />
    <directionalLight position={[3, 1, -2]} intensity={lighting.fillIntensity} color={lighting.fillColor} />
    {growthSkyScene && <GrowthSky key="persistent-night-sky" runtime={runtime} fallRange={growthFallRange} nightEstablished={nightEstablished} />}
    {keepGrowthWorld && <GrowthScene key="persistent-growth-world" {...props} environmentOnly={scene !== 'growth'} nightEstablished={nightEstablished} />}
    {lilyScene && <Suspense fallback={null}><AnimatedLily {...props} onParticleSource={publishLilyParticleSource} onParticleSourceError={reportLilyParticleSourceError} sourceAttempt={sourceAttempt} dissolveUniforms={dissolveUniforms} /></Suspense>}
    <GalaxyExperience {...props} />
    {scene === 'identity' && (lilyParticleSource
      ? <LilyDissolveParticles source={lilyParticleSource} uniforms={dissolveUniforms} runtime={props.runtime} low={props.state.quality === 'low' || props.reducedMotion} reducedMotion={props.reducedMotion} onRequiredSceneDuration={updateIdentityDuration} onIdentityPreparationPending={setIdentityPreparationPending} />
      : lilyParticleSourceError
        ? <IdentitySourceError runtime={props.runtime} onRetry={retryLilyParticleSource} />
        : <IdentityLoading runtime={props.runtime} />)}
    {Scene && <Scene key={`${scene}:${props.state.revision}`} {...props} />}
  </>
}
