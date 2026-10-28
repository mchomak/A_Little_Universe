import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DataTexture, Group, LinearFilter, RedFormat, RepeatWrapping, ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneAnimation } from './animation'
import { TIMING } from '../../engine/filmConfig'
import { identityVortexGLSL } from './identityVortex'

const dustVertex = `
attribute float aSeed;
attribute vec3 aSpace;
uniform float uTime;
uniform float uMotion;
varying float vSeed;
varying float vShot;
${identityVortexGLSL}
void main() {
  vec3 p = position;
  float angle = (uTime - 4.0) * .045 * uMotion;
  p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
  p.z += sin(uTime * .35 + aSeed * 31.0) * .06 * uMotion;
  float shot = identityVortexEnvelope(uTime);
  vec3 space = aSpace + vec3(sin(aSeed * 31.0), cos(aSeed * 17.0), 0.0) * (uTime - 4.0) * .018 * uMotion;
  p = mix(p, space, shot);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(mix(1.8, 8.5, pow(aSeed, 6.0)), mix(1.3, 11.0, pow(aSeed, 18.0)), shot) * (5.6 / -mv.z);
  vSeed = aSeed;
  vShot = shot;
}`
const dustFragment = `
uniform float uTime;
uniform float uMotion;
varying float vSeed;
varying float vShot;
void main() {
  float r = length(gl_PointCoord - .5);
  float halo = exp(-r * 8.0) * .75 + (1.0 - smoothstep(.0, .15, r)) * .75;
  float visible = smoothstep(.2, 3.0, uTime) * (1.0 - .72 * smoothstep(13.0, 20.0, uTime) - .28 * smoothstep(28.0, 34.0, uTime));
  float twinkle = .7 + .3 * sin(uTime * uMotion * (1.0 + vSeed) + vSeed * 40.0);
  vec3 color = mix(vec3(1.0, .42, .58), vec3(1.0, .88, .75), vSeed);
  color = mix(color, mix(vec3(.53, .58, .85), vec3(1.0, .85, .77), vSeed), vShot);
  gl_FragColor = vec4(color, halo * visible * twinkle * mix(.9, .58, vShot));
}`
const hazeVertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const hazeFragment = `
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
${identityVortexGLSL}
void main() {
  vec2 p = (vUv - .5) * vec2(1.0, 1.5);
  float core = exp(-dot(p * vec2(1.7, 2.2), p * vec2(1.7, 2.2)) * 2.8);
  float nucleus = exp(-dot(p * vec2(4.0, 5.0), p * vec2(4.0, 5.0)) * 12.0) * (1.0 - smoothstep(7.0, 10.0, uTime));
  float waves = .65 + .35 * sin(p.x * 13.0 + sin(p.y * 15.0) + uTime * .08 * uMotion);
  float visible = smoothstep(.0, 3.0, uTime) * (1.0 - .72 * smoothstep(13.0, 20.0, uTime) - .28 * smoothstep(28.0, 34.0, uTime));
  gl_FragColor = vec4(mix(vec3(.45, .12, .25), vec3(1.0, .68, .52), nucleus), (core * waves * .22 + nucleus * .9) * visible * (1.0 - identityVortexEnvelope(uTime)));
}`
const nebulaFragment = `
uniform float uTime;
uniform float uMotion;
uniform float uLayer;
uniform sampler2D uCloudNoise;
varying vec2 vUv;
${identityVortexGLSL}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return texture2D(uCloudNoise, (i + f + .5) / 64.0).r;
}
void main() {
  vec2 p = (vUv - .5) * vec2(2.0, 1.5);
  vec2 drift = vec2(.012, -.008) * (uTime - 4.0) * uMotion;
  vec2 q = p * (3.4 + uLayer) + drift + uLayer * 8.7;
  float cloud = noise(q) * .58 + noise(q * 2.03 + 7.1) * .28 + noise(q * 4.07) * .14;
  float filaments = smoothstep(.32, .73, cloud);
  float veil = exp(-dot(p * vec2(.9, 1.55), p * vec2(.9, 1.55)) * 2.5);
  float lane = .45 + .55 * smoothstep(.2, .65, noise(q * 1.3 + 19.0));
  float nucleus = exp(-dot(p * vec2(9.0, 13.0), p * vec2(9.0, 13.0))) * (1.0 - uLayer);
  vec3 color = mix(vec3(.16, .16, .4), vec3(.5, .24, .39), filaments);
  float opacity = filaments * veil * lane * .21;
  color = mix(color, vec3(1.0, .76, .62), nucleus);
  opacity += nucleus * .56 * smoothstep(4.6, 6.7, uTime);
  gl_FragColor = vec4(color, opacity * identityVortexEnvelope(uTime));
}`
const petalVertex = `
attribute float aSeed;
uniform float uTime;
uniform float uMotion;
varying float vSeed;
${identityVortexGLSL}
void main() {
  float angle = (uTime - 4.0) * .07 * uMotion;
  vec3 p = position;
  p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
  float shot = identityVortexEnvelope(uTime);
  float radius = length(position.xy);
  float phase = atan(position.y, position.x) - (uTime - 4.0) * (.14 + aSeed * .38) * uMotion;
  vec3 flow = vec3(cos(phase) * radius, sin(phase) * radius * .57,
    position.z + sin(phase) * radius * .35);
  p = mix(p, flow, shot);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(9.0 + aSeed * 12.0, 5.0 + pow(aSeed, 5.0) * 16.0, shot) * (5.6 / -mv.z);
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

/** One 4 KiB scalar noise tile replaces repeated per-fragment trigonometric hashes. */
function cloudNoiseTexture() {
  const data = new Uint8Array(64 * 64)
  let seed = 41207
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    data[i] = seed >>> 24
  }
  const texture = new DataTexture(data, 64, 64, RedFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
function dustGeometry(count: number) {
  const position = new Float32Array(count * 3), seed = new Float32Array(count), space = new Float32Array(count * 3)
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
    space.set([(random(i + 201) - .5) * 21, (random(i + 301) - .5) * 13,
      i % 19 === 0 ? .6 + random(i + 401) * .8 : -2 - random(i + 401) * 12], i * 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1))
  geometry.setAttribute('aSpace', new BufferAttribute(space, 3))
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
  const cloudNoise = useMemo(() => cloudNoiseTexture(), [])
  const nebulae = useMemo(() => [0, 1].map((layer) => new ShaderMaterial({ vertexShader: hazeVertex, fragmentShader: nebulaFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 }, uLayer: { value: layer }, uCloudNoise: { value: cloudNoise } } })), [reducedMotion, cloudNoise])
  const clouds = useRef<Group>(null)
  const nearCloud = useRef<ShaderMaterial>(null)
  const farCloud = useRef<ShaderMaterial>(null)
  const dustRef = useRef<ShaderMaterial>(null)
  const hazeRef = useRef<ShaderMaterial>(null)
  const petalRef = useRef<ShaderMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => petals.dispose(), [petals])
  useEffect(() => () => dust.dispose(), [dust])
  useEffect(() => () => haze.dispose(), [haze])
  useEffect(() => () => petalMaterial.dispose(), [petalMaterial])
  useEffect(() => () => nebulae.forEach((material) => material.dispose()), [nebulae])
  useEffect(() => () => cloudNoise.dispose(), [cloudNoise])
  const draw = useCallback((time: number) => {
    if (dustRef.current) {
      dustRef.current.uniforms.uTime!.value = time
      dustRef.current.uniforms.uMotion!.value = reducedMotion ? 0 : 1
    }
    if (hazeRef.current) hazeRef.current.uniforms.uTime!.value = time
    if (petalRef.current) petalRef.current.uniforms.uTime!.value = time
    if (nearCloud.current) nearCloud.current.uniforms.uTime!.value = time
    if (farCloud.current && !low) farCloud.current.uniforms.uTime!.value = time
    if (clouds.current) clouds.current.visible = time > 4 && time < 10.3
    if (group.current) group.current.visible = time > 0 && time < 34
  }, [low, reducedMotion])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  return <group ref={group}>
    <mesh position={[0, 0, -2.3]}><planeGeometry args={[10, 7]} /><primitive ref={hazeRef} object={haze} attach="material" /></mesh>
    <group ref={clouds}>
      <mesh position={[0, 0, -3.0]}><planeGeometry args={[12, 8]} /><primitive ref={nearCloud} object={nebulae[0]!} attach="material" /></mesh>
      {!low && <mesh position={[-1.3, .7, -6.5]} rotation={[0, 0, .2]}><planeGeometry args={[18, 12]} /><primitive ref={farCloud} object={nebulae[1]!} attach="material" /></mesh>}
    </group>
    <points geometry={geometry} frustumCulled={false}><primitive ref={dustRef} object={dust} attach="material" /></points>
    <points geometry={petals} frustumCulled={false}><primitive ref={petalRef} object={petalMaterial} attach="material" /></points>
  </group>
}
