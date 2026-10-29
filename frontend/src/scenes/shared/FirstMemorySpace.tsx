import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Euler, Group, Matrix4, ShaderMaterial, Vector3 } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneAnimation } from './animation'
import { firstMemoryFrame } from './firstMemoryFrame'

const vertex = `
attribute float aSeed;
attribute float aEdge;
uniform float uTime;
uniform float uMotion;
uniform mat4 uCardTransform;
varying float vSeed;
varying float vEdge;
void main() {
  vec3 p = position;
  if(aEdge > .5) {
    p = (uCardTransform * vec4(p, 1.0)).xyz;
    p.y += .08;
  } else {
    p += vec3(sin(aSeed * 21.0 + uTime * .12), cos(aSeed * 17.0 + uTime * .09), 0.0) * .04 * uMotion;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(2.0 + pow(aSeed, 6.0) * 19.0, 3.0 + pow(aSeed, 8.0) * 12.0, aEdge) * (5.6 / -mv.z);
  vSeed = aSeed; vEdge = aEdge;
}`
const fragment = `
uniform float uTime;
uniform float uMotion;
varying float vSeed;
varying float vEdge;
void main() {
  float r = length(gl_PointCoord - .5);
  float core = 1.0 - smoothstep(.025, .14, r);
  float halo = exp(-r*r*36.0) * .24;
  float visible = smoothstep(28.0, 29.0, uTime);
  float twinkle = .55 + .45 * sin(vSeed * 42.0 + (uTime - 28.0) * .45 * uMotion);
  vec3 color = mix(vec3(.54,.58,.77), vec3(1.0,.75,.59), vSeed);
  gl_FragColor = vec4(color, (core*.65 + halo) * visible * mix(.4, .8, vEdge) * twinkle);
}`
const random = (i: number) => { const n = Math.sin(i * 127.1 + 17.71) * 43758.5453; return n - Math.floor(n) }

function spaceGeometry(low: boolean) {
  const count = low ? 100 : 220, position = new Float32Array(count * 3), seeds = new Float32Array(count), edge = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const seed = random(i), a = random(i + 41) * Math.PI * 2
    seeds[i] = seed
    if (i < 28) {
      const along = (random(i + 31) - .5) * 2.15, side = i % 2 ? 1 : -1
      position.set(i % 4 < 2 ? [along, side * 1.081, .005] : [side * 1.081, along, .005], i * 3)
      edge[i] = 1
    } else {
      const radius = 1.8 + random(i + 5) * 6.5
      if (i < 40) {
        position.set([(i % 2 ? 1 : -1) * (1.65 + random(i + 2) * 1.1), (random(i + 7) - .5) * 3.9, .5 + seed * .4], i * 3)
        seeds[i] = .84 + seed * .16
      } else position.set([Math.cos(a) * radius, Math.sin(a) * radius * .7, -1.5 - random(i + 21) * 11], i * 3)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aEdge', new BufferAttribute(edge, 1))
  return geometry
}

/** The same sparse volume survives the cinematic handoff as a held gallery pose. */
export function FirstMemorySpace({ runtime, gallery = false, low, reducedMotion }: {
  runtime: FilmRuntime; gallery?: boolean; low: boolean; reducedMotion: boolean
}) {
  const geometry = useMemo(() => spaceGeometry(low), [low])
  const material = useMemo(() => new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 }, uCardTransform: { value: new Matrix4() } },
  }), [])
  const group = useRef<Group>(null), shader = useRef<ShaderMaterial>(null)
  const rotation = useRef(new Euler()), scale = useRef(new Vector3())
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  const draw = useCallback((time: number) => {
    const shot = gallery ? 34 : time
    if (group.current) group.current.visible = shot > 28
    if (shader.current) {
      const frame = firstMemoryFrame(shot, reducedMotion)
      shader.current.uniforms.uTime!.value = shot
      shader.current.uniforms.uMotion!.value = reducedMotion ? 0 : 1
      shader.current.uniforms.uCardTransform!.value.makeRotationFromEuler(rotation.current.set(...frame.rotation)).scale(scale.current.setScalar(frame.scale))
    }
  }, [gallery, reducedMotion])
  useSceneAnimation(runtime, 34, draw)
  return <group ref={group}><points geometry={geometry} frustumCulled={false}><primitive ref={shader} object={material} attach="material" /></points></group>
}
