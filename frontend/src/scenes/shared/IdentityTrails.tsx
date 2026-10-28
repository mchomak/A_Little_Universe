import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import { useSceneAnimation } from './animation'
import { identityVortexGLSL } from './identityVortex'

const vertex = `
attribute vec3 aOrigin;
attribute vec3 aSpiral;
attribute vec4 aVortex;
attribute vec4 aImpulse;
attribute float aSeed;
attribute float aTail;
uniform float uTime;
uniform float uVortexScale;
varying float vOpacity;
varying float vWarmth;
${identityVortexGLSL}
void main() {
  float time = max(4.0, uTime - aTail * (.035 + aSeed * .055));
  vec3 p = identityVortexPosition(aOrigin, aSpiral, aVortex, aImpulse, aSeed, time, 1.0);
  p *= mix(1.0, uVortexScale, identityVortexEnvelope(time));
  p.z += sin(time * .8 + aSeed * 25.0) * .035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vOpacity = pow(1.0 - aTail, 1.6) * identityVortexEnvelope(uTime) * (1.0 - smoothstep(7.55, 8.0, uTime)) * .38;
  vWarmth = aSeed;
}`
const fragment = `
varying float vOpacity;
varying float vWarmth;
void main() { gl_FragColor = vec4(mix(vec3(1.0, .58, .68), vec3(1.0, .91, .83), vWarmth), vOpacity); }
`

/** Six short segments sample the same particle trajectory, never full orbit rings. */
function trailGeometry(source: BufferGeometry, count: number) {
  const selected: number[] = []
  const kinds = source.getAttribute('aVortex')
  for (let i = 0; i < kinds.count && selected.length < count; i++) {
    if (kinds.getW(i) === 2) selected.push(i)
  }
  const geometry = new BufferGeometry()
  const vertices = selected.length * 12
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3))
  for (const name of ['aOrigin', 'aSpiral', 'aVortex', 'aImpulse', 'aSeed']) {
    const attribute = source.getAttribute(name)
    const data = new Float32Array(vertices * attribute.itemSize)
    selected.forEach((particle, index) => {
      for (let v = 0; v < 12; v++) for (let k = 0; k < attribute.itemSize; k++) {
        data[(index * 12 + v) * attribute.itemSize + k] = attribute.array[particle * attribute.itemSize + k]!
      }
    })
    geometry.setAttribute(name, new BufferAttribute(data, attribute.itemSize))
  }
  const tails = new Float32Array(vertices)
  for (let i = 0; i < vertices; i++) tails[i] = (Math.floor((i % 12) / 2) + i % 2) / 6
  geometry.setAttribute('aTail', new BufferAttribute(tails, 1))
  return geometry
}

export function IdentityTrails({ geometry: source, runtime, low, reducedMotion, scale }: {
  geometry: BufferGeometry; runtime: FilmRuntime; low: boolean; reducedMotion: boolean; scale: number
}) {
  const geometry = useMemo(() => trailGeometry(source, low ? 32 : 80), [source, low])
  const material = useMemo(() => new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uVortexScale: { value: 1 } } }), [])
  const line = useRef<import('three').LineSegments>(null)
  const materialRef = useRef<ShaderMaterial>(null)
  const draw = useCallback((time: number) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime!.value = time
      materialRef.current.uniforms.uVortexScale!.value = scale
    }
    if (line.current) line.current.visible = !reducedMotion && time > 4 && time < 8
  }, [reducedMotion, scale])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <lineSegments ref={line} geometry={geometry} frustumCulled={false}><primitive ref={materialRef} object={material} attach="material" /></lineSegments>
}
