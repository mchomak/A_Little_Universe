import { useCallback, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Vector2, type ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneAnimation } from './animation'

const vertexShader = `
varying vec2 vUv;
uniform vec2 uResolution;
void main() {
  vUv = uv;
  vec4 center = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  center.xy += position.xy * 128.0 / uResolution * 2.0 * center.w;
  gl_Position = center;
}`
const fragmentShader = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uGain;
uniform float uHalo;
uniform float uWave;
void main() {
  float d = length(vUv - 0.5) * 128.0;
  float core = 1.0 - smoothstep(1.35, 2.8, d);
  float glow = exp(-d * 0.22) * 0.23 * uGain;
  float atmosphere = exp(-d * d / 410.0) * 0.045 * uHalo;
  float halo = exp(-pow((d - 13.0) / 1.8, 2.0)) * 0.055 * uHalo;
  float waveRadius = mix(7.0, 58.0, uWave);
  float wave = exp(-pow((d - waveRadius) / 2.2, 2.0)) * sin(uWave * 3.14159265) * 0.28;
  float alpha = clamp(core + glow + atmosphere + halo + wave, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}`

/** A live GPU light with a five CSS-pixel core, independent of camera distance and DPR. */
export function SeedLight({ runtime, duration, pose }: {
  runtime: FilmRuntime
  duration: number
  pose(time: number): { opacity: number; gain: number; halo: number; wave: number }
}) {
  const size = useThree((state) => state.size)
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uResolution: { value: new Vector2(size.width, size.height) },
    uColor: { value: new Color('#FFF0E8') },
    uOpacity: { value: 0 }, uGain: { value: 1 }, uHalo: { value: 0 }, uWave: { value: 0 },
  }), [size.width, size.height])
  const draw = useCallback((time: number) => {
    const shader = material.current
    if (!shader) return
    const p = pose(time)
    // R3F preserves its own uniforms object and copies incoming entries into it.
    const live = shader.uniforms as typeof uniforms
    live.uResolution.value.copy(uniforms.uResolution.value)
    live.uOpacity.value = p.opacity
    live.uGain.value = p.gain
    live.uHalo.value = p.halo
    live.uWave.value = p.wave
  }, [pose, uniforms])
  useSceneAnimation(runtime, duration, draw)
  return <mesh frustumCulled={false} renderOrder={2}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} depthTest={false} toneMapped={false} />
  </mesh>
}
