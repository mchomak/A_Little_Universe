import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Color, DataTexture, Float32BufferAttribute, LinearFilter, RGBAFormat, Vector2, Vector3, Vector4, type ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { getPrologueFrames } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { DISSOLVE_GLSL, type DissolveStyle } from '../shared/dissolve'
import { sampleLetterMatter, seededRandom, type LetterRaster } from './letterMatter'

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
uniform vec3 uInkColor;
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
 gl_FragColor=vec4(uInkColor+uEdgeColor*edge*0.22,alpha);
 #include <colorspace_fragment>
}`
const dustVertex = `
attribute vec4 aMatter;
attribute vec3 aMotion;
uniform vec2 uResolution;
uniform float uTime,uEnd,uTravel,uFade,uWind,uTurbulence,uGlow,uDpr,uOffset;
uniform vec3 uDustColor;
varying float vAlpha;
varying float vTint;
${DISSOLVE_GLSL}
void main(){
 float emission=aMatter.x+uOffset;
 float age=uTime-emission;
 float life=dissolveParticleLifetime(uTravel,aMotion.z,uEnd-emission);
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
uniform vec3 uDustColor;
void main(){
 float d=length(gl_PointCoord-.5)*2.0;
 float alpha=exp(-d*d*2.8)*(1.0-smoothstep(.6,1.0,d))*vAlpha;
 if(alpha<.001)discard;
 vec3 color=mix(uDustColor,vec3(.91,.82,1.0),vTint*.25);
 gl_FragColor=vec4(color,alpha);
 #include <colorspace_fragment>
}`

export interface LetterResource { texture: DataTexture; raster: LetterRaster; geometry: BufferGeometry; index: number; dissolveStyle: DissolveStyle }

// eslint-disable-next-line react-refresh/only-export-components -- shared resource factory for scene 03.
export function makeResource(raster: LetterRaster, count: number, seed: number, index: number, fracture: readonly [number, number], dissolveStyle: DissolveStyle, minSize: number, maxSize: number): LetterResource {
  const texture = new DataTexture(raster.data, raster.width, raster.height, RGBAFormat)
  texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true
  const geometry = new BufferGeometry()
  const sampled = sampleLetterMatter(raster, count, seed, fracture[0], fracture[1] - fracture[0])
  const positions = new Float32Array(count * 3), matter = new Float32Array(count * 4), motion = new Float32Array(count * 3)
  const random = seededRandom(seed ^ 0x4f1bbcdc)
  for (let i = 0; i < count; i++) {
    const x = sampled[i * 3]!, y = sampled[i * 3 + 1]!
    positions.set([x, y, 0], i * 3)
    const pointSize = minSize + (maxSize - minSize) * Math.pow(random(), 1.9)
    matter.set([sampled[i * 3 + 2]!, pointSize, .8 + random() * .4, random()], i * 4)
    motion.set([random(), random(), random()], i * 3)
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aMatter', new Float32BufferAttribute(matter, 4))
  geometry.setAttribute('aMotion', new Float32BufferAttribute(motion, 3))
  return { texture, raster, geometry, index, dissolveStyle }
}

export interface LetterLayerOptions {
  settings?: {
    textGlow: number
    particleGlow: number
    particleFadeDuration: number
    windStrength: number
    turbulence: number
    particleTravelDuration: number
    inkColor?: string
    particleColor?: string
  }
  write?: readonly [number, number]
  fracture?: readonly [number, number]
  getTime?: () => number
  getFractureStart?: () => number | null
  getEmissionOffset?: () => number | null
  getDissolveEnd?: (fractureStart: number) => number
  subscribeTime?: (draw: () => void) => () => void
}

const EMPTY_OPTIONS: LetterLayerOptions = Object.freeze({})

export function LetterLayer({ resource, runtime, reducedMotion, options = EMPTY_OPTIONS }: { resource: LetterResource; runtime: FilmRuntime; reducedMotion: boolean; options?: LetterLayerOptions }) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getPrologueFrames(config), [config])
  const size = useThree((state) => state.size), dpr = useThree((state) => state.viewport.dpr), invalidate = useThree((state) => state.invalidate)
  const ink = useRef<ShaderMaterial>(null), dust = useRef<ShaderMaterial>(null)
  const rect = resource.raster.rect
  const defaults = useMemo<NonNullable<LetterLayerOptions['settings']>>(() => ({
    textGlow: config.textGlow,
    particleGlow: config.particleGlow,
    particleFadeDuration: config.particleFadeDuration,
    windStrength: config.windStrength,
    turbulence: config.turbulence,
    particleTravelDuration: config.particleDuration,
  }), [config])
  const settings = options.settings ?? defaults
  const fracture = options.fracture ?? (resource.index === 0 ? frames.firstDissolve : frames.secondDissolve)
  const write = options.write ?? (resource.index === 0 ? frames.first : frames.second)
  const dissolveStyle = resource.dissolveStyle
  const inkColor = useMemo(() => settings.inkColor ? new Color(settings.inkColor) : new Vector3(1, .913, .873), [settings.inkColor])
  const particleColor = useMemo(() => settings.particleColor ? new Color(settings.particleColor) : new Vector3(1, .91, .85), [settings.particleColor])
  const uniforms = useMemo(() => ({
    uResolution: { value: new Vector2(size.width, size.height) },
    uRect: { value: new Vector4(rect.x, rect.y, rect.width, rect.height) },
    uMatter: { value: resource.texture },
    uTime: { value: 0 },
    uWrite: { value: new Vector2(...write) },
    uFracture: { value: new Vector2(fracture[0], fracture[1] - fracture[0]) },
    uGlow: { value: settings.textGlow },
    uReduced: { value: Number(reducedMotion) },
    uSeed: { value: dissolveStyle.seed },
    uNoiseScale: { value: dissolveStyle.noiseScale },
    uNoiseStrength: { value: dissolveStyle.noiseStrength },
    uZoneWidth: { value: resource.raster.zoneWidth },
    uEdgeWidth: { value: dissolveStyle.edgeWidth },
    uEdgeIntensity: { value: dissolveStyle.edgeIntensity },
    uEdgeColor: { value: new Vector3(...dissolveStyle.edgeColor) },
    uInkColor: { value: inkColor },
  }), [dissolveStyle, fracture, inkColor, rect, resource, reducedMotion, settings, size.width, size.height, write])
  const dustUniforms = useMemo(() => ({
    uResolution: uniforms.uResolution,
    uTime: { value: 0 },
    uEnd: { value: options.getDissolveEnd?.(fracture[0]) ?? frames.dissolve[1] },
    uTravel: { value: settings.particleTravelDuration },
    uFade: { value: settings.particleFadeDuration },
    uWind: { value: settings.windStrength },
    uTurbulence: { value: settings.turbulence },
    uGlow: { value: settings.particleGlow },
    uDpr: { value: dpr },
    uOffset: { value: 0 },
    uDustColor: { value: particleColor },
  }), [dpr, frames.dissolve, fracture, options, particleColor, settings, uniforms.uResolution])

  useLayoutEffect(() => {
    const draw = () => {
      const time = options.getTime?.() ?? runtime.time
      const fractureStart = options.getFractureStart ? options.getFractureStart() : fracture[0]
      const emissionOffset = options.getEmissionOffset ? options.getEmissionOffset() : 0
      if (ink.current) {
        ink.current.uniforms.uTime!.value = time
        ink.current.uniforms.uFracture!.value.x = fractureStart ?? Number.MAX_SAFE_INTEGER
      }
      if (dust.current) {
        dust.current.uniforms.uTime!.value = time
        dust.current.uniforms.uOffset!.value = emissionOffset ?? Number.MAX_SAFE_INTEGER
        dust.current.uniforms.uEnd!.value = fractureStart === null ? Number.MAX_SAFE_INTEGER : options.getDissolveEnd?.(fractureStart) ?? frames.dissolve[1]
      }
      invalidate()
    }
    draw()
    return options.subscribeTime ? options.subscribeTime(draw) : runtime.subscribeFrame(draw)
  }, [runtime, invalidate, options, frames.dissolve, fracture])

  return <>
    <mesh frustumCulled={false} renderOrder={4}><planeGeometry args={[1, 1]} /><shaderMaterial ref={ink} uniforms={uniforms} vertexShader={inkVertex} fragmentShader={inkFragment} transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
    {!reducedMotion && <points geometry={resource.geometry} frustumCulled={false} renderOrder={5}><shaderMaterial ref={dust} uniforms={dustUniforms} vertexShader={dustVertex} fragmentShader={dustFragment} transparent depthTest={false} depthWrite={false} toneMapped={false} blending={AdditiveBlending} /></points>}
  </>
}
