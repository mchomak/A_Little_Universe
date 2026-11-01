import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial, type PointLight, type ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { createGrassBladeData, createIslandSideGeometryData, createIslandTopGeometryData, type IslandGeometryData } from './floatingIslandGeometry'

function makeGeometry(data: IslandGeometryData) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
  geometry.setIndex(new BufferAttribute(data.indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

function makeGrassGeometry(count: number, radius: number) {
  const blades = createGrassBladeData(count, radius, 49217)
  const verticesPerBlade = 6
  const positions = new Float32Array(count * verticesPerBlade * 3)
  const roots = new Float32Array(positions.length)
  const colors = new Float32Array(positions.length)
  const heights = new Float32Array(count * verticesPerBlade)
  const phases = new Float32Array(count * verticesPerBlade)
  const yaws = new Float32Array(count * verticesPerBlade)
  const bladePoints = [
    [-0.013, 0, 0], [0.013, 0, 0], [0, 1, 0],
    [0, 0, -0.013], [0, 0, 0.013], [0, 1, 0],
  ] as const

  for (let blade = 0; blade < count; blade += 1) {
    const yaw = blades.yaws[blade]!
    for (let vertex = 0; vertex < verticesPerBlade; vertex += 1) {
      const index = blade * verticesPerBlade + vertex
      const point = bladePoints[vertex]!
      positions[index * 3] = point[0]
      positions[index * 3 + 1] = point[1]
      positions[index * 3 + 2] = point[2]
      roots.set(blades.roots.subarray(blade * 3, blade * 3 + 3), index * 3)
      colors.set(blades.colors.subarray(blade * 3, blade * 3 + 3), index * 3)
      heights[index] = blades.heights[blade]!
      phases[index] = blades.phases[blade]!
      yaws[index] = yaw
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aRoot', new BufferAttribute(roots, 3))
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3))
  geometry.setAttribute('aHeight', new BufferAttribute(heights, 1))
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
  geometry.setAttribute('aYaw', new BufferAttribute(yaws, 1))
  geometry.computeBoundingSphere()
  return geometry
}

const grassVertexShader = `
  attribute vec3 aRoot;
  attribute vec3 aColor;
  attribute float aHeight;
  attribute float aPhase;
  attribute float aYaw;
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTip;
  varying float vOpacity;
  void main() {
    float bladeHeight = position.y;
    float sway = sin(uTime * uWindSpeed + aPhase) * 0.052
      + sin(uTime * uWindSpeed * 0.61 + aPhase * 1.7) * 0.018;
    vec3 blade = vec3(position.x, bladeHeight * aHeight, position.z);
    blade.x += sway * bladeHeight * bladeHeight;
    blade.z += sway * 0.26 * bladeHeight * bladeHeight;
    vec3 rotated = vec3(
      blade.x * cos(aYaw) + blade.z * sin(aYaw),
      blade.y,
      -blade.x * sin(aYaw) + blade.z * cos(aYaw)
    );
    vec4 viewPosition = modelViewMatrix * vec4(aRoot + rotated, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vColor = aColor;
    vTip = bladeHeight;
    vOpacity = uOpacity;
  }
`

const grassFragmentShader = `
  varying vec3 vColor;
  varying float vTip;
  varying float vOpacity;
  void main() {
    float shade = 0.72 + vTip * 0.24;
    gl_FragColor = vec4(vColor * shade, vOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Compact procedural terrain attached to the existing Scene 02 world and renderer. */
export function FloatingIsland({ runtime, radius, grassDensity, windSpeed, reducedMotion, opacity }: {
  runtime: FilmRuntime
  radius: number
  grassDensity: number
  windSpeed: number
  reducedMotion: boolean
  opacity: { current: number }
}) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const top = useMemo(() => makeGeometry(createIslandTopGeometryData(radius)), [radius])
  const side = useMemo(() => makeGeometry(createIslandSideGeometryData(radius)), [radius])
  const grass = useMemo(() => makeGrassGeometry(grassDensity, radius), [grassDensity, radius])
  const topMaterial = useRef<MeshStandardMaterial>(null)
  const sideMaterial = useRef<MeshStandardMaterial>(null)
  const localLight = useRef<PointLight>(null)
  const grassMaterial = useRef<ShaderMaterial>(null)
  const grassUniforms = useMemo(() => ({
    uTime: { value: 0 }, uWindSpeed: { value: 0 }, uOpacity: { value: 1 },
  }), [])

  useLayoutEffect(() => {
    const update = (time: number) => {
      const shader = grassMaterial.current
      if (!shader) return
      if (!reducedMotion) shader.uniforms.uTime!.value = time
      const alpha = Math.min(1, Math.max(0, opacity.current))
      shader.uniforms.uOpacity!.value = alpha
      if (localLight.current) localLight.current.intensity = 0.72 * alpha
      for (const material of [topMaterial.current, sideMaterial.current]) {
        if (!material) continue
        material.opacity = alpha
        const transparent = alpha < 0.999
        if (material.transparent !== transparent) {
          material.transparent = transparent
          material.needsUpdate = true
        }
        material.depthWrite = !transparent
      }
      if (!reducedMotion || alpha < 0.999) invalidate()
    }
    update(runtime.presentationTime)
    return runtime.subscribePresentation(update)
  }, [invalidate, opacity, reducedMotion, runtime])
  useLayoutEffect(() => { if (grassMaterial.current) grassMaterial.current.uniforms.uWindSpeed!.value = windSpeed }, [windSpeed])
  useLayoutEffect(() => () => {
    top.dispose()
    side.dispose()
    grass.dispose()
  }, [grass, side, top])

  return <group>
    <mesh geometry={side} receiveShadow>
      <meshStandardMaterial ref={sideMaterial} vertexColors roughness={0.96} metalness={0.02} />
    </mesh>
    <mesh geometry={top} receiveShadow>
      <meshStandardMaterial ref={topMaterial} vertexColors roughness={0.94} metalness={0} />
    </mesh>
    {grassDensity > 0 && <mesh geometry={grass} frustumCulled={false}>
      <shaderMaterial ref={grassMaterial} uniforms={grassUniforms} vertexShader={grassVertexShader} fragmentShader={grassFragmentShader} side={DoubleSide} toneMapped transparent depthWrite={false} />
    </mesh>}
    <pointLight ref={localLight} position={[0.15, 0.45, 1.05]} color="#A8C8A1" intensity={0.72} distance={3.2} decay={1.8} />
  </group>
}
