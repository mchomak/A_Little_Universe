import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BufferAttribute, BufferGeometry, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter,
  MeshStandardMaterial, PointLight, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType,
} from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { createGrassBladeData, createIslandSideGeometryData, createIslandTopGeometryData, type IslandGeometryData } from './floatingIslandGeometry'

function makeGeometry(data: IslandGeometryData) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
  geometry.setAttribute('uv', new BufferAttribute(data.uvs, 2))
  geometry.setIndex(new BufferAttribute(data.indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

function makeGrassGeometry(count: number, radius: number, averageHeight: number, roughness: number, thickness: number) {
  const blades = createGrassBladeData(count, radius, 49217, averageHeight, roughness, thickness)
  const segments = 6
  const verticesPerBlade = (segments + 1) * 4
  const positions = new Float32Array(count * verticesPerBlade * 3)
  const roots = new Float32Array(positions.length)
  const colors = new Float32Array(positions.length)
  const heights = new Float32Array(count * verticesPerBlade)
  const phases = new Float32Array(count * verticesPerBlade)
  const yaws = new Float32Array(count * verticesPerBlade)
  const widths = new Float32Array(count * verticesPerBlade)
  const bends = new Float32Array(count * verticesPerBlade)
  const indices: number[] = []

  for (let blade = 0; blade < count; blade += 1) {
    for (let plane = 0; plane < 2; plane += 1) {
      const yaw = blades.yaws[blade]! + plane * Math.PI * 0.5
      const start = blade * verticesPerBlade + plane * (segments + 1) * 2
      for (let level = 0; level <= segments; level += 1) {
        const t = level / segments
        const taper = (1 - t) ** 0.78
        const flutter = Math.sin(t * Math.PI) * 0.08
        for (let side = 0; side < 2; side += 1) {
          const vertex = start + level * 2 + side
          const base = side === 0 ? -0.5 : 0.5
          positions[vertex * 3] = base * (taper + flutter)
          positions[vertex * 3 + 1] = t
          roots.set(blades.roots.subarray(blade * 3, blade * 3 + 3), vertex * 3)
          const tipShade = 0.72 + 0.32 * t
          colors[vertex * 3] = blades.colors[blade * 3]! * tipShade
          colors[vertex * 3 + 1] = blades.colors[blade * 3 + 1]! * tipShade
          colors[vertex * 3 + 2] = blades.colors[blade * 3 + 2]! * tipShade
          heights[vertex] = blades.heights[blade]!
          phases[vertex] = blades.phases[blade]!
          yaws[vertex] = yaw
          widths[vertex] = blades.widths[blade]!
          bends[vertex] = blades.bends[blade]!
        }
      }
      for (let segment = 0; segment < segments; segment += 1) {
        const a = start + segment * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aRoot', new BufferAttribute(roots, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('aHeight', new BufferAttribute(heights, 1))
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
  geometry.setAttribute('aYaw', new BufferAttribute(yaws, 1))
  geometry.setAttribute('aWidth', new BufferAttribute(widths, 1))
  geometry.setAttribute('aBend', new BufferAttribute(bends, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const grassVertexPatch = `
  attribute vec3 aRoot;
  attribute float aHeight;
  attribute float aPhase;
  attribute float aYaw;
  attribute float aWidth;
  attribute float aBend;
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uWindStrength;
  vec3 rotateGrassY(vec3 value, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(value.x * c + value.z * s, value.y, -value.x * s + value.z * c);
  }
`

const grassTransformPatch = `
  float grassT = clamp(position.y, 0.0, 1.0);
  float sway = sin(uTime * uWindSpeed + aPhase) * 0.12
    + sin(uTime * uWindSpeed * 0.63 + aPhase * 1.73) * 0.045;
  vec3 grassBlade = vec3(position.x * aWidth + aBend * grassT * grassT + sway * uWindStrength * grassT * grassT,
    grassT * aHeight,
    sin(uTime * uWindSpeed * 0.81 + aPhase * 1.31) * 0.035 * uWindStrength * grassT * grassT);
  transformed = aRoot + rotateGrassY(grassBlade, aYaw);
  objectNormal = rotateGrassY(objectNormal, aYaw);
`

function makeSoilTextures() {
  const size = 192
  const colorData = new Uint8Array(size * size * 4)
  const heightData = new Uint8Array(size * size * 4)
  const roughnessData = new Uint8Array(size * size * 4)
  let seed = 31991
  const random = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 0x100000000
  }
  for (let y = 0; y < size; y += 1) {
    const v = y / size
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const broad = Math.sin(u * Math.PI * 10 + Math.sin(v * Math.PI * 6) * 0.8) * Math.cos(v * Math.PI * 12) * 0.45
      const sediment = Math.sin((u * 4 + Math.sin(v * Math.PI * 3) * 0.14) * Math.PI * 2) * 0.18
      const grain = (random() - 0.5) * 0.36 + (random() - 0.5) * 0.18
      const noise = broad + sediment + grain
      const pixel = (y * size + x) * 4
      // A pale, nearly neutral detail mask modulates the earthy vertex palette without crushing it toward black.
      colorData[pixel] = Math.min(255, Math.max(0, 232 + noise * 17))
      colorData[pixel + 1] = Math.min(255, Math.max(0, 220 + noise * 18))
      colorData[pixel + 2] = Math.min(255, Math.max(0, 204 + noise * 19))
      colorData[pixel + 3] = 255
      const height = Math.min(255, Math.max(0, 128 + noise * 86))
      heightData[pixel] = height
      heightData[pixel + 1] = height
      heightData[pixel + 2] = height
      heightData[pixel + 3] = 255
      const roughness = Math.min(255, Math.max(0, 222 + random() * 33))
      roughnessData[pixel] = roughness
      roughnessData[pixel + 1] = roughness
      roughnessData[pixel + 2] = roughness
      roughnessData[pixel + 3] = 255
    }
  }
  const texture = (data: Uint8Array, colorSpace = '') => {
    const value = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
    value.wrapS = RepeatWrapping
    value.wrapT = RepeatWrapping
    value.magFilter = LinearFilter
    value.minFilter = LinearMipmapLinearFilter
    value.generateMipmaps = true
    if (colorSpace) value.colorSpace = SRGBColorSpace
    value.needsUpdate = true
    return value
  }
  return { color: texture(colorData, 'srgb'), height: texture(heightData), roughness: texture(roughnessData) }
}

/** Procedural island attached to the shared Scene 02 canvas and presentation clock. */
export function FloatingIsland({ runtime, radius, thickness = 0.24, depth = 0.58, roughness = 0.5, grassDensity, grassHeight = 0.14, windStrength = 1, windSpeed, reducedMotion, opacity }: {
  runtime: FilmRuntime
  radius: number
  thickness?: number
  depth?: number
  roughness?: number
  grassDensity: number
  grassHeight?: number
  windStrength?: number
  windSpeed: number
  reducedMotion: boolean
  opacity: { current: number }
}) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const top = useMemo(() => makeGeometry(createIslandTopGeometryData(radius, roughness, thickness)), [radius, roughness, thickness])
  const side = useMemo(() => makeGeometry(createIslandSideGeometryData(radius, thickness, depth, roughness)), [depth, radius, roughness, thickness])
  const grass = useMemo(() => makeGrassGeometry(grassDensity, radius, grassHeight, roughness, thickness), [grassDensity, grassHeight, radius, roughness, thickness])
  const soilTextures = useMemo(() => makeSoilTextures(), [])
  const topMaterial = useRef<MeshStandardMaterial>(null)
  const sideMaterial = useRef<MeshStandardMaterial>(null)
  const localLight = useRef<PointLight>(null)
  const grassMaterial = useRef<MeshStandardMaterial>(null)
  const grassUniforms = useRef({
    uTime: { value: 0 }, uWindSpeed: { value: 0 }, uWindStrength: { value: 1 },
  })
  const onGrassCompile = useMemo(() => (shader: { uniforms: Record<string, { value: number }>; vertexShader: string }) => {
    Object.assign(shader.uniforms, grassUniforms.current)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${grassVertexPatch}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = rotateGrassY(objectNormal, aYaw);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${grassTransformPatch}`)
  }, [grassUniforms])

  useLayoutEffect(() => {
    grassUniforms.current.uWindSpeed.value = windSpeed
    grassUniforms.current.uWindStrength.value = windStrength
    const update = (time: number) => {
      const shader = grassMaterial.current
      if (!shader) return
      grassUniforms.current.uTime.value = reducedMotion ? 0 : time
      const alpha = Math.min(1, Math.max(0, opacity.current))
      for (const material of [topMaterial.current, sideMaterial.current, shader]) {
        if (!material) continue
        material.opacity = alpha
        const transparent = alpha < 0.999
        if (material.transparent !== transparent) {
          material.transparent = transparent
          material.needsUpdate = true
        }
        material.depthWrite = !transparent && material !== shader
      }
      if (localLight.current) localLight.current.intensity = 1.18 * alpha
      if (!reducedMotion || alpha < 0.999) invalidate()
    }
    update(runtime.presentationTime)
    return runtime.subscribePresentation(update)
  }, [grassUniforms, invalidate, opacity, reducedMotion, runtime, windSpeed, windStrength])

  useLayoutEffect(() => () => {
    top.dispose()
    side.dispose()
    grass.dispose()
  }, [grass, side, top])
  useLayoutEffect(() => () => {
    soilTextures.color.dispose()
    soilTextures.height.dispose()
    soilTextures.roughness.dispose()
  }, [soilTextures])

  return <group>
    <mesh geometry={side} receiveShadow>
      <meshStandardMaterial ref={sideMaterial} vertexColors map={soilTextures.color} bumpMap={soilTextures.height} bumpScale={0.012} roughnessMap={soilTextures.roughness} roughness={1} metalness={0} />
    </mesh>
    <mesh geometry={top} receiveShadow>
      <meshStandardMaterial ref={topMaterial} vertexColors map={soilTextures.color} bumpMap={soilTextures.height} bumpScale={0.009} roughnessMap={soilTextures.roughness} roughness={1} metalness={0} />
    </mesh>
    {grassDensity > 0 && <mesh geometry={grass} frustumCulled={false}>
      <meshStandardMaterial ref={grassMaterial} vertexColors side={DoubleSide} roughness={0.78} metalness={0} transparent depthWrite={false} onBeforeCompile={onGrassCompile} customProgramCacheKey={() => 'floating-island-grass-v3'} />
    </mesh>}
    <pointLight ref={localLight} position={[0.15, 0.58, 1.2]} color="#B8D0A3" intensity={1.18} distance={3.8} decay={1.6} />
  </group>
}
