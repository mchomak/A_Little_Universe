import { useCallback, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Group, MeshBasicMaterial, PointsMaterial, ShaderMaterial, type ColorRepresentation, type Mesh } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { useSceneAnimation } from './shared/animation'
import { Lily } from './shared/Primitives'
import { getGrowthViewportHeight, getSeedPose, sampleSeedParticles, SEED_ROOT } from './growth/seedProcedure'

const SEED_COLORS: [ColorRepresentation, ColorRepresentation] = ['#FFF0E8', '#F4CDD9']
const TRAIL_COUNT = 9
const seedVertexShader = `
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = 2.7;
  }
`
const seedFragmentShader = `
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float radius = length(centered) * 2.0;
    float falloff = exp(-radius * radius * 5.0);
    float edge = 1.0 - smoothstep(0.42, 0.98, radius);
    float alpha = opacity * edge * (0.72 + 0.28 * falloff);
    vec3 color = vColor * (1.0 + falloff * 0.16);
    gl_FragColor = vec4(color, alpha);
  }
`

function makeSeedAttributes(count: number, low: boolean) {
  const particles = sampleSeedParticles(count, low ? 'low' : 'standard')
  const positions = new Float32Array(particles.length * 3)
  const colors = new Float32Array(particles.length * 3)
  const color = new Color()
  particles.forEach((point, index) => {
    positions.set([point.x, point.y, point.z], index * 3)
    color.set(SEED_COLORS[point.pink ? 1 : 0])
    colors.set([color.r, color.g, color.b], index * 3)
  })
  return { positions, colors }
}

function makeTrailGeometry(count = TRAIL_COUNT) {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    const angle = index * 2.399963229728653
    const radius = 0.012 + (index % 3) * 0.008
    positions.set([Math.cos(angle) * radius, index * 0.04, Math.sin(angle) * radius * 0.5], index * 3)
  }
  return positions
}

/** Scene 02 seed pass. The root at SEED_ROOT is the provisional future GLB anchor. */
export function GrowthScene({ state, runtime, reducedMotion }: SceneProps) {
  const viewportHeight = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const root = useRef<Group>(null)
  const plant = useRef<Group>(null)
  const seed = useRef<Group>(null)
  const trailGroup = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const coreMaterial = useRef<MeshBasicMaterial>(null)
  const seedMaterial = useRef<ShaderMaterial>(null)
  const trail = useRef<PointsMaterial>(null)
  const pulse = useRef<MeshBasicMaterial>(null)
  const pulseMesh = useRef<Mesh>(null)
  const seedAttributes = useMemo(() => makeSeedAttributes(22, state.quality === 'low'), [state.quality])
  const seedUniforms = useMemo(() => ({ opacity: { value: 0 } }), [])
  const trailPositions = useMemo(() => makeTrailGeometry(state.quality === 'low' ? 5 : TRAIL_COUNT), [state.quality])

  const draw = useCallback((time: number) => {
    const pose = getSeedPose(time, viewportHeight, reducedMotion)
    root.current?.position.set(...pose.anchor)
    if (seed.current) {
      seed.current.position.set(0, pose.seedY, 0)
      const seedSize = Math.max(0.001, viewportHeight * 0.01)
      seed.current.scale.setScalar(seedSize * (2.15 - pose.formation * 1.15))
      seed.current.visible = time < TIMING.growth.handoff[1] + 0.45
    }
    if (core.current) {
      core.current.scale.setScalar(0.11)
    }
    if (seedMaterial.current) {
      const alpha = seedMaterial.current.uniforms.opacity
      if (alpha) {
        alpha.value = 0.86 * pose.formation * (1 - Math.max(0, pose.handoff))
        seedMaterial.current.visible = alpha.value > 0.001
      }
    }
    if (coreMaterial.current) {
      const sproutMix = Math.min(1, pose.growthWeight / 0.065)
      coreMaterial.current.opacity = pose.lightTransfer * (1 - sproutMix)
    }
    if (trail.current) {
      trail.current.opacity = pose.trailOpacity
      trail.current.visible = pose.trailOpacity > 0.001
    }
    if (trailGroup.current) trailGroup.current.position.set(0, pose.seedY, 0)
    if (plant.current) plant.current.scale.setScalar(Math.max(0.001, pose.growthWeight))
    if (pulse.current && pulseMesh.current) {
      pulse.current.opacity = pose.pulseOpacity
      pulse.current.visible = pose.pulseOpacity > 0.001
      pulseMesh.current.scale.setScalar(pose.pulseScale)
    }
  }, [reducedMotion, viewportHeight])

  useSceneAnimation(runtime, TIMING.growth.duration, draw)
  return <group ref={root} position={SEED_ROOT}>
    <group ref={seed}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[seedAttributes.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[seedAttributes.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={seedMaterial}
          vertexShader={seedVertexShader}
          fragmentShader={seedFragmentShader}
          uniforms={seedUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <mesh ref={core}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial ref={coreMaterial} color="#FFF0E8" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
    <group ref={trailGroup}>
      <points>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[trailPositions, 3]} /></bufferGeometry>
        <pointsMaterial ref={trail} color="#F7E3E8" size={1.8} sizeAttenuation={false} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </points>
    </group>
    <mesh ref={pulseMesh} position={[0, 0, 0.01]} rotation={[0, 0, 0]}>
      <ringGeometry args={[0.075, 0.083, 40]} />
      <meshBasicMaterial ref={pulse} color="#F4CDD9" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
    <group ref={plant}>
      <group position={[0, -SEED_ROOT[1], 0]}><Lily /></group>
    </group>
  </group>
}
