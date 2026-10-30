import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, DataTexture, Float32BufferAttribute, LinearFilter, RGBAFormat, Vector2, Vector3, Vector4, type ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { getPrologueFrames } from '../engine/filmConfig'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { loadArtFont } from '../systems/scene-config/fontCatalog'
import { DISSOLVE_GLSL, type DissolveStyle } from './shared/dissolve'
import { resolvePrologueParticleCount } from './prologue/particleMath'
import { createPrologueDissolveStyle, rasterizeLetter, sampleLetterMatter, seededRandom, type LetterRaster } from './prologue/letterMatter'
import { PrologueAtmosphere } from './prologue/PrologueAtmosphere'

// eslint-disable-next-line react-refresh/only-export-components -- retained public deterministic sampling seam.
export { sampleGlyphParticlePixels } from './prologue/letterMatter'

const inkVertex = `
uniform vec2 uResolution;
uniform vec4 uRect;
varying vec2 vUv;
void main(){
 vUv=vec2(uv.x,1.0-uv.y);
 vec2 pixel=uRect.xy+vec2(uv.x,1.0-uv.y)*uRect.zw;
 gl_Position=vec4(pixel/uResolution*vec2(2.0,-2.0)+vec2(-1.0,1.0),0.0,1.0);
}`
const inkFragment = `
uniform sampler2D uMatter;
uniform float uTime;
uniform vec2 uWrite;
uniform vec2 uFracture;
uniform float uGlow;
uniform float uReduced;
uniform float uSeed;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uZoneWidth;
uniform float uEdgeWidth;
uniform float uEdgeIntensity;
uniform vec3 uEdgeColor;
${DISSOLVE_GLSL}
varying vec2 vUv;
void main(){
 vec4 matter=texture2D(uMatter,vUv);
 float write=clamp((uTime-uWrite.x)/max(0.01,uWrite.y-uWrite.x),0.0,1.0);
 float visible=smoothstep(matter.g-0.014,matter.g+0.018,write)*step(uWrite.x,uTime);
 if(uReduced>0.5) visible=step(uWrite.x,uTime);
 float progress=clamp((uTime-uFracture.x)/max(0.1,uFracture.y),0.0,1.0);
 float noiseValue=dissolveNoise(vUv,uSeed,uNoiseScale);
 float threshold=dissolveThreshold(matter.b,noiseValue,uZoneWidth,uNoiseStrength,uEdgeWidth);
 float dissolve=dissolveReveal(progress,threshold,uEdgeWidth);
 float edge=dissolveEdge(progress,threshold,uEdgeWidth,uEdgeIntensity);
 if(uReduced>0.5){dissolve=smoothstep(uFracture.x,uFracture.x+0.7,uTime);edge=0.0;}
 float pen=exp(-pow((write-matter.g)/0.022,2.0))*step(uTime,uWrite.y);
 float alpha=(matter.r*(0.95+edge*0.12)+matter.a*uGlow*(0.3+pen*0.65))*visible*(1.0-dissolve);
 if(alpha<0.001)discard;
 vec3 inkColor=vec3(1.0,0.913,0.873);
 gl_FragColor=vec4(inkColor+uEdgeColor*edge*0.22,alpha);
 #include <colorspace_fragment>
}`
const dustVertex = `
attribute vec4 aMatter;
attribute vec3 aMotion;
uniform vec2 uResolution;
uniform float uTime,uEnd,uTravel,uFade,uWind,uTurbulence,uGlow,uDpr;
varying float vAlpha;
varying float vTint;
${DISSOLVE_GLSL}
void main(){
 float age=uTime-aMatter.x;
 float life=dissolveParticleLifetime(uTravel,aMotion.z,uEnd-aMatter.x);
 float progress=clamp(age/max(0.1,life),0.0,1.0);
 float inertia=max(0.0,age-0.055*(0.6+aMotion.z));
 float drift=inertia*(1.0-exp(-inertia*2.4));
 vec2 flow=vec2(-11.0-aMotion.x*8.0,-17.0-aMotion.y*10.0)*uWind*drift;
 vec2 curl=vec2(sin(inertia*1.6+aMotion.z*6.28)-sin(aMotion.z*6.28),cos(inertia*1.2+aMotion.x*5.0)-cos(aMotion.x*5.0));
 vec2 pixel=position.xy+flow+curl*9.0*uTurbulence*inertia;
 gl_Position=vec4(pixel/uResolution*vec2(2.0,-2.0)+vec2(-1.0,1.0),0.0,1.0);
 float fadeStart=max(0.0,life-min(uFade,life)*(.7+aMotion.y*.3));
 float fade=1.0-smoothstep(fadeStart,life,max(0.0,age));
 float sceneFade=1.0-smoothstep(uEnd-0.5,uEnd,uTime);
 gl_PointSize=max(0.5,aMatter.y*(1.0-progress*.58))*uDpr*3.1;
 vAlpha=step(0.0,age)*fade*sceneFade*aMatter.z*uGlow*(0.86+exp(-max(0.0,age)*5.0)*0.4);
 vTint=aMatter.w;
}`
const dustFragment = `
varying float vAlpha,vTint;
void main(){
 float d=length(gl_PointCoord-.5)*2.0;
 float alpha=exp(-d*d*2.8)*(1.0-smoothstep(.6,1.0,d))*vAlpha;
 if(alpha<.001)discard;
 vec3 color=mix(vec3(1.0,.91,.85),vec3(.91,.82,1.0),vTint*.25);
 gl_FragColor=vec4(color,alpha);
 #include <colorspace_fragment>
}`

interface LetterResource { texture: DataTexture; raster: LetterRaster; geometry: BufferGeometry; index: number; dissolveStyle: DissolveStyle }

function makeResource(raster: LetterRaster, count: number, seed: number, index: number, fracture: readonly [number, number], dissolveStyle: DissolveStyle, minSize: number, maxSize: number): LetterResource {
  const texture = new DataTexture(raster.data, raster.width, raster.height, RGBAFormat)
  texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true
  const geometry = new BufferGeometry()
  const sampled = sampleLetterMatter(raster, count, seed, fracture[0], fracture[1] - fracture[0])
  const positions = new Float32Array(count * 3), matter = new Float32Array(count * 4), motion = new Float32Array(count * 3)
  const random = seededRandom(seed ^ 0x4f1bbcdc)
  for (let i = 0; i < count; i++) {
    const x = sampled[i * 3]!, y = sampled[i * 3 + 1]!
    positions.set([x, y, 0], i * 3)
    const size = minSize + (maxSize - minSize) * Math.pow(random(), 1.9)
    matter.set([sampled[i * 3 + 2]!, size, .8 + random() * .4, random()], i * 4)
    motion.set([random(), random(), random()], i * 3)
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aMatter', new Float32BufferAttribute(matter, 4))
  geometry.setAttribute('aMotion', new Float32BufferAttribute(motion, 3))
  return { texture, raster, geometry, index, dissolveStyle }
}

function LetterLayer({ resource, runtime, reducedMotion }: { resource: LetterResource; runtime: SceneProps['runtime']; reducedMotion: boolean }) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getPrologueFrames(config), [config])
  const size = useThree(s => s.size), dpr = useThree(s => s.viewport.dpr), invalidate = useThree(s => s.invalidate)
  const ink = useRef<ShaderMaterial>(null), dust = useRef<ShaderMaterial>(null)
  const rect = resource.raster.rect
  const fracture = resource.index === 0 ? frames.firstDissolve : frames.secondDissolve
  const dissolveStyle = resource.dissolveStyle
  const uniforms = useMemo(() => ({
    uResolution: { value: new Vector2(size.width, size.height) },
    uRect: { value: new Vector4(rect.x, rect.y, rect.width, rect.height) },
    uMatter: { value: resource.texture },
    uTime: { value: 0 },
    uWrite: { value: new Vector2(...(resource.index === 0 ? frames.first : frames.second)) },
    uFracture: { value: new Vector2(fracture[0], fracture[1] - fracture[0]) },
    uGlow: { value: config.textGlow },
    uReduced: { value: Number(reducedMotion) },
    uSeed: { value: dissolveStyle.seed },
    uNoiseScale: { value: dissolveStyle.noiseScale },
    uNoiseStrength: { value: dissolveStyle.noiseStrength },
    uZoneWidth: { value: resource.raster.zoneWidth },
    uEdgeWidth: { value: dissolveStyle.edgeWidth },
    uEdgeIntensity: { value: dissolveStyle.edgeIntensity },
    uEdgeColor: { value: new Vector3(...dissolveStyle.edgeColor) },
  }), [config, dissolveStyle, fracture, frames, rect, resource, reducedMotion, size.width, size.height])
  const dustUniforms = useMemo(() => ({ uResolution: uniforms.uResolution, uTime: { value: 0 }, uEnd: { value: frames.dissolve[1] }, uTravel: { value: frames.particleTravelDuration }, uFade: { value: config.particleFadeDuration }, uWind: { value: config.windStrength }, uTurbulence: { value: config.turbulence }, uGlow: { value: config.particleGlow }, uDpr: { value: dpr } }), [config, frames, dpr, uniforms.uResolution])
  useLayoutEffect(() => {
    const draw = (time: number) => { if (ink.current) ink.current.uniforms.uTime!.value = time; if (dust.current) dust.current.uniforms.uTime!.value = time; invalidate() }
    draw(runtime.time)
    return runtime.subscribeFrame(draw)
  }, [runtime, uniforms, dustUniforms, invalidate])
  return <>
    <mesh frustumCulled={false} renderOrder={4}><planeGeometry args={[1, 1]} /><shaderMaterial ref={ink} uniforms={uniforms} vertexShader={inkVertex} fragmentShader={inkFragment} transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
    {!reducedMotion && <points geometry={resource.geometry} frustumCulled={false} renderOrder={5}><shaderMaterial ref={dust} uniforms={dustUniforms} vertexShader={dustVertex} fragmentShader={dustFragment} transparent depthTest={false} depthWrite={false} toneMapped={false} blending={AdditiveBlending} /></points>}
  </>
}

export function PrologueScene(props: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getPrologueFrames(config), [config])
  const size = useThree(s => s.size), gl = useThree(s => s.gl), invalidate = useThree(s => s.invalidate)
  const dpr = useThree(s => s.viewport.dpr)
  const [letters, setLetters] = useState<LetterResource[]>([])
  useLayoutEffect(() => {
    let disposed = false, queued = 0, generation = 0
    const rebuild = () => {
      const request = ++generation
      void loadArtFont(config.fontFamily).then(() => {
        if (disposed || request !== generation) return
        cancelAnimationFrame(queued)
        queued = requestAnimationFrame(() => {
          if (disposed || request !== generation) return
          const viewport = gl.domElement.getBoundingClientRect()
          const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-prologue-line]'))
          if (elements.length !== 2) return
          const compact = size.width < 820 || window.matchMedia('(pointer:coarse)').matches
          const count = props.reducedMotion ? 0 : resolvePrologueParticleCount(config.particleCount, props.state.quality, dpr, compact)
          const next = elements.flatMap((element, index) => {
            const dissolveStyle = createPrologueDissolveStyle(config.seed + index * 71, config.fractureWidth)
            const raster = rasterizeLetter(element, viewport, config.handwritingRhythm, config.fractureWidth, config.seed + index * 71, dissolveStyle)
            const fracture = index === 0 ? frames.firstDissolve : frames.secondDissolve
            return raster ? [makeResource(raster, Math.floor(count / 2), config.seed + index * 71, index, fracture, dissolveStyle, config.particleSizeMin, config.particleSizeMax)] : []
          })
          setLetters(next)
          document.querySelector<HTMLElement>('.prologue-overlay')?.setAttribute('data-matter-ready', String(next.length === 2))
          invalidate()
        })
      })
    }
    rebuild()
    window.addEventListener('prologue-layout', rebuild)
    return () => { disposed = true; generation++; cancelAnimationFrame(queued); window.removeEventListener('prologue-layout', rebuild) }
  }, [config, frames, gl, dpr, invalidate, props.reducedMotion, props.state.quality, size.width, size.height])
  useLayoutEffect(() => () => { document.querySelector('.prologue-overlay')?.removeAttribute('data-matter-ready') }, [])
  useLayoutEffect(() => () => { for (const letter of letters) { letter.texture.dispose(); letter.geometry.dispose() } }, [letters])
  return <><PrologueAtmosphere {...props} />{letters.map(resource => <LetterLayer key={`${resource.index}:${resource.texture.uuid}`} resource={resource} runtime={props.runtime} reducedMotion={props.reducedMotion} />)}</>
}
