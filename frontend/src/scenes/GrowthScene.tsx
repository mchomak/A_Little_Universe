import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, GLSL3, Group, MeshBasicMaterial, RawShaderMaterial, Sphere, Vector2, Vector3, type Mesh, type ShaderMaterial, type SpotLight } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { getIdentityEnvironmentOpacity } from '../engine/sceneContinuity'
import { useSceneAnimation } from './shared/animation'
import { getGrowthFrames, getGrowthViewportHeight, getSeedParticleCount, getSeedPose, sampleSeedParticleSeeds, SEED_ROOT, type GrowthSettings } from './growth/seedProcedure'
import { coreFragment, haloFragment, moonFragment, particleFragment, particleVertex, seedFragment, surfaceVertex } from './growth/seedShaders'
import { createSeedParticleReferences } from './growth/seedTargets'
import { RecStudioParticleSimulation } from './growth/recstudioSimulation'
import { seedPointsFragmentShader, seedPointsVertexShader } from './growth/recstudioParticleShaders'
import { FloatingIsland } from './growth/FloatingIsland'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import type { FilmRuntime } from '../engine/runtime'

type SimulationRef = { current: RecStudioParticleSimulation | null }
type MatterSyncRef = { current: ((time: number, settings: GrowthSettings) => void) | null }

function SeedMatter({ count, settings, runtime, simulationRef, syncRef, gpuReady, onStatus }: {
  count: number
  settings: GrowthSettings
  runtime: FilmRuntime
  simulationRef: SimulationRef
  syncRef: MatterSyncRef
  gpuReady: boolean
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
    uniforms.uOpacity!.value = nextSettings.particleOpacity
    ;(uniforms.uPearlColor!.value as Color).set(nextSettings.pearlColor)
    ;(uniforms.uRoseColor!.value as Color).set(nextSettings.roseColor)
    ;(uniforms.uLavenderColor!.value as Color).set(nextSettings.lavenderColor)
  }, [simulationRef])

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
function SeedParticles({ mode, count, materialRef, fallRange }: {
  mode: number; count: number; materialRef: RefObject<ShaderMaterial | null>; fallRange: readonly [number, number]
}) {
  const positions = useMemo(() => sampleSeedParticleSeeds(count), [count])
  const uniforms = useMemo(() => ({ time: { value: 0 }, opacity: { value: 0 }, mode: { value: mode }, height: { value: 1 }, reduced: { value: 0 }, dpr: { value: 1 }, fallRange: { value: new Vector2(...fallRange) } }), [mode, fallRange])
  return <points frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial ref={materialRef} vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
  </points>
}

/** Scene 02. The unchanged world root is also the future flower-model anchor. */
export function GrowthScene({ state, runtime, reducedMotion, environmentOnly = false }: SceneProps & { environmentOnly?: boolean }) {
  const height = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const dpr = useThree(({ viewport }) => viewport.dpr)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const growthSettings = config.scenes.growth
  const seed = useRef<Group>(null)
  const shell = useRef<ShaderMaterial>(null)
  const core = useRef<ShaderMaterial>(null)
  const halo = useRef<ShaderMaterial>(null)
  const mound = useRef<Mesh>(null)
  const moundMaterial = useRef<MeshBasicMaterial>(null)
  const moon = useRef<SpotLight>(null)
  const islandOpacity = useRef(1)
  const target = useRef<Group>(null)
  const orbit = useRef<ShaderMaterial>(null)
  const trail = useRef<ShaderMaterial>(null)
  const sparks = useRef<ShaderMaterial>(null)
  const moonBeam = useRef<ShaderMaterial>(null)
  const simulationRef = useRef<RecStudioParticleSimulation | null>(null)
  const matterSyncRef = useRef<((time: number, settings: GrowthSettings) => void) | null>(null)
  const [gpuStatus, setGpuStatus] = useState<'pending' | 'ready' | 'fallback'>('pending')
  const setMatterStatus = useCallback((ready: boolean) => setGpuStatus(ready ? 'ready' : 'fallback'), [])
  // Stable uniform cells survive paused quality/viewport changes.
  const shellUniforms = useMemo(() => ({ opacity: { value: 0 }, time: { value: 0 } }), [])
  const haloUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const coreUniforms = useMemo(() => ({ opacity: { value: 0 }, time: { value: 0 }, intensity: { value: 1 } }), [])
  const moonUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const profile = useMemo(() => Array.from({ length: 49 }, (_, i) => {
    const v = i / 48
    return new Vector2(0.36 * Math.sin(v * Math.PI) ** 0.85 * (1 + 0.12 * Math.cos(v * Math.PI)), (v * 2 - 1) * 0.84)
  }), [])
  const low = state.quality === 'low'
  const particleCount = getSeedParticleCount(state.quality, growthSettings.particleQuality)
  const fallRange = useMemo(() => getGrowthFrames(growthSettings).fall, [growthSettings])
  const identityScene = state.scene === 'identity'

  const draw = useCallback((time: number) => {
    const frames = getGrowthFrames(growthSettings)
    const poseTime = environmentOnly ? frames.duration : time
    const pose = getSeedPose(poseTime, height, reducedMotion, growthSettings)
    const environmentOpacity = identityScene ? getIdentityEnvironmentOpacity(time, config.scenes.identity.dissolveDuration) : 1
    islandOpacity.current = environmentOpacity
    if (!environmentOnly) {
      matterSyncRef.current?.(time, growthSettings)
      for (const [material, opacity] of [[orbit.current, 0.95], [trail.current, pose.trailOpacity], [sparks.current, pose.sparkOpacity]] as const) {
        if (material) {
          material.uniforms.time!.value = time
          material.uniforms.opacity!.value = opacity
          material.uniforms.height!.value = height
          material.uniforms.reduced!.value = +reducedMotion
          material.uniforms.dpr!.value = dpr
          ;(material.uniforms.fallRange!.value as Vector2).set(...fallRange)
        }
      }
      if (seed.current) {
        seed.current.position.set(0, pose.seedY + pose.seedSize * 0.84 * pose.fall, 0)
        seed.current.scale.setScalar(pose.seedSize)
        seed.current.rotation.set(0, reducedMotion ? 0 : time * 0.24, reducedMotion ? 0 : Math.sin(time * 1.8) * 0.035 * (1 - pose.fall))
        seed.current.visible = pose.seedOpacity > 0
      }
      if (shell.current) {
        const shellReveal = pose.formation * (0.26 + 0.74 * pose.formation)
        shell.current.uniforms.opacity!.value = shellReveal * pose.seedOpacity * 0.82
        shell.current.uniforms.time!.value = time
      }
      if (core.current) {
        core.current.uniforms.opacity!.value = pose.lightTransfer * pose.seedOpacity
        core.current.uniforms.time!.value = time
        core.current.uniforms.intensity!.value = growthSettings.coreGlow
      }
      if (halo.current) halo.current.uniforms.opacity!.value = pose.lightTransfer * pose.seedOpacity * (0.28 + pose.formation * 0.38)
    }
    if (moonBeam.current) moonBeam.current.uniforms.opacity!.value = pose.moonlight * environmentOpacity
    if (mound.current) {
      mound.current.visible = pose.mound > 0
      mound.current.scale.set(0.09, Math.max(0.0001, pose.mound * 0.045), 0.09)
    }
    if (moundMaterial.current) moundMaterial.current.opacity = pose.mound * 0.16 * environmentOpacity
    if (moon.current) { moon.current.intensity = pose.moonlight * 4 * environmentOpacity; if (target.current) moon.current.target = target.current }
  }, [height, dpr, reducedMotion, growthSettings, fallRange, environmentOnly, identityScene, config.scenes.identity.dissolveDuration])

  useSceneAnimation(runtime, getGrowthFrames(growthSettings).duration, draw)
  return <group position={SEED_ROOT}>
    {!environmentOnly && <group key="growth-seed">
      {gpuStatus !== 'ready' && <SeedParticles mode={0} count={low ? 28 : 76} materialRef={orbit} fallRange={fallRange} />}
      {!reducedMotion && <>
        <SeedParticles mode={1} count={low ? 12 : 30} materialRef={trail} fallRange={fallRange} />
        <SeedParticles mode={2} count={low ? 38 : 110} materialRef={sparks} fallRange={fallRange} />
      </>}
      <group ref={seed}>
        <SeedMatter count={particleCount} settings={growthSettings} runtime={runtime} simulationRef={simulationRef} syncRef={matterSyncRef} onStatus={setMatterStatus} gpuReady={gpuStatus === 'ready'} />
        <mesh>
          <latheGeometry args={[profile, low ? 32 : 64]} />
          <shaderMaterial ref={shell} vertexShader={surfaceVertex} fragmentShader={seedFragment} uniforms={shellUniforms} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
        <mesh scale={[0.62, 1.6, 1]} position={[0, -0.05, 0.02]}>
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
      <FloatingIsland runtime={runtime} radius={growthSettings.islandRadius} grassDensity={growthSettings.grassDensity} windSpeed={growthSettings.windSpeed} reducedMotion={reducedMotion} opacity={islandOpacity} />
      <mesh ref={mound} position={[0, 0, 0]} scale={[0.115, 0.0001, 0.115]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial ref={moundMaterial} color="#EBC68F" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={target} />
      <spotLight ref={moon} position={[-0.65, 5.5, 1.0]} color="#BDCEFF" intensity={0} angle={0.24} penumbra={1} decay={0} />
      <mesh position={[-0.15, 2.6, -0.35]} rotation={[0, 0, -0.06]}>
        <planeGeometry args={[3.4, 5.7]} />
        <shaderMaterial ref={moonBeam} vertexShader={surfaceVertex} fragmentShader={moonFragment} uniforms={moonUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  </group>
}
