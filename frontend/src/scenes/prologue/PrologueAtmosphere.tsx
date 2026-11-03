import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, type ShaderMaterial } from 'three'
import type { SceneProps } from '../../engine/sceneTypes'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy*2.,.999,1.);}`
const fragment = `
varying vec2 vUv;
uniform float uDepth; uniform float uHaze; uniform float uReveal; uniform float uAspect;
uniform vec3 uBlue; uniform vec3 uPink; uniform vec3 uLavender;
void main(){
 vec2 p=(vUv-.5)*vec2(uAspect,1.);
 float deep=exp(-dot(p-vec2(-.18,.08),p-vec2(-.18,.08))*1.4);
 float veil=exp(-dot((p-vec2(.12,-.03))*vec2(.8,2.7),(p-vec2(.12,-.03))*vec2(.8,2.7))*4.);
 vec3 depth=uBlue*deep*uDepth*.26;
 vec3 haze=mix(uLavender,uPink,vUv.x)*veil*uHaze*.06;
 gl_FragColor=vec4(depth+haze,uReveal);
 #include <colorspace_fragment>
}`
const dustVertex = `
attribute float aPhase; attribute float aSize;
uniform float uTime; uniform float uSpeed; uniform float uDpr; uniform float uReduced;
varying float vAlpha;
void main(){
 vec3 p=position;
 p.x+=sin(uTime*.14+aPhase)*uSpeed*(1.-uReduced);
 p.y+=sin(uTime*.09+aPhase*2.)*uSpeed*.7*(1.-uReduced);
 gl_Position=vec4(p,1.);
 gl_PointSize=aSize*uDpr;
 vAlpha=.12+sin(aPhase*3.)*.025;
}`
const dustFragment=`uniform float uReveal; varying float vAlpha;
void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*4.)*vAlpha*uReveal;gl_FragColor=vec4(.76,.72,.84,a);}`

/** A quiet near-black depth field; one veil and a handful of independent distant dust motes. */
export function PrologueAtmosphere({ state, runtime, reducedMotion }: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const size = useThree(s => s.size)
  const dpr = useThree(s => s.gl.getPixelRatio())
  const invalidate = useThree(s => s.invalidate)
  const haze = useRef<ShaderMaterial>(null)
  const dust = useRef<ShaderMaterial>(null)
  const count = reducedMotion ? 0 : Math.round(config.atmosphereDensity * (state.quality === 'low' ? .45 : 1))
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const positions = new Float32Array(count * 3), phases = new Float32Array(count), sizes = new Float32Array(count)
    let seed = (config.seed ^ 0x479a) >>> 0
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < count; i++) {
      positions[i * 3] = random() * 1.96 - .98; positions[i * 3 + 1] = random() * 1.96 - .98; positions[i * 3 + 2] = .5 + random() * .3
      phases[i] = random() * 6.28; sizes[i] = .55 + random() * 1.1
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setAttribute('aPhase', new Float32BufferAttribute(phases, 1)); g.setAttribute('aSize', new Float32BufferAttribute(sizes, 1))
    return g
  }, [config.seed, count])
  const hazeUniforms = useMemo(() => ({ uBlue: { value: new Color('#101A33') }, uPink: { value: new Color('#F4CDD9') }, uLavender: { value: new Color('#B9A4E8') }, uDepth: { value: config.spaceDepth }, uHaze: { value: config.hazeIntensity }, uReveal: { value: 0 }, uAspect: { value: size.width / size.height } }), [config.hazeIntensity, config.spaceDepth, size.height, size.width])
  const dustUniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: config.driftSpeed }, uDpr: { value: dpr }, uReveal: { value: 0 }, uReduced: { value: reducedMotion ? 1 : 0 } }), [config.driftSpeed, dpr, reducedMotion])
  useLayoutEffect(() => {
    let previousReveal = -1
    const draw = (time: number) => {
      const reveal = Math.min(1, Math.max(0, (time - 2) / 7))
      if (count === 0 && reveal === previousReveal) return
      previousReveal = reveal
      if (haze.current) haze.current.uniforms.uReveal!.value = reveal * reveal * (3 - 2 * reveal)
      if (dust.current) { dust.current.uniforms.uReveal!.value = reveal; dust.current.uniforms.uTime!.value = time }
      invalidate()
    }
    draw(runtime.presentationTime)
    return runtime.subscribePresentation(draw)
  }, [count, invalidate, runtime, hazeUniforms, dustUniforms])
  useLayoutEffect(() => () => geometry.dispose(), [geometry])
  return <>
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={haze} uniforms={hazeUniforms} vertexShader={vertex} fragmentShader={fragment} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
    <points geometry={geometry} frustumCulled={false} renderOrder={-9}>
      <shaderMaterial ref={dust} uniforms={dustUniforms} vertexShader={dustVertex} fragmentShader={dustFragment} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
    </points>
  </>
}
