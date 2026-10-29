import { useCallback, useMemo, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, Group, Vector2, type Mesh, type MeshStandardMaterial, type ShaderMaterial, type SpotLight } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { useSceneAnimation } from './shared/animation'
import { Lily } from './shared/Primitives'
import { getGrowthViewportHeight, getSeedPose, sampleSeedParticleSeeds, SEED_ROOT } from './growth/seedProcedure'
import { coreFragment, groundFragment, haloFragment, moonFragment, particleFragment, particleVertex, seedFragment, surfaceVertex } from './growth/seedShaders'

/** Analytic GPU trajectories: no particle histories, React frame updates or timers. */
function SeedParticles({ mode, count, materialRef }: {
  mode: number; count: number; materialRef: RefObject<ShaderMaterial | null>
}) {
  const positions = useMemo(() => sampleSeedParticleSeeds(count), [count])
  const uniforms = useMemo(() => ({ time: { value: 0 }, opacity: { value: 0 }, mode: { value: mode }, height: { value: 1 }, reduced: { value: 0 }, dpr: { value: 1 }, fallRange: { value: new Vector2(...TIMING.growth.fall) } }), [mode])
  return <points frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial ref={materialRef} vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
  </points>
}

/** Scene 02. The unchanged world root is also the future flower-model anchor. */
export function GrowthScene({ state, runtime, reducedMotion }: SceneProps) {
  const height = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const dpr = useThree(({ viewport }) => viewport.dpr)
  const plant = useRef<Group>(null)
  const seed = useRef<Group>(null)
  const shell = useRef<ShaderMaterial>(null)
  const core = useRef<ShaderMaterial>(null)
  const halo = useRef<ShaderMaterial>(null)
  const mound = useRef<Mesh>(null)
  const moundMaterial = useRef<MeshStandardMaterial>(null)
  const moon = useRef<SpotLight>(null)
  const target = useRef<Group>(null)
  const orbit = useRef<ShaderMaterial>(null)
  const trail = useRef<ShaderMaterial>(null)
  const sparks = useRef<ShaderMaterial>(null)
  const ground = useRef<ShaderMaterial>(null)
  const moonBeam = useRef<ShaderMaterial>(null)
  // Stable uniform cells survive paused quality/viewport changes.
  const shellUniforms = useMemo(() => ({ opacity: { value: 0 }, time: { value: 0 } }), [])
  const haloUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const coreUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const groundUniforms = useMemo(() => ({ opacity: { value: 0 }, impact: { value: 0 }, moonlight: { value: 0 } }), [])
  const moonUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const profile = useMemo(() => Array.from({ length: 49 }, (_, i) => {
    const v = i / 48
    return new Vector2(0.36 * Math.sin(v * Math.PI) ** 0.85 * (1 + 0.12 * Math.cos(v * Math.PI)), (v * 2 - 1) * 0.84)
  }), [])
  const low = state.quality === 'low'

  const draw = useCallback((time: number) => {
    const pose = getSeedPose(time, height, reducedMotion)
    for (const [material, opacity] of [[orbit.current, 0.95], [trail.current, pose.trailOpacity], [sparks.current, pose.sparkOpacity]] as const) {
      if (material) {
        material.uniforms.time!.value = time
        material.uniforms.opacity!.value = opacity
        material.uniforms.height!.value = height
        material.uniforms.reduced!.value = +reducedMotion
        material.uniforms.dpr!.value = dpr
      }
    }
    if (seed.current) {
      seed.current.position.set(0, pose.seedY + pose.seedSize * 0.84 * pose.fall, 0)
      seed.current.scale.setScalar(pose.seedSize)
      seed.current.rotation.set(0, reducedMotion ? 0 : time * 0.24, reducedMotion ? 0 : Math.sin(time * 1.8) * 0.035 * (1 - pose.fall))
      seed.current.visible = pose.seedOpacity > 0
    }
    if (shell.current) { shell.current.uniforms.opacity!.value = pose.formation * pose.seedOpacity * 0.9; shell.current.uniforms.time!.value = time }
    if (core.current) core.current.uniforms.opacity!.value = pose.lightTransfer * pose.seedOpacity
    if (halo.current) halo.current.uniforms.opacity!.value = pose.lightTransfer * pose.seedOpacity * (0.4 + pose.formation * 0.5)
    if (ground.current) {
      ground.current.uniforms.opacity!.value = pose.ringOpacity
      ground.current.uniforms.impact!.value = pose.impact
      ground.current.uniforms.moonlight!.value = pose.moonlight
    }
    if (moonBeam.current) moonBeam.current.uniforms.opacity!.value = pose.moonlight
    if (mound.current) {
      mound.current.visible = pose.mound > 0
      mound.current.scale.set(0.09, Math.max(0.0001, pose.mound * 0.045), 0.09)
    }
    if (moundMaterial.current) moundMaterial.current.emissiveIntensity = 0.08 + (1 - pose.moonlight) * 0.25
    if (moon.current) { moon.current.intensity = pose.moonlight * 4; if (target.current) moon.current.target = target.current }
    if (plant.current) plant.current.scale.setScalar(Math.max(0.00001, pose.growthWeight))
  }, [height, dpr, reducedMotion])

  useSceneAnimation(runtime, TIMING.growth.duration, draw)
  return <group position={SEED_ROOT}>
    <SeedParticles mode={0} count={low ? 28 : 76} materialRef={orbit} />
    {!reducedMotion && <>
      <SeedParticles mode={1} count={low ? 12 : 30} materialRef={trail} />
      <SeedParticles mode={2} count={low ? 38 : 110} materialRef={sparks} />
    </>}
    <group ref={seed}>
      <mesh>
        <latheGeometry args={[profile, low ? 32 : 64]} />
        <shaderMaterial ref={shell} vertexShader={surfaceVertex} fragmentShader={seedFragment} uniforms={shellUniforms} transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh scale={[0.62, 1.6, 1]} position={[0, -0.05, 0.02]}>
        <planeGeometry />
        <shaderMaterial ref={core} vertexShader={surfaceVertex} fragmentShader={coreFragment} uniforms={coreUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh scale={[2.5, 3.5, 1]}>
        <planeGeometry />
        <shaderMaterial ref={halo} vertexShader={surfaceVertex} fragmentShader={haloFragment} uniforms={haloUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
    <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.4, 3.4]} />
      <shaderMaterial ref={ground} vertexShader={surfaceVertex} fragmentShader={groundFragment} uniforms={groundUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
    <mesh ref={mound} position={[0, 0, 0]} scale={[0.115, 0.0001, 0.115]}>
      <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial ref={moundMaterial} color="#6B5B4C" emissive="#B9803E" emissiveIntensity={0.3} roughness={0.75} metalness={0.18} />
    </mesh>
    <group ref={target} />
    <spotLight ref={moon} position={[-0.65, 5.5, 1.0]} color="#BDCEFF" intensity={0} angle={0.24} penumbra={1} decay={0} />
    <mesh position={[-0.15, 2.6, -0.35]} rotation={[0, 0, -0.06]}>
      <planeGeometry args={[3.4, 5.7]} />
      <shaderMaterial ref={moonBeam} vertexShader={surfaceVertex} fragmentShader={moonFragment} uniforms={moonUniforms} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
    <group ref={plant} scale={0.00001}>
      <group position={[0, -SEED_ROOT[1], 0]}><Lily /></group>
    </group>
  </group>
}
