/* R3F uniforms and GPU buffers are owned and updated outside React render state. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { processBlueEyePixels, type BlueEyePixelSample } from './blueParticleEye'
import { createIrisFiberField } from './irisFiberRibbons'
import type { LabConfig } from './config'

const PHOTO_VERTEX = `
attribute vec2 imageUv;
attribute vec3 sourceColor;
attribute float sourceBrightness;
attribute float pointRandom;
uniform vec2 irisCenter;
uniform vec2 irisRadii;
uniform float irisRotation;
uniform vec2 pupilCenter;
uniform vec2 pupilRadii;
uniform float pupilRotation;
uniform float pupilDarkness;
uniform float irisFocus;
uniform float outerEyeFade;
uniform float particleDepth;
uniform float particleDensity;
uniform float particleSize;
uniform float particleBrightness;
uniform float movement;
uniform float irisColorStrength;
uniform float particleScatter;
uniform float time;
varying vec3 vColor;
varying float vAlpha;
varying float vRadius;
float eyeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float eyeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(eyeHash(i),eyeHash(i+vec2(1.,0.)),f.x),mix(eyeHash(i+vec2(0.,1.)),eyeHash(i+vec2(1.,1.)),f.x),f.y);}
float eyeFbm(vec2 p){float sum=0.,amp=.5;mat2 rot=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){sum+=eyeNoise(p)*amp;p=rot*p*2.03;amp*=.5;}return sum;}
void main(){
 float c=cos(irisRotation),s=sin(irisRotation);vec2 d=imageUv-irisCenter;
 vec2 q=vec2(c*d.x+s*d.y,-s*d.x+c*d.y);vec2 irisPoint=vec2(q.x/irisRadii.x,-q.y/irisRadii.y);
 float radius=length(irisPoint);float support=1.025+(1.-irisFocus)*(1.1+(1.-outerEyeFade)*1.2);
 float pc=cos(pupilRotation),ps=sin(pupilRotation);vec2 pd=imageUv-pupilCenter;
 vec2 pupilQ=vec2(pc*pd.x+ps*pd.y,-ps*pd.x+pc*pd.y)/pupilRadii;
 float pupilRadius=length(pupilQ);float pupilMask=1.-smoothstep(.96,1.03,pupilRadius);
 if(radius>support||pointRandom>particleDensity){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vAlpha=0.;return;}
 float angle=atan(irisPoint.y,irisPoint.x);float micro=eyeFbm(vec2(angle*5.8+radius*1.2,radius*23.));
 float edgeFade=1.-smoothstep(.97,support,radius);float outerDim=mix(.4,.006,irisFocus)*mix(1.,.24,outerEyeFade);
 float irisMask=1.-smoothstep(.94,1.015,radius);
 float luminance=clamp(sourceBrightness,0.,1.);float energy=smoothstep(.018,.28,luminance);
 float radialLight=clamp(eyeFbm(vec2(angle*2.3,radius*4.6))*.45+.52,0.,1.);
 vec3 abyss=vec3(.006,.028,.1);vec3 midnight=vec3(.018,.11,.38);vec3 cobalt=vec3(.055,.4,1.12);vec3 cyan=vec3(.16,.78,1.35);
 vec3 blue=mix(abyss,midnight,smoothstep(.015,.2,energy));blue=mix(blue,cobalt,smoothstep(.1,.55,energy)*(.72+radialLight*.18));blue=mix(blue,cyan,smoothstep(.48,.82,energy)*(.48+micro*.28));
 blue*=mix(.86,1.72,clamp(energy*1.18+micro*.12,0.,1.));blue=mix(sourceColor,blue,irisColorStrength);
 float limbal=1.-.78*smoothstep(.895,.99,radius);blue*=limbal;
 vec3 outer=sourceColor*vec3(.18,.32,.58);outer=mix(outer,abyss,.72+irisFocus*.26);
 vec3 result=mix(outer,blue,irisMask);
 vec3 pupilColor=mix(sourceColor*.12,vec3(.00035,.00065,.0015),pupilDarkness);pupilColor=mix(pupilColor,sourceColor*.32,smoothstep(.48,.86,luminance)*.78);
 result=mix(result,pupilColor,pupilMask);
 float alpha=mix(edgeFade*outerDim,1.,irisMask);alpha=max(alpha,pupilMask*.94);alpha*=mix(.74,1.,energy)*(.78+micro*.22);alpha*=.46+.54*smoothstep(.03,.34,luminance);
 float jitter=(pointRandom-.5)*particleDepth*.055;vec3 position=vec3(irisPoint,.018+(luminance-.24)*particleDepth*.44+(1.-min(radius*radius,1.))*0.038+jitter);
 position.xy+=vec2(sin(pointRandom*41.7),cos(pointRandom*63.1))*particleScatter;
 position.xy+=vec2(sin(pointRandom*53.+time*.2),cos(pointRandom*39.-time*.17))*movement*.0015;
 vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(particleSize*(.72+pointRandom*.72)*6./-mv.z,.75,5.5);
 vColor=result*particleBrightness;vAlpha=alpha;vRadius=radius;
}`

const PHOTO_FRAGMENT = `
uniform float opacity;uniform float time;uniform float twinkle;
varying vec3 vColor;varying float vAlpha;varying float vRadius;
void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float core=1.-smoothstep(.38,1.,d);float pulse=1.-twinkle*.18+twinkle*.18*sin(time*1.4+vRadius*67.);gl_FragColor=vec4(vColor*(.78+.28*core),vAlpha*opacity*core*pulse);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`

const FIBER_VERTEX = `
attribute vec3 color;attribute float fiberAlpha;attribute float fiberProgress;attribute float fiberSeed;
uniform float time;uniform float animationSpeed;uniform float movement;
varying vec3 vColor;varying float vAlpha;varying float vProgress;varying float vSeed;
void main(){vec3 p=position;p.z+=sin(time*animationSpeed+fiberSeed*.031+fiberProgress*6.283)*movement*.002;vColor=color;vAlpha=fiberAlpha;vProgress=fiberProgress;vSeed=fiberSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`

const FIBER_FRAGMENT = `
uniform float opacity;uniform float brightness;uniform float time;uniform float animationSpeed;
varying vec3 vColor;varying float vAlpha;varying float vProgress;varying float vSeed;
float fiberHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fiberNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fiberHash(i),fiberHash(i+vec2(1.,0.)),f.x),mix(fiberHash(i+vec2(0.,1.)),fiberHash(i+vec2(1.,1.)),f.x),f.y);}
float fiberFbm(vec2 p){float sum=0.,amp=.5;mat2 rot=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){sum+=fiberNoise(p)*amp;p=rot*p*2.03;amp*=.5;}return sum;}
void main(){float micro=fiberFbm(vec2(vProgress*10.+vSeed*.011,time*.025+vSeed*.07));float shimmer=.94+.06*sin(time*animationSpeed+vSeed*.12+vProgress*5.);float structure=.84+.26*micro;vec3 c=vColor*brightness*structure*shimmer;gl_FragColor=vec4(c,vAlpha*opacity*(.86+micro*.14));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`

const SPARK_VERTEX = `attribute vec3 color;attribute float size;attribute float sparkAlpha;uniform float time;uniform float animationSpeed;uniform float movement;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;p.z+=sin(time*animationSpeed+position.x*17.+position.y*23.)*movement*.003;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*5.5/-mv.z,.8,5.);vColor=color;vAlpha=sparkAlpha*(.84+.16*sin(time*animationSpeed*2.+position.x*33.));}`
const SPARK_FRAGMENT = `uniform float opacity;uniform float brightness;varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float core=1.-smoothstep(.2,1.,d);gl_FragColor=vec4(vColor*brightness,vAlpha*opacity*core);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`

function geometryFromPixels(sample: BlueEyePixelSample) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sample.count * 3), 3))
  geometry.setAttribute('imageUv', new THREE.BufferAttribute(sample.uv, 2))
  geometry.setAttribute('sourceColor', new THREE.BufferAttribute(sample.color, 3))
  geometry.setAttribute('sourceBrightness', new THREE.BufferAttribute(sample.brightness, 1))
  geometry.setAttribute('pointRandom', new THREE.BufferAttribute(sample.random, 1))
  return geometry
}

function makeFiberGeometry(field: ReturnType<typeof createIrisFiberField>) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(field.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(field.colors, 3))
  geometry.setAttribute('fiberAlpha', new THREE.BufferAttribute(field.alpha, 1))
  geometry.setAttribute('fiberProgress', new THREE.BufferAttribute(field.progress, 1))
  geometry.setAttribute('fiberSeed', new THREE.BufferAttribute(field.seed, 1))
  return geometry
}

function makeSparkGeometry(field: ReturnType<typeof createIrisFiberField>) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(field.particlePositions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(field.particleColors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(field.particleSizes, 1))
  geometry.setAttribute('sparkAlpha', new THREE.BufferAttribute(field.particleAlpha, 1))
  return geometry
}

function sampleImagePixels(image: HTMLImageElement, maxEdge = 1536): BlueEyePixelSample {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas pixel sampling is unavailable')
  context.drawImage(image, 0, 0, width, height)
  return processBlueEyePixels(context.getImageData(0, 0, width, height).data, width, height, 2_400_000)
}

type BlueParticleEyeViewProps = {
  config: LabConfig
  imageSource: string
  onPointCount: (count: number) => void
  onStatus: (status: string) => void
}

export function BlueParticleEyeView(props: BlueParticleEyeViewProps) {
  // Source changes get a fresh loader owner; its effect cleanup releases the prior GPU geometry.
  return <BlueParticleEyeSourceView key={props.imageSource || 'no-source'} {...props} />
}

function BlueParticleEyeSourceView({ config, imageSource, onPointCount, onStatus }: BlueParticleEyeViewProps) {
  const [loaded, setLoaded] = useState<{ source: string; geometry: THREE.BufferGeometry; count: number } | null>(null)
  const sourceGeometry = loaded?.source === imageSource ? loaded.geometry : null
  const pointMaterial = useRef<THREE.ShaderMaterial | null>(null)
  const ribbonMaterial = useRef<THREE.ShaderMaterial | null>(null)
  const sparkMaterial = useRef<THREE.ShaderMaterial | null>(null)
  const photoUniforms = useMemo(() => ({
    irisCenter: { value: new THREE.Vector2() }, irisRadii: { value: new THREE.Vector2() }, irisRotation: { value: 0 },
    pupilCenter: { value: new THREE.Vector2() }, pupilRadii: { value: new THREE.Vector2() }, pupilRotation: { value: 0 },
    irisFocus: { value: 1 }, outerEyeFade: { value: 1 }, irisColorStrength: { value: 1 }, particleDepth: { value: 0.12 }, particleDensity: { value: 0.3 },
    particleSize: { value: 1.2 }, particleBrightness: { value: 1.3 }, movement: { value: 0 }, particleScatter: { value: 0.001 }, time: { value: 0 }, opacity: { value: 1 }, pupilDarkness: { value: 1 }, twinkle: { value: 0 },
  }), [])
  const fiberUniforms = useMemo(() => ({ time: { value: 0 }, animationSpeed: { value: 0.02 }, movement: { value: 0 }, opacity: { value: 1 }, brightness: { value: 1} }), [])
  const sparkUniforms = useMemo(() => ({ time: { value: 0 }, animationSpeed: { value: 0.02 }, movement: { value: 0 }, opacity: { value: 1 }, brightness: { value: 1} }), [])
  const blue = config.blueEye
  const originX = (Math.cos(blue.irisRotation) * (blue.pupilCenterX - blue.irisCenterX) + Math.sin(blue.irisRotation) * (blue.pupilCenterY - blue.irisCenterY)) / blue.irisRadiusX
  const originY = -(-Math.sin(blue.irisRotation) * (blue.pupilCenterX - blue.irisCenterX) + Math.cos(blue.irisRotation) * (blue.pupilCenterY - blue.irisCenterY)) / blue.irisRadiusY
  const innerRadius = Math.max(blue.pupilRadiusX / blue.irisRadiusX, blue.pupilRadiusY / blue.irisRadiusY) * 1.015
  const outerRadius = 0.97
  const field = useMemo(() => createIrisFiberField({ seed: 6013, density: blue.fiberDensity, curvature: blue.fiberCurvature, length: blue.fiberLength, thickness: blue.fiberThickness, layerSeparation: blue.fiberDepth, noiseScale: blue.fiberNoiseScale, originX, originY, innerRadius, outerRadius }), [blue.fiberDensity, blue.fiberCurvature, blue.fiberLength, blue.fiberThickness, blue.fiberDepth, blue.fiberNoiseScale, originX, originY, innerRadius, outerRadius])
  const fiberGeometry = useMemo(() => makeFiberGeometry(field), [field])
  const sparkGeometry = useMemo(() => makeSparkGeometry(field), [field])

  useEffect(() => {
    let active = true
    onPointCount(0)
    if (!imageSource) {
      onStatus('No source photo is available. Load an eye image to create blue iris particles.')
      return
    }
    onStatus('Reading the local eye photo into blue iris particles…')
    const image = new Image()
    image.onload = () => {
      if (!active) return
      try {
        const sample = sampleImagePixels(image)
        const geometry = geometryFromPixels(sample)
        setLoaded({ source: imageSource, geometry, count: sample.count })
        onPointCount(sample.count)
        onStatus(`Blue Particle Eye · ${sample.count.toLocaleString()} source pixels · ${sample.width} × ${sample.height}`)
      } catch (error) {
        onStatus(error instanceof Error ? `Blue Particle Eye failed: ${error.message}` : 'Blue Particle Eye failed')
      }
    }
    image.onerror = () => { if (active) { setLoaded(null); onPointCount(0); onStatus('Could not read the eye photo. Choose a PNG, JPEG, or WebP image.') } }
    image.src = imageSource
    return () => { active = false; image.onload = null; image.onerror = null }
  }, [imageSource, onPointCount, onStatus])
  useEffect(() => () => loaded?.geometry.dispose(), [loaded])
  useEffect(() => () => fiberGeometry.dispose(), [fiberGeometry])
  useEffect(() => () => sparkGeometry.dispose(), [sparkGeometry])

  useFrame((_, delta) => {
    if (!config.effects.paused) photoUniforms.time.value += Math.min(delta, 0.1)
    const e = photoUniforms
    e.irisCenter.value.set(blue.irisCenterX, blue.irisCenterY); e.irisRadii.value.set(blue.irisRadiusX, blue.irisRadiusY); e.irisRotation.value = blue.irisRotation
    e.pupilCenter.value.set(blue.pupilCenterX, blue.pupilCenterY); e.pupilRadii.value.set(blue.pupilRadiusX, blue.pupilRadiusY); e.pupilRotation.value = blue.pupilRotation
    e.irisFocus.value = blue.irisFocus; e.outerEyeFade.value = blue.outerEyeFade; e.irisColorStrength.value = blue.irisColorStrength; e.particleDepth.value = blue.particleDepth
    e.particleDensity.value = blue.particleDensity; e.particleSize.value = blue.particleSize; e.particleBrightness.value = blue.particleBrightness; e.movement.value = config.particles.movement
    e.particleScatter.value = blue.particleScatter
    e.opacity.value = config.display.particleOpacity * blue.particleOpacity; e.pupilDarkness.value = blue.pupilDarkness; e.twinkle.value = config.particles.twinkle
    for (const uniforms of [fiberUniforms, sparkUniforms]) {
      uniforms.time.value = e.time.value; uniforms.animationSpeed.value = blue.fiberAnimationSpeed; uniforms.movement.value = config.fibers.movement
      uniforms.opacity.value = blue.fiberOpacity * config.display.fiberOpacity; uniforms.brightness.value = blue.fiberBrightness
    }
  })

  return <group position={[0, 0, 0.75]}>
    {sourceGeometry && blue.showSourceParticles && <points geometry={sourceGeometry} frustumCulled={false}>
      <shaderMaterial ref={pointMaterial} vertexShader={PHOTO_VERTEX} fragmentShader={PHOTO_FRAGMENT} uniforms={photoUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>}
    {config.display.mode === 'Cinematic Fiber Iris' && blue.showFiberRibbons && <mesh geometry={fiberGeometry} frustumCulled={false}>
      <shaderMaterial ref={ribbonMaterial} vertexShader={FIBER_VERTEX} fragmentShader={FIBER_FRAGMENT} uniforms={fiberUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>}
    {config.display.mode === 'Cinematic Fiber Iris' && blue.showFiberSparks && <points geometry={sparkGeometry} frustumCulled={false}>
      <shaderMaterial ref={sparkMaterial} vertexShader={SPARK_VERTEX} fragmentShader={SPARK_FRAGMENT} uniforms={sparkUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>}
  </group>
}
