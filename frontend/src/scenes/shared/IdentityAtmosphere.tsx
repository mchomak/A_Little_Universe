import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneAnimation } from './animation'
import { TIMING } from '../../engine/filmConfig'

const dustVertex = `
attribute float aSeed;
uniform float uTime;
uniform float uMotion;
varying float vSeed;
void main() {
  vec3 p = position;
  float angle = (uTime - 4.0) * .045 * uMotion;
  p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
  p.z += sin(uTime * .35 + aSeed * 31.0) * .06 * uMotion;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(1.8, 8.5, pow(aSeed, 6.0)) * (5.6 / -mv.z);
  vSeed = aSeed;
}`
const dustFragment = `
uniform float uTime;
uniform float uMotion;
varying float vSeed;
void main() {
  float r = length(gl_PointCoord - .5);
  float halo = exp(-r * 8.0) * .75 + (1.0 - smoothstep(.0, .15, r)) * .75;
  float visible = smoothstep(.2, 3.0, uTime) * (1.0 - .72 * smoothstep(13.0, 20.0, uTime) - .28 * smoothstep(28.0, 34.0, uTime));
  float twinkle = .7 + .3 * sin(uTime * uMotion * (1.0 + vSeed) + vSeed * 40.0);
  vec3 color = mix(vec3(1.0, .42, .58), vec3(1.0, .88, .75), vSeed);
  gl_FragColor = vec4(color, halo * visible * twinkle * .9);
}`
const hazeVertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const hazeFragment = `
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - .5) * vec2(1.0, 1.5);
  float core = exp(-dot(p * vec2(1.7, 2.2), p * vec2(1.7, 2.2)) * 2.8);
  float nucleus = exp(-dot(p * vec2(4.0, 5.0), p * vec2(4.0, 5.0)) * 12.0) * (1.0 - smoothstep(7.0, 10.0, uTime));
  float waves = .65 + .35 * sin(p.x * 13.0 + sin(p.y * 15.0) + uTime * .08 * uMotion);
  float visible = smoothstep(.0, 3.0, uTime) * (1.0 - .72 * smoothstep(13.0, 20.0, uTime) - .28 * smoothstep(28.0, 34.0, uTime));
  gl_FragColor = vec4(mix(vec3(.45, .12, .25), vec3(1.0, .68, .52), nucleus), (core * waves * .22 + nucleus * .9) * visible);
}`
const petalVertex = `
attribute float aSeed;
uniform float uTime;
uniform float uMotion;
varying float vSeed;
void main() {
  float angle = (uTime - 4.0) * .07 * uMotion;
  vec3 p = position;
  p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (9.0 + aSeed * 12.0) * (5.6 / -mv.z);
  vSeed = aSeed;
}`
const petalFragment = `
uniform float uTime;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - .5;
  float angle = vSeed * 6.283;
  p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
  float d = length(p * vec2(1.0, 2.2));
  float shape = (1.0 - smoothstep(.26, .48, d));
  float halo = exp(-d * 7.0) * .5;
  float visible = smoothstep(2.0, 4.0, uTime) * (1.0 - smoothstep(8.0, 12.0, uTime));
  gl_FragColor = vec4(1.0, .66 + .18 * vSeed, .78, (shape * .55 + halo) * visible);
}`
function random(index: number) { const x = Math.sin(index * 127.1 + 91.7) * 43758.5453; return x - Math.floor(x) }
function dustGeometry(count: number) {
  const position = new Float32Array(count * 3), seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(random(i + 12)), angle = random(i + 73) * Math.PI * 2
    const arm = i % 3
    // A mix of spiral bands and a diffuse volume keeps the centre legible.
    const spiral = i % 4 !== 0
    const theta = spiral ? r * 11 + arm * Math.PI * 2 / 3 + (random(i + 21) - .5) * .9 : angle
    const radius = spiral ? .6 + r * 3.9 : r * 4.4
    position[i * 3] = Math.cos(theta) * radius
    position[i * 3 + 1] = Math.sin(theta) * radius * .55
    position[i * 3 + 2] = -1.0 + (random(i + 56) - .5) * 2.2
    seed[i] = random(i + 90)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1))
  return geometry
}

function petalGeometry(count: number) {
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const radius = .8 + Math.sqrt(random(i + 170)) * 3.0
    const angle = radius * 3.2 + (i % 3) * Math.PI * 2 / 3 + (random(i + 270) - .5) * .5
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = Math.sin(angle) * radius * .42
    positions[i * 3 + 2] = (random(i + 370) - .5) * 1.5
    seeds[i] = random(i + 470)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  return geometry
}

/** GPU-only ambience follows the shared film clock, with no per-frame allocations. */
export function IdentityAtmosphere({ runtime, low, reducedMotion }: { runtime: FilmRuntime; low: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null)
  const geometry = useMemo(() => dustGeometry(low ? 2400 : 4800), [low])
  const petals = useMemo(() => petalGeometry(low ? 24 : 40), [low])
  const dust = useMemo(() => new ShaderMaterial({ vertexShader: dustVertex, fragmentShader: dustFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 } } }), [reducedMotion])
  const haze = useMemo(() => new ShaderMaterial({ vertexShader: hazeVertex, fragmentShader: hazeFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 } } }), [reducedMotion])
  const petalMaterial = useMemo(() => new ShaderMaterial({ vertexShader: petalVertex, fragmentShader: petalFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 } } }), [reducedMotion])
  const dustRef = useRef<ShaderMaterial>(null)
  const hazeRef = useRef<ShaderMaterial>(null)
  const petalRef = useRef<ShaderMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => petals.dispose(), [petals])
  useEffect(() => () => dust.dispose(), [dust])
  useEffect(() => () => haze.dispose(), [haze])
  useEffect(() => () => petalMaterial.dispose(), [petalMaterial])
  const draw = useCallback((time: number) => {
    if (dustRef.current) dustRef.current.uniforms.uTime!.value = time
    if (hazeRef.current) hazeRef.current.uniforms.uTime!.value = time
    if (petalRef.current) petalRef.current.uniforms.uTime!.value = time
    if (group.current) group.current.visible = time > 0 && time < 34
  }, [])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  return <group ref={group}>
    <mesh position={[0, 0, -2.3]}><planeGeometry args={[10, 7]} /><primitive ref={hazeRef} object={haze} attach="material" /></mesh>
    <points geometry={geometry} frustumCulled={false}><primitive ref={dustRef} object={dust} attach="material" /></points>
    <points geometry={petals} frustumCulled={false}><primitive ref={petalRef} object={petalMaterial} attach="material" /></points>
  </group>
}
