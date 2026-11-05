import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, GLSL3, Group, MeshBasicMaterial, RawShaderMaterial, Sphere, Vector2, Vector3, type Mesh, type ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { getBloomSceneFrames } from '../engine/filmConfig'
import { getIdentityEnvironmentOpacity, shouldMountGrowthClouds } from '../engine/sceneContinuity'
import { useSceneAnimation } from './shared/animation'
import { getGrowthFrames, getGrowthViewportHeight, getSeedCorePose, getSeedFallHeightMultiplier, getSeedParticleCount, getSeedPose, getSeedShellCenterY, getSeedShatterOpacity, sampleSeedParticleSeeds, SEED_ROOT, SEED_SHELL_HALF_HEIGHT, type GrowthSettings } from './growth/seedProcedure'
import { coreFragment, haloFragment, impactWaveFragment, particleFragment, particleVertex, seedFragment, seedSurfaceVertex, surfaceVertex } from './growth/seedShaders'
import { createSeedParticleReferences } from './growth/seedTargets'
import { RecStudioParticleSimulation } from './growth/recstudioSimulation'
import { seedPointsFragmentShader, seedPointsVertexShader } from './growth/recstudioParticleShaders'
import { FloatingIsland } from './growth/FloatingIsland'
import { GrowthClouds } from './growth/GrowthClouds'
import { GrowthMoonlight } from './growth/GrowthMoonlight'
import { shouldUseGrowthShadows } from './growth/sceneShadows'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import type { FilmRuntime } from '../engine/runtime'

type SimulationRef = { current: RecStudioParticleSimulation | null }
type MatterSyncRef = { current: ((time: number, settings: GrowthSettings) => void) | null }

function SeedMatter({ count, settings, runtime, simulationRef, syncRef, gpuReady, opacityRef, onStatus }: {
  count: number
  settings: GrowthSettings
  runtime: FilmRuntime
  simulationRef: SimulationRef
  syncRef: MatterSyncRef
  gpuReady: boolean
  opacityRef: { current: number }
  onStatus(ready: boolean): void
}) {
  const renderer = useThree(({ gl }) => gl)
  const dpr = useThree(({ viewport }) => viewport.dpr)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const dprRef = useRef(dpr)
  const settingsRef = useRef(settings)
  const materialRef = useRef<RawShaderMaterial | null>(null)
  const side = Math.round(Math.sqrt(count))
  const geometry = useMemo(() => {
    const refs = createSeedParticleReferences(count, side)
    const particleGeometry = new BufferGeometry()
    particleGeometry.setAttribute('position', new BufferAttribute(refs.positions, 3))
    particleGeometry.setAttribute('aRef', new BufferAttribute(refs.references, 2))
    particleGeometry.boundingSphere = new Sphere(new Vector3(), 2)
    return particleGeometry
  }, [count, side])
  const uniforms = useMemo(() => ({
    uPosition: { value: null }, uVelocity: { value: null }, uTarget: { value: null },
    uSize: { value: 1 }, uPixelRatio: { value: 1 },
    uTime: { value: 0 }, uFormationProgress: { value: 0 }, uFormationDuration: { value: 1 },
    uPearlColor: { value: new Color() }, uRoseColor: { value: new Color() },
    uLavenderColor: { value: new Color() }, uOpacity: { value: 0 },
  }), [])

  const sync = useCallback((time: number, nextSettings: GrowthSettings) => {
    const simulation = simulationRef.current
    const material = materialRef.current
    if (!simulation || !material) return
    simulation.advance(time, nextSettings)
    const uniforms = material.uniforms
    uniforms.uPosition!.value = simulation.positionTexture
    uniforms.uVelocity!.value = simulation.velocityTexture
    uniforms.uTarget!.value = simulation.targetTextureView
    uniforms.uSize!.value = nextSettings.particleSize * 5.2
    uniforms.uPixelRatio!.value = dprRef.current
    uniforms.uTime!.value = Math.max(0, time)
    uniforms.uFormationProgress!.value = Math.min(1, Math.max(0, time / nextSettings.formationDuration))
    uniforms.uFormationDuration!.value = nextSettings.formationDuration
    uniforms.uOpacity!.value = nextSettings.particleOpacity * opacityRef.current
    ;(uniforms.uPearlColor!.value as Color).set(nextSettings.pearlColor)
    ;(uniforms.uRoseColor!.value as Color).set(nextSettings.roseColor)
    ;(uniforms.uLavenderColor!.value as Color).set(nextSettings.lavenderColor)
  }, [simulationRef, opacityRef])

  useLayoutEffect(() => { dprRef.current = dpr }, [dpr])
  useLayoutEffect(() => { settingsRef.current = settings }, [settings])

  useLayoutEffect(() => {
    let simulation: RecStudioParticleSimulation | null = null
    try {
      const initialSettings = settingsRef.current
      simulation = new RecStudioParticleSimulation(renderer, side, initialSettings)
      simulationRef.current = simulation
      simulation.advance(runtime.time, initialSettings)
      sync(runtime.time, initialSettings)
      onStatus(true)
      invalidate()
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Scene 02 particle simulation fell back to its analytic seed.', error)
      simulation?.dispose()
      simulationRef.current = null
      onStatus(false)
    }
    return () => {
      simulationRef.current?.dispose()
      simulationRef.current = null
    }
  }, [count, invalidate, onStatus, renderer, runtime, side, simulationRef, sync])

  useLayoutEffect(() => {
    syncRef.current = sync
    sync(runtime.time, settings)
    invalidate()
    return () => { if (syncRef.current === sync) syncRef.current = null }
  }, [dpr, gpuReady, invalidate, runtime, settings, sync, syncRef])

  useLayoutEffect(() => () => { geometry.dispose() }, [geometry])
  return gpuReady ? <points geometry={geometry} frustumCulled={false}>
    <rawShaderMaterial
      ref={materialRef}
      glslVersion={GLSL3}
      vertexShader={seedPointsVertexShader}
      fragmentShader={seedPointsFragmentShader}
      uniforms={uniforms}
      transparent
      depthTest={false}
      depthWrite={false}
      toneMapped={false}
      blending={AdditiveBlending}
    />
  </points> : null
}

/** Analytic GPU trajectories: no particle histories, React frame updates or timers. */
function SeedParticles({ mode, count, materialRef, fallRange, impactRadius, impactStrength, impactLifetime, orbitCount, orbitRadius, orbitTilt, orbitSpeed, formationDuration, seedFallAcceleration, seedFallHeight, seedTrailSpread, seedTrailLifetime, seedTrailLiftSpeed }: {
  mode: number
  count: number
  materialRef: RefObject<ShaderMaterial | null>
  fallRange: readonly [number, number]
  impactRadius: number
  impactStrength: number
  impactLifetime: number
  orbitCount: number
  orbitRadius: number
  orbitTilt: number
  orbitSpeed: number
  formationDuration: number
  seedFallAcceleration: number
  seedFallHeight: number
  seedTrailSpread: number
  seedTrailLifetime: number
  seedTrailLiftSpeed: number
}) {
  const positions = useMemo(() => sampleSeedParticleSeeds(count), [count])
  const uniforms = useMemo(() => ({
    time: { value: 0 }, opacity: { value: 0 }, mode: { value: mode }, height: { value: 1 }, reduced: { value: 0 }, dpr: { value: 1 },
    fallRange: { value: new Vector2(...fallRange) }, impactRadius: { value: impactRadius }, impactStrength: { value: impactStrength }, impactLifetime: { value: impactLifetime },
    orbitCount: { value: orbitCount }, orbitRadius: { value: orbitRadius }, orbitTilt: { value: orbitTilt }, orbitSpeed: { value: orbitSpeed }, formationDuration: { value: formationDuration }, orbitAbsorption: { value: 0 },
    seedFallAcceleration: { value: seedFallAcceleration }, seedFallHeight: { value: seedFallHeight },
    seedTrailSpread: { value: seedTrailSpread }, seedTrailLifetime: { value: seedTrailLifetime }, seedTrailLiftSpeed: { value: seedTrailLiftSpeed },
    impactOriginY: { value: 0 },
  }), [mode, fallRange, impactRadius, impactLifetime, impactStrength, orbitCount, orbitRadius, orbitSpeed, orbitTilt, formationDuration, seedFallAcceleration, seedFallHeight, seedTrailSpread, seedTrailLifetime, seedTrailLiftSpeed])
  return <points frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial ref={materialRef} vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
  </points>
}

/** Scene 02. The unchanged world root is also the future flower-model anchor. */
export function GrowthScene({ state, runtime, reducedMotion, environmentOnly = false, nightEstablished = false }: SceneProps & { environmentOnly?: boolean; nightEstablished?: boolean }) {
  const height = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const dpr = useThree(({ viewport }) => viewport.dpr)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const growthSettings = config.scenes.growth
  const seed = useRef<Group>(null)
  const coreAnchor = useRef<Group>(null)
  const shell = useRef<ShaderMaterial>(null)
  const core = useRef<ShaderMaterial>(null)
  const halo = useRef<ShaderMaterial>(null)
  const mound = useRef<Mesh>(null)
  const moundMaterial = useRef<MeshBasicMaterial>(null)
  const impactWave = useRef<Mesh>(null)
  const impactWaveMaterial = useRef<ShaderMaterial>(null)
  const islandOpacity = useRef(1)
  const environmentOpacity = useRef(1)
  const moonlightProgress = useRef(0)
  const orbit = useRef<ShaderMaterial>(null)
  const trail = useRef<ShaderMaterial>(null)
  const sparks = useRef<ShaderMaterial>(null)
  const seedMatterOpacity = useRef(1)
  const simulationRef = useRef<RecStudioParticleSimulation | null>(null)
  const matterSyncRef = useRef<((time: number, settings: GrowthSettings) => void) | null>(null)
  const [gpuStatus, setGpuStatus] = useState<'pending' | 'ready' | 'fallback'>('pending')
  const setMatterStatus = useCallback((ready: boolean) => setGpuStatus(ready ? 'ready' : 'fallback'), [])
  // Stable uniform cells survive paused quality/viewport changes.
  const shellUniforms = useMemo(() => ({ opacity: { value: 0 }, time: { value: 0 } }), [])
  const haloUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const coreUniforms = useMemo(() => ({ opacity: { value: 0 }, time: { value: 0 }, intensity: { value: 1 } }), [])
  const impactWaveUniforms = useMemo(() => ({ uOpacity: { value: 0 }, uImpactProgress: { value: 0 }, uImpactStrength: { value: 0 } }), [])
  const profile = useMemo(() => Array.from({ length: 49 }, (_, i) => {
    const v = i / 48
    const sine = Math.sin(v * Math.PI)
    const radial = 0.4 * sine ** 0.58 * (1 + 0.1 * Math.cos(v * Math.PI) + 0.025 * Math.sin(v * Math.PI * 2))
    const vertical = (v * 2 - 1) * SEED_SHELL_HALF_HEIGHT + 0.025 * sine * Math.sin(v * Math.PI * 1.5)
    return new Vector2(radial, vertical)
  }), [])
  const low = state.quality === 'low'
  const particleCount = getSeedParticleCount(state.quality, growthSettings.particleQuality)
  const growthFrames = useMemo(() => getGrowthFrames(growthSettings), [growthSettings])
  const effectiveSeedFallHeight = getSeedFallHeightMultiplier(growthSettings.seedFallHeight, reducedMotion)
  const particleSettings = {
    impactRadius: growthSettings.seedImpactRadius,
    impactStrength: growthSettings.seedImpactStrength,
    impactLifetime: growthSettings.seedImpactLifetime,
    orbitCount: growthSettings.seedOrbitCount,
    orbitRadius: growthSettings.seedOrbitRadius,
    orbitTilt: growthSettings.seedOrbitTilt,
    orbitSpeed: growthSettings.seedOrbitSpeed,
    formationDuration: growthSettings.formationDuration,
    seedFallAcceleration: growthSettings.seedFallAcceleration,
    seedFallHeight: effectiveSeedFallHeight,
    seedTrailSpread: growthSettings.seedTrailSpread,
    seedTrailLifetime: growthSettings.seedTrailLifetime,
    seedTrailLiftSpeed: growthSettings.seedTrailLiftSpeed,
  }
  const fallRange = growthFrames.fall
  const identityScene = state.scene === 'identity'

  const draw = useCallback((time: number) => {
    const frames = growthFrames
    const poseTime = environmentOnly ? frames.duration : time
    const pose = getSeedPose(poseTime, height, reducedMotion, growthSettings)
    const seedVisualOpacity = pose.seedOpacity * getSeedShatterOpacity(time, frames.fall[1], growthSettings.seedImpactLifetime, reducedMotion)
    seedMatterOpacity.current = seedVisualOpacity
    const worldOpacity = identityScene ? getIdentityEnvironmentOpacity(time, config.scenes.identity.dissolveDuration) : 1
    environmentOpacity.current = worldOpacity
    islandOpacity.current = worldOpacity
    moonlightProgress.current = pose.moonlight
    if (!environmentOnly) {
      matterSyncRef.current?.(time, growthSettings)
      for (const [material, opacity] of [[orbit.current, pose.orbitOpacity * 0.86], [trail.current, pose.trailOpacity], [sparks.current, pose.sparkOpacity]] as const) {
        if (material) {
          material.uniforms.time!.value = time
          material.uniforms.opacity!.value = opacity
          material.uniforms.height!.value = height
          material.uniforms.reduced!.value = +reducedMotion
          material.uniforms.dpr!.value = dpr
          ;(material.uniforms.fallRange!.value as Vector2).set(...fallRange)
          material.uniforms.impactRadius!.value = growthSettings.seedImpactRadius
          material.uniforms.impactStrength!.value = growthSettings.seedImpactStrength
          material.uniforms.impactLifetime!.value = growthSettings.seedImpactLifetime
          material.uniforms.orbitCount!.value = growthSettings.seedOrbitCount
          material.uniforms.orbitRadius!.value = growthSettings.seedOrbitRadius
          material.uniforms.orbitTilt!.value = growthSettings.seedOrbitTilt
          material.uniforms.orbitSpeed!.value = growthSettings.seedOrbitSpeed
          material.uniforms.formationDuration!.value = growthSettings.formationDuration
          material.uniforms.orbitAbsorption!.value = pose.orbitAbsorption
          material.uniforms.seedFallAcceleration!.value = growthSettings.seedFallAcceleration
          material.uniforms.seedFallHeight!.value = effectiveSeedFallHeight
          material.uniforms.seedTrailSpread!.value = growthSettings.seedTrailSpread
          material.uniforms.seedTrailLifetime!.value = growthSettings.seedTrailLifetime
          material.uniforms.seedTrailLiftSpeed!.value = growthSettings.seedTrailLiftSpeed
          material.uniforms.impactOriginY!.value = getSeedShellCenterY(pose)
        }
      }
      if (seed.current) {
        seed.current.position.set(0, getSeedShellCenterY(pose), 0)
        seed.current.scale.setScalar(pose.seedSize)
        seed.current.rotation.set(pose.tumbleAngle, pose.spinAngle, pose.wobbleAngle)
        seed.current.visible = seedVisualOpacity > 0.001
      }
      if (coreAnchor.current) {
        const corePose = getSeedCorePose(pose, growthSettings.grassHeight)
        coreAnchor.current.position.set(0, corePose.positionY, 0.015)
        coreAnchor.current.scale.setScalar(corePose.scale)
        coreAnchor.current.visible = pose.coreOpacity > 0.001
      }
      if (shell.current) {
        const shellReveal = pose.formation * (0.26 + 0.74 * pose.formation)
        shell.current.uniforms.opacity!.value = shellReveal * seedVisualOpacity * 0.82
        shell.current.uniforms.time!.value = time
      }
      if (core.current) {
        core.current.uniforms.opacity!.value = pose.coreOpacity
        core.current.uniforms.time!.value = time
        core.current.uniforms.intensity!.value = growthSettings.coreGlow
      }
      if (halo.current) halo.current.uniforms.opacity!.value = pose.coreOpacity * (0.28 + pose.formation * 0.38)
    }
    if (mound.current) {
      mound.current.visible = pose.mound > 0.001
      const moundRadius = growthSettings.seedImpactRadius * 0.24
      mound.current.scale.set(moundRadius, Math.max(0.0001, pose.mound * 0.045), moundRadius)
    }
    if (moundMaterial.current) moundMaterial.current.opacity = pose.mound * 0.16 * worldOpacity
    if (impactWave.current) impactWave.current.scale.set(growthSettings.seedImpactRadius, 1, growthSettings.seedImpactRadius)
    if (impactWaveMaterial.current) {
      impactWaveMaterial.current.uniforms.uOpacity!.value = pose.impactOpacity * worldOpacity
      impactWaveMaterial.current.uniforms.uImpactProgress!.value = pose.impactProgress
      impactWaveMaterial.current.uniforms.uImpactStrength!.value = 1
    }
  }, [height, dpr, reducedMotion, growthSettings, growthFrames, fallRange, effectiveSeedFallHeight, environmentOnly, identityScene, config.scenes.identity.dissolveDuration])

  useSceneAnimation(runtime, growthFrames.duration, draw)
  return <group position={SEED_ROOT}>
    {!environmentOnly && <group key="growth-seed">
      <SeedParticles mode={0} count={low ? 28 : 76} materialRef={orbit} fallRange={fallRange} {...particleSettings} />
      {!reducedMotion && <>
        <SeedParticles mode={1} count={low ? Math.max(6, Math.round(growthSettings.seedTrailParticleCount * 0.5)) : growthSettings.seedTrailParticleCount} materialRef={trail} fallRange={fallRange} {...particleSettings} />
        {growthSettings.seedImpactParticles > 0 && <SeedParticles mode={2} count={low ? Math.ceil(growthSettings.seedImpactParticles * 0.6) : growthSettings.seedImpactParticles} materialRef={sparks} fallRange={fallRange} {...particleSettings} />}
      </>}
      <group ref={seed}>
        <SeedMatter count={particleCount} settings={growthSettings} runtime={runtime} simulationRef={simulationRef} syncRef={matterSyncRef} opacityRef={seedMatterOpacity} onStatus={setMatterStatus} gpuReady={gpuStatus === 'ready'} />
        <mesh>
          <latheGeometry args={[profile, low ? 32 : 64]} />
          <shaderMaterial ref={shell} vertexShader={seedSurfaceVertex} fragmentShader={seedFragment} uniforms={shellUniforms} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      <group ref={coreAnchor} visible={false}>
        <mesh scale={[0.62, 1.6, 1]}>
          <planeGeometry />
          <shaderMaterial ref={core} vertexShader={surfaceVertex} fragmentShader={coreFragment} uniforms={coreUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={[1.5, 2.35, 1]}>
          <planeGeometry />
          <shaderMaterial ref={halo} vertexShader={surfaceVertex} fragmentShader={haloFragment} uniforms={haloUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>}
    <group key="growth-environment">
      {shouldMountGrowthClouds(environmentOnly) && <GrowthClouds runtime={runtime} reducedMotion={reducedMotion} frames={growthFrames} environmentOpacity={environmentOpacity} settings={growthSettings} nightEstablished={nightEstablished} />}
      <FloatingIsland
        runtime={runtime}
        radius={growthSettings.islandRadius}
        thickness={growthSettings.islandThickness}
        depth={growthSettings.islandDepth}
        roughness={growthSettings.islandRoughness}
        grassDensity={growthSettings.grassDensity}
        grassHeight={growthSettings.grassHeight}
        windStrength={growthSettings.windStrength}
        windSpeed={growthSettings.windSpeed}
        reducedMotion={reducedMotion}
        opacity={islandOpacity}
        moonlightProgress={moonlightProgress}
        shadowsEnabled={shouldUseGrowthShadows(state.scene)}
      />
      <mesh ref={mound} position={[0, 0, 0]} scale={[0.115, 0.0001, 0.115]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial ref={moundMaterial} color="#EBC68F" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={impactWave} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial ref={impactWaveMaterial} vertexShader={surfaceVertex} fragmentShader={impactWaveFragment} uniforms={impactWaveUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <GrowthMoonlight
        settings={growthSettings}
        runtime={runtime}
        growthProgress={moonlightProgress}
        environmentOpacity={environmentOpacity}
        shadowsEnabled={shouldUseGrowthShadows(state.scene)}
        scene={state.scene}
        bloomDuration={getBloomSceneFrames(config.scenes.bloom).duration}
      />
    </group>
  </group>
}
