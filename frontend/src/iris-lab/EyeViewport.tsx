/* Three.js objects and uniforms are intentionally mutated by the render loop. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { loadIrisAssets, resolveIrisPhotoSource, type IrisAssets } from './assets'
import { sampleMemorySignalPixels } from './memorySignal'
import { MemorySignalBaseline } from './MemorySignalBaselineView'
import { memorySignalBaselineDefaults } from './memorySignalBaseline'
import { BlueParticleEyeView } from './BlueParticleEyeView'
import { getIrisBloomSettings, isPhotoIrisMode } from './config'
import type { CameraConfig, LabConfig, LabStats } from './config'
import { irisGradingFunctionsGlsl, irisGradingUniformsGlsl } from './gradingShader'

type Diagnostic = 'eye' | 'color' | 'authentic' | 'confidence' | 'particles'
type Props = { config: LabConfig; cameraView: number; onCameraChange: (camera: CameraConfig) => void; onCameraReader: (reader: (() => CameraConfig) | null) => void; onStats: (stats: LabStats) => void; onMemorySignalCount?: (count: number) => void; onBaselineStatus?: (status: string) => void; imageSource?: string | null; diagnostic?: Diagnostic; previewGrading?: boolean; albedoOnly?: boolean }

// A spherical cap sits just above the sclera. The UVs preserve the source image's
// circular margin; the particle export uses the same +Y-up orientation.
function cap(radius: number, bulge: number, base: number, uvMargin = 0): THREE.BufferGeometry {
  const segments = 128, rings = 32
  const pos: number[] = [], uv: number[] = [], index: number[] = []
  for (let j = 0; j <= rings; j++) {
    const r = j / rings
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2
      const x = r * Math.cos(angle), y = r * Math.sin(angle)
      pos.push(x * radius, y * radius, Math.max(base + bulge * (1 - r * r), Math.sqrt(Math.max(0, 1 - r * r * radius * radius)) + .009))
      uv.push(0.5 + x * (0.5 - uvMargin), 0.5 + y * (0.5 - uvMargin))
      if (j < rings && i < segments) {
        const a = j * (segments + 1) + i, b = a + segments + 1
        index.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(index); geometry.computeVertexNormals()
  return geometry
}

const irisVertex = `uniform float fiberEnabled; uniform float fiberDepth; varying vec2 vUv; void main(){vUv=uv; vec3 p=position; p.z+=fiberEnabled*fiberDepth; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`
const irisFragment = `uniform sampler2D map; uniform float brightness; uniform float contrast; uniform float saturation; uniform float detail; uniform float targetPupil; uniform float sourcePupil; uniform float eyeOpacity; uniform float fiberEnabled; uniform float fiberTime; uniform float fiberNoiseScale; uniform float fineFrequency; uniform float coarseFrequency; uniform float radialAlignment; uniform float fiberWidth; uniform float fiberOpacity; uniform float fiberBrightness; uniform float fiberAnimationSpeed; uniform float fiberDensity; uniform float fiberLength; uniform float fiberCurvature; uniform float fiberBranching; varying vec2 vUv;
float irisHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float irisNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=irisHash(i),b=irisHash(i+vec2(1.,0.)),c=irisHash(i+vec2(0.,1.)),d=irisHash(i+vec2(1.,1.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float irisFbm(vec2 p,int octaves){float sum=0.,amp=.5;mat2 rot=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){if(i>=octaves)break;sum+=irisNoise(p)*amp;p=rot*p*2.03;amp*=.5;}return sum;}
${irisGradingUniformsGlsl}
${irisGradingFunctionsGlsl}
void main(){ vec2 v=(vUv-.5)/.46; float r=length(v); if(r<targetPupil) discard;
float sourceR=sourcePupil+(r-targetPupil)*(1.-sourcePupil)/max(1.-targetPupil,.01);
vec2 uv=.5+normalize(v)*sourceR*.46; vec4 c=texture2D(map,uv); if(c.a<0.02) discard;
vec3 col=c.rgb; vec2 px=vec2(1./1024.,0.); vec3 blur=(texture2D(map,uv+px).rgb+texture2D(map,uv-px).rgb+texture2D(map,uv+px.yx).rgb+texture2D(map,uv-px.yx).rgb)*.25; col+= (col-blur)*(detail-1.);
float l=dot(col,vec3(.2126,.7152,.0722)); col=mix(vec3(l),col,saturation); col=(col-.5)*contrast+.5; col*=brightness; float normalizedRadius=clamp((r-targetPupil)/max(1.-targetPupil,.001),0.,1.); col=gradeIris(col,normalizedRadius);
if(fiberEnabled>.5){float t=fiberTime*fiberAnimationSpeed;float angle=atan(v.y,v.x);float fineCount=max(2.,fineFrequency*mix(.42,1.25,fiberDensity));float coarseCount=max(1.,coarseFrequency*mix(.7,1.15,fiberDensity));float bend=mix(.18,1.,fiberCurvature);vec2 q=v*fiberNoiseScale;vec2 warp=vec2(irisFbm(q*.65+vec2(t*.13,-t*.07),3),irisFbm(q*.65+vec2(17.3-t*.09,8.1+t*.11),3))-.5;float swirl=(irisFbm(vec2(normalizedRadius*coarseCount*.12,t*.18),3)-.5)*.72;float angularWarp=(irisFbm(vec2(angle*coarseCount*.18,normalizedRadius*coarseCount*.24)+warp*2.,5)-.5)*radialAlignment*1.7;float bentAngle=angle+swirl*radialAlignment*bend+angularWarp*bend;float fine=irisFbm(vec2(cos(bentAngle),sin(bentAngle))*fineFrequency+vec2(normalizedRadius*coarseCount,normalizedRadius*coarseCount*.35)+warp*2.,5);float coarse=irisFbm(vec2(cos(bentAngle),sin(bentAngle))*coarseCount+vec2(normalizedRadius*3.,-normalizedRadius*2.),5);float line=abs(sin(bentAngle*fineCount+(fine-.5)*2.4+(coarse-.5)*1.4));float lineMask=1.-smoothstep(fiberWidth,fiberWidth*3.2,line);float branchLine=1.-smoothstep(fiberWidth*1.4,fiberWidth*4.2,abs(sin(bentAngle*fineCount*.43+normalizedRadius*3.4+warp.x)));float fiberEnd=mix(.48,1.,clamp(fiberLength*.5,0.,1.));float radialFade=smoothstep(.015,.12,normalizedRadius)*(1.-smoothstep(fiberEnd-.05,fiberEnd+.02,normalizedRadius));float branches=branchLine*smoothstep(.55,.82,coarse)*fiberBranching*.48;float fibers=(lineMask*(.28+.72*fine)+smoothstep(.68,.86,coarse)*.2+branches)*radialFade*fiberDensity;vec3 cool=mix(vec3(.11,.29,.62),vec3(.64,.79,1.),clamp(fine*.9+coarse*.45,0.,1.));vec3 fiberColor=gradeIrisFiber(cool,normalizedRadius);col+=fiberColor*fibers*fiberOpacity*fiberBrightness*1.8;}
gl_FragColor=vec4(max(col,0.),c.a*eyeOpacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const pointVertex = `attribute vec3 color; attribute float size; uniform float pointSize; uniform float sizeVariation; uniform float depth; uniform float motion; uniform float time; uniform float speed; uniform float twinkle; uniform float pupil; uniform float irisRadius; uniform float irisBase; uniform float irisBulge; uniform float irisOffset; varying vec3 vColor; varying float vAlpha; varying float vRadius;
void main(){vec3 p=position; if(length(p.xy)<pupil){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;} float r2=dot(p.xy,p.xy); p.z += max(irisBase+irisBulge*(1.-r2)+irisOffset,sqrt(max(0.,1.-r2*irisRadius*irisRadius))+.009)-(1.02+irisOffset); p.z += position.z*depth + sin(time*speed+position.x*41.+position.y*19.)*motion*.01; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(pointSize*mix(1.,size,sizeVariation)*4./-mv.z,1.,8.); vColor=color; vRadius=length(position.xy); vAlpha=1.-twinkle*.5+twinkle*.5*sin(time*speed*2.+position.x*139.);}`
const pointFragment = `uniform float opacity; uniform float brightness; uniform float mixAmount; uniform float pupil; uniform vec3 glowColor; varying vec3 vColor; varying float vAlpha; varying float vRadius;
${irisGradingUniformsGlsl}
${irisGradingFunctionsGlsl}
void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; float a=pow(1.-d,2.)*opacity*vAlpha*.32; float normalizedRadius=clamp((vRadius-pupil)/max(1.-pupil,.001),0.,1.); vec3 base=gradeIris(vColor,normalizedRadius); vec3 c=mix(base,mix(base,glowColor,.35),mixAmount); gl_FragColor=vec4(c*brightness,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
// Pixel brightness creates shallow Z relief; the edge-weighted curl and
// soft edge sizing follow Memory Signal's image-particle treatment.
const memoryVertex = `attribute vec3 customColor; attribute float brightness; attribute float random; attribute float edgeFactor; uniform float uTime; uniform float uZRelief; uniform float uNoiseStrength; uniform float uEdgeDiffusion; uniform float uParticleSize; uniform float uScatter; uniform float uDepthCaptured; uniform float uModelScale; varying vec3 vColor; varying float vAlpha; varying float vEdge; varying float vRadius; varying float vBrightness;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);}
vec2 curl2(vec2 p){float e=.035;float dx=noise2(p+vec2(e,0.))-noise2(p-vec2(e,0.));float dy=noise2(p+vec2(0.,e))-noise2(p-vec2(0.,e));return normalize(vec2(dy,-dx)+vec2(1e-5));}
void main(){vec3 p=position;float modelScale=max(uModelScale,.01);float radius=length(p.xy/modelScale);float surface=sqrt(max(0.,modelScale*modelScale-dot(p.xy,p.xy)));float fallbackDepth=surface+.009*modelScale;p.z=mix(fallbackDepth,position.z,uDepthCaptured)+brightness*uZRelief;float edge=smoothstep(.08,.92,edgeFactor);vec2 flow=curl2(p.xy*5.+vec2(uTime*.07,uTime*-.04));float diffusion=uNoiseStrength*(.12+edge*uEdgeDiffusion);p.xy+=flow*diffusion+vec2(sin(random*31.+uTime*.22),cos(random*27.-uTime*.19))*uScatter*(.35+edge);p.z+=sin(uTime*.35+random*6.283)*uScatter*.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uParticleSize*(.72+brightness*1.5+random*.5)*(1.+edge*.9)*6./-mv.z,1.,7.);vColor=customColor;vAlpha=mix(.95,.58,edge);vEdge=edge;vRadius=radius;vBrightness=brightness;}`
const memoryFragment = `uniform float uOpacity; uniform float uColorIntensity; uniform float uTime; uniform float uTwinkle; varying vec3 vColor; varying float vAlpha; varying float vEdge; varying float vRadius; varying float vBrightness;
${irisGradingUniformsGlsl}
${irisGradingFunctionsGlsl}
void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float soft=1.-smoothstep(.42,1.,d);float twinkle=1.-uTwinkle*.22+uTwinkle*.22*sin(uTime*1.1+vRadius*54.);float radius=clamp(vRadius/1.5,0.,1.);vec3 c=gradeIris(vColor*mix(.25,1.2,vBrightness),radius)*uColorIntensity;float edgeFade=mix(1.,.72,vEdge);gl_FragColor=vec4(c,soft*vAlpha*twinkle*edgeFade*mix(.25,1.,vBrightness)*uOpacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const corneaVertex = `varying vec3 vNormal; varying vec3 vView; varying vec2 vUv; void main(){vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;}`
const corneaFragment = `uniform float opacity; uniform float reflection; uniform float roughness; varying vec3 vNormal; varying vec3 vView; varying vec2 vUv;
void main(){float fres=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.); vec2 p=vUv; float spot=exp(-length((p-vec2(.33,.70))*vec2(9.,15.))*(3.+roughness*5.)); float spot2=exp(-length((p-vec2(.73,.43))*vec2(13.,20.))*5.); float a=clamp(opacity*(.02+fres*.15)+reflection*(spot*.55+spot2*.16),0.,.85); gl_FragColor=vec4(vec3(.76,.86,1.)*(.35+reflection),a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`


const fiberVertex = `attribute vec3 color; attribute vec3 root; attribute vec3 parentRoot; attribute vec2 side; uniform float fiberLength; uniform float parentLength; uniform float parentCurvature; uniform float curvature; uniform float thickness; uniform float branching; uniform float time; uniform float movement; uniform float pupil; uniform float irisRadius; uniform float irisBase; uniform float irisBulge; uniform float irisOffset; varying vec3 vColor; varying float vRadius;
void main(){vec3 branchRoot=mix(parentRoot,root,parentLength); vec2 parentDelta=branchRoot.xy-parentRoot.xy; branchRoot.xy+=vec2(-parentDelta.y,parentDelta.x)*parentCurvature*.3; vec3 p=mix(root,position,fiberLength)+(branchRoot-root); vec2 d=p.xy-branchRoot.xy; p.xy+=vec2(-d.y,d.x)*(curvature*.3+branching*.15); p.xy+=side*thickness*.0012; float r2=dot(p.xy,p.xy); p.z+=max(irisBase+irisBulge*(1.-r2)+irisOffset,sqrt(max(0.,1.-r2*irisRadius*irisRadius))+.009)-(1.02+irisOffset); p.z+=sin(time+root.x*30.)*movement*.003; vColor=color; vRadius=length(p.xy); if(length(p.xy)<pupil) p.z-=.2; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`
const fiberFragment = `uniform float opacity; uniform float brightness; uniform float mixAmount; uniform float colorVariation; uniform float pupil; uniform vec3 glowColor; varying vec3 vColor; varying float vRadius;
${irisGradingUniformsGlsl}
${irisGradingFunctionsGlsl}
void main(){float normalizedRadius=clamp((vRadius-pupil)/max(1.-pupil,.001),0.,1.);vec3 graded=gradeIris(vColor,normalizedRadius);vec3 c=mix(graded,vec3(dot(graded,vec3(.3,.6,.1))),1.-colorVariation);c=mix(c,gradeFiberArtisticColor,clamp(gradeFiberArtisticMix,0.,1.));c=mix(c,mix(c,glowColor,.35),mixAmount);gl_FragColor=vec4(c*brightness,opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`

function particleGeometry(data: IrisAssets, stride: number): THREE.BufferGeometry {
  const count = Math.ceil(data.count / stride), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sizes = new Float32Array(count)
  for (let i=0; i<count; i++) { const n = Math.min(i*stride, data.count-1)*7; for(let j=0;j<3;j++){pos[i*3+j]=data.particles[n+j] ?? 0; col[i*3+j]=data.particles[n+j+3] ?? 0} sizes[i]=data.particles[n+6] ?? 1 }
  const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setAttribute('size',new THREE.BufferAttribute(sizes,1)); return g
}

function geometryFromMemorySignal(sample: ReturnType<typeof sampleMemorySignalPixels>): THREE.BufferGeometry {
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(sample.positions,3))
 geometry.setAttribute('customColor',new THREE.BufferAttribute(sample.colors,3))
 geometry.setAttribute('brightness',new THREE.BufferAttribute(sample.brightness,1))
 geometry.setAttribute('random',new THREE.BufferAttribute(sample.random,1))
 geometry.setAttribute('edgeFactor',new THREE.BufferAttribute(sample.edgeFactor,1))
 geometry.computeBoundingSphere()
 return geometry
}

function imagePixelPlane(image: CanvasImageSource, width: number, height: number, maxSize = 768) {
 const scale=Math.min(1,maxSize/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale))
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Canvas pixel sampling is unavailable')
 context.clearRect(0,0,w,h);context.drawImage(image,0,0,w,h)
 const pixels=context.getImageData(0,0,w,h)
 return {data:pixels.data,width:w,height:h}
}

// Fiber roots, pigment and depth come from the sampled reconstruction, with a
// deterministic curved radial trajectory. Two batches provide independent layers.
function fiberGeometry(data: IrisAssets, secondary: boolean): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], roots: number[] = [], parents: number[] = [], sides: number[] = []
  // A one-time local image gradient estimates each photographed structure's tangent.
  // The radial prior constrains uncertain low-contrast or reconstructed areas.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024
  const context = canvas.getContext('2d', { willReadFrequently: true }); let pixels: Uint8ClampedArray | undefined
  if (context) { context.drawImage(data.cinematic.image as CanvasImageSource, 0, 0, 1024, 1024); pixels=context.getImageData(0,0,1024,1024).data }
  const light=(x:number,y:number)=>{if(!pixels)return 0; const i=(Math.max(0,Math.min(1023,y))*1024+Math.max(0,Math.min(1023,x)))*4;return .2126*pixels[i]!+.7152*pixels[i+1]!+.0722*pixels[i+2]!}
  const count=1800
  for(let i=0;i<count;i++) {
    const n=((i*37)%data.count)*7
    const x=data.particles[n]??0,y=data.particles[n+1]??0,z=data.particles[n+2]??0,r=Math.hypot(x,y); if(r<.2||r>.94)continue
    const px=Math.round(512+x*471),py=Math.round(512-y*471), gx=light(px+2,py)-light(px-2,py), gy=-(light(px,py+2)-light(px,py-2));
    let tx=-gy,ty=gx; const tl=Math.hypot(tx,ty); const radialX=x/r,radialY=y/r
    if(tl>1){tx/=tl;ty/=tl;if(tx*radialX+ty*radialY<0){tx=-tx;ty=-ty}}else{tx=radialX;ty=radialY}
    const baseDx=radialX*.75+tx*.25,baseDy=radialY*.75+ty*.25, baseLength=.11*(.5+(i%17)/17); const fork=secondary?(((i%2)*2-1)*.38):0; const dx=baseDx-baseDy*fork,dy=baseDy+baseDx*fork,length=baseLength*(secondary?.42:1),bend=((i%11)-5)*.003; const startX=x+(secondary?baseDx*baseLength*.55:0),startY=y+(secondary?baseDy*baseLength*.55:0)
    const color=[data.particles[n+3]??0,data.particles[n+4]??0,data.particles[n+5]??0]
    const v=(t:number,sign:number)=>{const qx=startX+dx*length*t-dy*bend*t*t,qy=startY+dy*length*t+dx*bend*t*t;positions.push(qx,qy,z*.15+.006+.004*Math.sin(t*Math.PI));roots.push(startX,startY,z*.15+.006);parents.push(x,y,z*.15+.006);colors.push(...color);sides.push(-dy*sign,dx*sign)}
    for(let k=0;k<4;k++){const a=k/4,b=(k+1)/4;v(a,-1);v(a,1);v(b,-1);v(a,1);v(b,1);v(b,-1)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('root',new THREE.Float32BufferAttribute(roots,3));g.setAttribute('parentRoot',new THREE.Float32BufferAttribute(parents,3));g.setAttribute('side',new THREE.Float32BufferAttribute(sides,2));return g
}

function lidEdge(x:number, upper:boolean) { const f=Math.sqrt(Math.max(0,1-(x/1.02)**2)); return (upper?1:-1)*(upper?.40:.34)*f + .025*x }
function lidGeometry(upper:boolean):THREE.BufferGeometry {
 const verts:number[]=[], cols:number[]=[], idx:number[]=[]; const steps=100, rows=6
 for(let j=0;j<=rows;j++)for(let i=0;i<=steps;i++){
  const t=j/rows,x=-1.04+i*2.08/steps,edge=lidEdge(x,upper),y=edge+(upper?1:-1)*t*(upper?.3:.23)
  verts.push(x,y,1.01-t*.14);const k=.80+t*.2, alpha=Math.min(1,(1-t)*3)*Math.min(1,(1.04-Math.abs(x))*12);cols.push(.46*k,.29*k,.26*k,alpha)
  if(j<rows&&i<steps){const a=j*(steps+1)+i,b=a+steps+1;idx.push(a,b,a+1,b,b+1,a+1)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,4));g.setIndex(idx);g.computeVertexNormals();return g
}
function lashesGeometry(): THREE.BufferGeometry {
 const pts:number[]=[],cols:number[]=[]
 for(const upper of [true,false])for(let i=0;i<(upper?75:45);i++){
  const count=upper?75:45, x=-.94+i*1.88/(count-1), edge=lidEdge(x,upper), side=upper?1:-1
  const seed=Math.sin(i*73.7+(upper?2:8))*43758.5453, variance=seed-Math.floor(seed)
  const length=(upper?.075:.04)+variance*(upper?.075:.035), lean=.025*x+(.5-variance)*.018
  for(let k=0;k<4;k++)for(const [t,sign] of [[k/4,-1],[k/4,1],[(k+1)/4,-1],[k/4,1],[(k+1)/4,1],[(k+1)/4,-1]] as [number,number][]){
   const width=.0017*(1-t*.8);pts.push(x+lean*t+sign*width,edge+side*length*t*t,1.024+Math.sin(t*Math.PI)*.015);cols.push(.10,.067,.06)
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();return g
}

function CameraRig({config, revision, onChange, onCameraReader}: {config: CameraConfig; revision: number; onChange: Props['onCameraChange']; onCameraReader: Props['onCameraReader']}) {
 const {camera,gl}=useThree(); const controls=useMemo(()=>new OrbitControls(camera,gl.domElement),[camera,gl]); const configRef=useRef(config); const cb=useRef(onChange); const publishAt=useRef(0); useEffect(()=>{configRef.current=config;cb.current=onChange},[config,onChange])
 useEffect(()=>{controls.enablePan=false; controls.enableDamping=true; controls.dampingFactor=.08; controls.minDistance=1.3; controls.maxDistance=8; controls.maxPolarAngle=Math.PI/2+.8; controls.minPolarAngle=Math.PI/2-.8; controls.minAzimuthAngle=-1; controls.maxAzimuthAngle=1; const read=()=>{ const delta=camera.position.clone().sub(controls.target); const s=new THREE.Spherical().setFromVector3(delta); return {...configRef.current,distance:s.radius,azimuth:s.theta,elevation:Math.PI/2-s.phi,targetX:controls.target.x,targetY:controls.target.y} }; const end=()=>cb.current(read()); onCameraReader(read); controls.addEventListener('end',end); return ()=>{onCameraReader(null);controls.removeEventListener('end',end);controls.dispose()} },[camera,controls,onCameraReader])
 useEffect(()=>{controls.target.set(config.targetX,config.targetY,.75); const s=new THREE.Spherical(config.distance,Math.PI/2-config.elevation,config.azimuth);camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(controls.target)); if(camera instanceof THREE.PerspectiveCamera){camera.fov=config.fov;camera.updateProjectionMatrix()} controls.update()},[revision,controls,camera,config.distance,config.azimuth,config.elevation,config.targetX,config.targetY,config.fov])
 useEffect(()=>{controls.enabled=!config.locked;controls.autoRotate=config.autoRotate;controls.autoRotateSpeed=config.autoSpeed; if(camera instanceof THREE.PerspectiveCamera){camera.fov=config.fov;camera.updateProjectionMatrix()}},[camera,config,controls])
 useFrame((_,delta)=>{controls.update(); if(config.autoRotate && !config.locked){publishAt.current+=delta;if(publishAt.current>=.5){publishAt.current=0;const d=camera.position.clone().sub(controls.target), spherical=new THREE.Spherical().setFromVector3(d);cb.current({...configRef.current,distance:spherical.radius,azimuth:spherical.theta,elevation:Math.PI/2-spherical.phi,targetX:controls.target.x,targetY:controls.target.y})}}});return null
}

function Post({config,albedoOnly,baseline}: {config:LabConfig;albedoOnly:boolean;baseline:boolean}) {
 const {gl,scene,camera,size}=useThree(); const composer=useMemo(()=>{ const c=new EffectComposer(gl);c.addPass(new RenderPass(scene,camera));c.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.2,.35,.85));if(!baseline)c.addPass(new OutputPass());return c },[gl,scene,camera,baseline])
 useEffect(()=>{const previous=gl.info.autoReset;gl.info.autoReset=false;return()=>{gl.info.autoReset=previous;composer.passes.forEach(p=>p.dispose());composer.dispose()}},[composer,gl]);useEffect(()=>{composer.setSize(size.width,size.height)},[composer,size]);
 useFrame(()=>{
  if(albedoOnly){gl.toneMapping=THREE.NoToneMapping;gl.toneMappingExposure=1;gl.info.reset();gl.render(scene,camera);return}
  gl.toneMapping=baseline||config.effects.toneMapping===0?THREE.NoToneMapping:config.effects.toneMapping===1?THREE.ReinhardToneMapping:THREE.ACESFilmicToneMapping
  gl.toneMappingExposure=baseline?1:config.effects.exposure
  const irisBloom=getIrisBloomSettings(config)
  const bloom=composer.passes[1] as UnrealBloomPass
  bloom.enabled=baseline||irisBloom.enabled
  bloom.strength=baseline?memorySignalBaselineDefaults.bloomStrength:irisBloom.strength
  bloom.radius=baseline?memorySignalBaselineDefaults.bloomRadius:config.effects.bloomRadius
  bloom.threshold=baseline?memorySignalBaselineDefaults.bloomThreshold:config.effects.bloomThreshold
  gl.info.reset();composer.render()
 },1);return null
}

function Environment({strength}:{strength:number}) {
 const {gl,scene}=useThree()
 useEffect(()=>{const old=scene.environment;const oldIntensity=scene.environmentIntensity;const generator=new THREE.PMREMGenerator(gl);const room=new RoomEnvironment();const target=generator.fromScene(room);scene.environment=target.texture;return()=>{scene.environment=old;scene.environmentIntensity=oldIntensity;target.dispose();room.dispose();generator.dispose()}},[gl,scene])
 useEffect(()=>{scene.environmentIntensity=strength*.1},[scene,strength])
 return null
}

type GradingUniforms = Record<string, THREE.IUniform>
function createGradingUniforms(): GradingUniforms {
 return {
  gradeEnabled:{value:0}, gradeStrength:{value:0}, gradeTargetBlueHue:{value:0}, gradeBlueChroma:{value:0},
  gradeGrayRecolorStrength:{value:0}, gradeLightnessPreservation:{value:1}, gradeBrightness:{value:0}, gradeContrast:{value:1},
  gradeInnerZoneRadius:{value:.2}, gradeAmberHue:{value:75}, gradeAmberChroma:{value:.08}, gradeAmberPreservation:{value:1}, gradeAmberTransitionWidth:{value:.09},
  gradeMiddleBlueHue:{value:238}, gradeMiddleBlueChroma:{value:.07}, gradeMiddleColorStrength:{value:1}, gradeOuterZoneStart:{value:.74},
  gradeOuterBlueHue:{value:231}, gradeOuterBlueChroma:{value:.05}, gradeOuterColorStrength:{value:.8}, gradeLimbalRingHue:{value:226}, gradeLimbalRingChroma:{value:.03}, gradeLimbalRingDarkness:{value:.18},
  gradeFiberArtisticColor:{value:new THREE.Color('#9abde3')}, gradeFiberArtisticMix:{value:.12},
 }
}

function syncGradingUniforms(uniforms: GradingUniforms, grade: LabConfig['colorGrading'], previewGrading: boolean) {
 const enabled=uniforms.gradeEnabled!, strength=uniforms.gradeStrength!
 enabled.value=grade.enabled && previewGrading ? 1 : 0
 strength.value=grade.strength
 uniforms.gradeTargetBlueHue!.value=grade.targetBlueHue
 uniforms.gradeBlueChroma!.value=grade.blueChroma
 uniforms.gradeGrayRecolorStrength!.value=grade.grayRecolorStrength
 uniforms.gradeLightnessPreservation!.value=grade.lightnessPreservation
 uniforms.gradeBrightness!.value=grade.brightness
 uniforms.gradeContrast!.value=grade.contrast
 uniforms.gradeInnerZoneRadius!.value=grade.innerZoneRadius
 uniforms.gradeAmberHue!.value=grade.amberHue
 uniforms.gradeAmberChroma!.value=grade.amberChroma
 uniforms.gradeAmberPreservation!.value=grade.amberPreservation
 uniforms.gradeAmberTransitionWidth!.value=grade.amberTransitionWidth
 uniforms.gradeMiddleBlueHue!.value=grade.middleBlueHue
 uniforms.gradeMiddleBlueChroma!.value=grade.middleBlueChroma
 uniforms.gradeMiddleColorStrength!.value=grade.middleColorStrength
 uniforms.gradeOuterZoneStart!.value=grade.outerZoneStart
 uniforms.gradeOuterBlueHue!.value=grade.outerBlueHue
 uniforms.gradeOuterBlueChroma!.value=grade.outerBlueChroma
 uniforms.gradeOuterColorStrength!.value=grade.outerColorStrength
 uniforms.gradeLimbalRingHue!.value=grade.limbalRingHue
 uniforms.gradeLimbalRingChroma!.value=grade.limbalRingChroma
 uniforms.gradeLimbalRingDarkness!.value=grade.limbalRingDarkness
 ;(uniforms.gradeFiberArtisticColor!.value as THREE.Color).set(grade.fiberArtisticColor)
 // Before must restore source RGB for fibres too, while keeping the saved artistic mix untouched.
 uniforms.gradeFiberArtisticMix!.value=previewGrading?grade.fiberArtisticMix:0
}

function syncMaterialUniformValues(material: THREE.ShaderMaterial | null, source: Record<string, THREE.IUniform>) {
 if(!material)return
 for(const [name,sourceUniform] of Object.entries(source)) {
  const target=material.uniforms[name]
  if(!target)continue
  if(sourceUniform.value instanceof THREE.Color && target.value instanceof THREE.Color)target.value.copy(sourceUniform.value)
  else target.value=sourceUniform.value
 }
}

function Eye({config:c,assets,diagnostic,previewGrading,albedoOnly,imageSource,onMemorySignalCount}: {config:LabConfig;assets:IrisAssets;diagnostic:Diagnostic;previewGrading:boolean;albedoOnly:boolean;imageSource?:string|null;onMemorySignalCount?:Props['onMemorySignalCount']}) {
 const {gl,scene}=useThree()
 const irisMaterialRef=useRef<THREE.ShaderMaterial|null>(null),rawParticleMaterialRef=useRef<THREE.ShaderMaterial|null>(null),microMaterialRef=useRef<THREE.ShaderMaterial|null>(null),atmosphereMaterialRef=useRef<THREE.ShaderMaterial|null>(null),highlightMaterialRef=useRef<THREE.ShaderMaterial|null>(null),primaryFiberMaterialRef=useRef<THREE.ShaderMaterial|null>(null),secondaryFiberMaterialRef=useRef<THREE.ShaderMaterial|null>(null)
 const modelRootRef=useRef<THREE.Group|null>(null),modelBodyRootRef=useRef<THREE.Group|null>(null),overlayRootRef=useRef<THREE.Group|null>(null)
 const [sourcePlane,setSourcePlane]=useState<{data:Uint8ClampedArray;width:number;height:number;depthData?:Uint8ClampedArray;depthScale?:number;worldSpan?:number}|null>(null)
 const memorySample=useMemo(()=>sourcePlane?sampleMemorySignalPixels(sourcePlane,c.memorySignal):null,[sourcePlane,c.memorySignal])
 const memoryGeometry=useMemo(()=>memorySample?geometryFromMemorySignal(memorySample):new THREE.BufferGeometry(),[memorySample])
 const memoryPointsRef=useRef<THREE.Points|null>(null),memoryMaterialRef=useRef<THREE.ShaderMaterial|null>(null)
 const captureSignature=JSON.stringify({eye:c.eye,material:c.material,lighting:c.lighting,grade:c.colorGrading,layers:{eyeball:c.layers.eyeball,iris:c.layers.iris,pupil:c.layers.pupil,cornea:c.layers.cornea,eyelids:c.layers.eyelids,eyelashes:c.layers.eyelashes}})
 const points=useMemo(()=>particleGeometry(assets,1),[assets]);const highlights=useMemo(()=>particleGeometry(assets,19),[assets]);const primary=useMemo(()=>fiberGeometry(assets,false),[assets]);const secondary=useMemo(()=>fiberGeometry(assets,true),[assets]);const lashes=useMemo(()=>lashesGeometry(),[]);const upperLid=useMemo(()=>lidGeometry(true),[]);const lowerLid=useMemo(()=>lidGeometry(false),[])
 const surfaceBase=Math.sqrt(1-c.eye.irisRadius*c.eye.irisRadius)+.012;const surfaceBulge=1.02-surfaceBase;const iris=useMemo(()=>cap(c.eye.irisRadius,surfaceBulge,surfaceBase+c.eye.irisDepth,.04),[c.eye.irisRadius,c.eye.irisDepth,surfaceBase,surfaceBulge]);const cornea=useMemo(()=>cap(c.eye.irisRadius*1.12*c.eye.corneaScale,surfaceBulge+.1*c.eye.corneaCurvature,surfaceBase+.025+c.eye.irisDepth),[c.eye.irisRadius,c.eye.corneaScale,c.eye.corneaCurvature,c.eye.irisDepth,surfaceBase,surfaceBulge]);
 useEffect(()=>()=>{points.dispose();highlights.dispose();primary.dispose();secondary.dispose();lashes.dispose();upperLid.dispose();lowerLid.dispose()},[points,highlights,primary,secondary,lashes,upperLid,lowerLid]);useEffect(()=>()=>iris.dispose(),[iris]);useEffect(()=>()=>cornea.dispose(),[cornea]);
 const irisUniforms=useMemo(()=>({map:{value:assets.cinematic},brightness:{value:1},contrast:{value:1},saturation:{value:1},detail:{value:1},targetPupil:{value:.19},sourcePupil:{value:assets.pupilRatio},eyeOpacity:{value:1},fiberEnabled:{value:0},fiberDepth:{value:.014},fiberTime:{value:0},fiberNoiseScale:{value:7},fineFrequency:{value:72},coarseFrequency:{value:18},radialAlignment:{value:.88},fiberWidth:{value:.018},fiberOpacity:{value:.86},fiberBrightness:{value:.8},fiberAnimationSpeed:{value:.018},fiberDensity:{value:.8},fiberLength:{value:1},fiberCurvature:{value:.2},fiberBranching:{value:.4},...createGradingUniforms()}),[assets])
 const signalUniforms=useMemo(()=>({uTime:{value:0},uZRelief:{value:.12},uNoiseStrength:{value:.028},uEdgeDiffusion:{value:.8},uParticleSize:{value:.88},uScatter:{value:.018},uOpacity:{value:.9},uColorIntensity:{value:1.12},uTwinkle:{value:.2},uDepthCaptured:{value:0},uModelScale:{value:1},...createGradingUniforms()}),[])
 const captureSignatureRef=useRef('')
 useEffect(()=>{
  let active=true
  const readModel=()=>{
   const root=modelRootRef.current
   if(!root)return null
   const body=modelBodyRootRef.current,overlays=overlayRootRef.current,memoryPoints=memoryPointsRef.current,wasRoot=root.visible,wasBody=body?.visible??false,wasOverlay=overlays?.visible??false,wasMemoryPoints=memoryPoints?.visible??false,wasProcedural=irisUniforms.fiberEnabled.value,background=scene.background,oldOverride=scene.overrideMaterial,oldTarget=gl.getRenderTarget(),oldTone=gl.toneMapping,oldExposure=gl.toneMappingExposure,oldClear=gl.getClearColor(new THREE.Color()).clone(),oldAlpha=gl.getClearAlpha(),oldAutoClear=gl.autoClear
   const width=640,height=640,target=new THREE.WebGLRenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});target.texture.colorSpace=THREE.SRGBColorSpace
   const depthTarget=new THREE.WebGLRenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});depthTarget.texture.colorSpace=THREE.NoColorSpace
   const depthMaterial=new THREE.ShaderMaterial({vertexShader:'varying float vWorldZ; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorldZ=world.z;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'varying float vWorldZ; void main(){float d=clamp(vWorldZ/2.,0.,1.);float hi=floor(d*255.)/255.;float lo=fract(d*255.);gl_FragColor=vec4(hi,lo,0.,1.);}',side:THREE.DoubleSide,toneMapped:false})
   const camera=new THREE.OrthographicCamera(-1.3,1.3,1.3,-1.3,.01,20);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateProjectionMatrix()
   const bytes=new Uint8Array(width*height*4),depthBytes=new Uint8Array(width*height*4)
   try{
    root.visible=true;if(body)body.visible=true;if(overlays)overlays.visible=false;if(memoryPoints)memoryPoints.visible=false;irisUniforms.fiberEnabled.value=0;scene.background=null;gl.autoClear=true;gl.toneMapping=c.effects.toneMapping===0?THREE.NoToneMapping:c.effects.toneMapping===1?THREE.ReinhardToneMapping:THREE.ACESFilmicToneMapping;gl.toneMappingExposure=c.effects.exposure;gl.setRenderTarget(target);gl.setClearColor(0x000000,0);gl.clear(true,true,true);gl.render(scene,camera);gl.readRenderTargetPixels(target,0,0,width,height,bytes)
    // WebGL's readback starts at the bottom row; flip into Canvas top-left order.
    const flipped=new Uint8ClampedArray(bytes.length),flippedDepth=new Uint8ClampedArray(depthBytes.length),row=width*4
    for(let y=0;y<height;y++)flipped.set(bytes.subarray(y*row,(y+1)*row),(height-1-y)*row)
    scene.overrideMaterial=depthMaterial;gl.setRenderTarget(depthTarget);gl.setClearColor(0x000000,0);gl.clear(true,true,true);gl.render(scene,camera);gl.readRenderTargetPixels(depthTarget,0,0,width,height,depthBytes)
    for(let y=0;y<height;y++)flippedDepth.set(depthBytes.subarray(y*row,(y+1)*row),(height-1-y)*row)
    return {data:flipped,depthData:flippedDepth,depthScale:2,worldSpan:2.6,width,height}
   }finally{scene.overrideMaterial=oldOverride;gl.setRenderTarget(oldTarget);gl.setClearColor(oldClear,oldAlpha);gl.autoClear=oldAutoClear;gl.toneMapping=oldTone;gl.toneMappingExposure=oldExposure;scene.background=background;root.visible=wasRoot;if(body)body.visible=wasBody;if(overlays)overlays.visible=wasOverlay;if(memoryPoints)memoryPoints.visible=wasMemoryPoints;irisUniforms.fiberEnabled.value=wasProcedural;target.dispose();depthTarget.dispose();depthMaterial.dispose()}
  }
  const load=async()=>{
   try{
    if(imageSource){const image=new Image();image.src=imageSource;await image.decode();if(active)setSourcePlane(imagePixelPlane(image,image.naturalWidth,image.naturalHeight));return}
    const pixels=readModel();if(pixels&&active)setSourcePlane(pixels)
   }catch(error){if(active){setSourcePlane(null);console.error('Memory Signal source capture failed',error)}}
  }
  if(imageSource){captureSignatureRef.current='';void load();return()=>{active=false}}
  if(captureSignatureRef.current!==captureSignature){captureSignatureRef.current=captureSignature;const id=requestAnimationFrame(()=>void load());return()=>{active=false;cancelAnimationFrame(id)}}
  return()=>{active=false}
 },[imageSource,captureSignature,gl,scene,c.effects.toneMapping,c.effects.exposure,irisUniforms.fiberEnabled])
 useEffect(()=>{onMemorySignalCount?.(memorySample?.count??0)},[memorySample,onMemorySignalCount])
 useEffect(()=>()=>memoryGeometry.dispose(),[memoryGeometry])
 const uniforms=useMemo(()=>({pointSize:{value:1},sizeVariation:{value:1},depth:{value:1},motion:{value:0},time:{value:0},speed:{value:1},twinkle:{value:0},pupil:{value:.18},irisRadius:{value:.55},irisBase:{value:.85},irisBulge:{value:.17},irisOffset:{value:0},glowColor:{value:new THREE.Color()},opacity:{value:1},brightness:{value:1},mixAmount:{value:0},...createGradingUniforms()}),[])
 const fiberUniforms=useMemo(()=>({fiberLength:{value:1},parentLength:{value:1},parentCurvature:{value:0},curvature:{value:0},thickness:{value:1},branching:{value:0},pupil:{value:.18},irisRadius:{value:.55},irisBase:{value:.85},irisBulge:{value:.17},irisOffset:{value:0},glowColor:{value:new THREE.Color()},time:{value:0},movement:{value:0},opacity:{value:1},brightness:{value:1},mixAmount:{value:0},colorVariation:{value:1},...createGradingUniforms()}),[])
 const secondaryUniforms=useMemo(()=>THREE.UniformsUtils.clone(fiberUniforms),[fiberUniforms])
 const glowUniforms=useMemo(()=>({pointSize:{value:1},sizeVariation:{value:1},depth:{value:1},motion:{value:0},time:{value:0},speed:{value:1},twinkle:{value:0},pupil:{value:.18},irisRadius:{value:.55},irisBase:{value:.85},irisBulge:{value:.17},irisOffset:{value:0},glowColor:{value:new THREE.Color()},opacity:{value:1},brightness:{value:1},mixAmount:{value:0},...createGradingUniforms()}),[])
 const elapsed=useRef(0)
 useFrame((_,delta)=>{
  if(!c.effects.paused)elapsed.current+=Math.min(delta,.1)
  uniforms.time.value=elapsed.current;uniforms.pointSize.value=c.particles.size;uniforms.sizeVariation.value=c.particles.sizeVariation;uniforms.depth.value=c.particles.depth*10;uniforms.motion.value=c.particles.movement;uniforms.speed.value=c.particles.speed;uniforms.irisRadius.value=c.eye.irisRadius;uniforms.irisBase.value=surfaceBase;uniforms.irisBulge.value=surfaceBulge;uniforms.irisOffset.value=c.eye.irisDepth;uniforms.twinkle.value=c.particles.twinkle;uniforms.pupil.value=c.eye.pupilRadius/c.eye.irisRadius;uniforms.glowColor.value.set(c.effects.glowColor);uniforms.opacity.value=c.particles.opacity;uniforms.brightness.value=c.particles.brightness+c.particles.glow;uniforms.mixAmount.value=c.effects.mix
  glowUniforms.pointSize.value=c.particles.size*3;glowUniforms.sizeVariation.value=c.particles.sizeVariation;glowUniforms.depth.value=c.particles.depth*10;glowUniforms.motion.value=c.particles.movement;glowUniforms.time.value=elapsed.current;glowUniforms.speed.value=c.particles.speed;glowUniforms.twinkle.value=c.particles.twinkle;glowUniforms.irisRadius.value=c.eye.irisRadius;glowUniforms.irisBase.value=surfaceBase;glowUniforms.irisBulge.value=surfaceBulge;glowUniforms.irisOffset.value=c.eye.irisDepth;glowUniforms.pupil.value=c.eye.pupilRadius/c.eye.irisRadius;glowUniforms.glowColor.value.set(c.effects.glowColor);glowUniforms.opacity.value=c.particles.opacity*.1*c.particles.glow;glowUniforms.brightness.value=c.particles.brightness;glowUniforms.mixAmount.value=c.effects.mix
  const grade=c.colorGrading
  syncGradingUniforms(irisUniforms,grade,previewGrading);syncGradingUniforms(uniforms,grade,previewGrading);syncGradingUniforms(glowUniforms,grade,previewGrading);syncGradingUniforms(fiberUniforms,grade,previewGrading);syncGradingUniforms(secondaryUniforms,grade,previewGrading);syncGradingUniforms(signalUniforms,grade,previewGrading)
  for(const material of [irisMaterialRef.current,rawParticleMaterialRef.current,microMaterialRef.current,atmosphereMaterialRef.current,highlightMaterialRef.current,primaryFiberMaterialRef.current,secondaryFiberMaterialRef.current,memoryMaterialRef.current])if(material)syncGradingUniforms(material.uniforms as GradingUniforms,grade,previewGrading)
  irisUniforms.brightness.value=c.material.irisBrightness;irisUniforms.contrast.value=c.material.irisContrast;irisUniforms.saturation.value=c.material.irisSaturation;irisUniforms.detail.value=c.material.irisDetail;irisUniforms.targetPupil.value=c.eye.pupilRadius/c.eye.irisRadius
  irisUniforms.eyeOpacity.value=c.display.modelOpacity;irisUniforms.fiberEnabled.value=c.layers.proceduralFibers?1:0;irisUniforms.fiberDepth.value=c.fibers.depth;irisUniforms.fiberTime.value=elapsed.current;irisUniforms.fiberNoiseScale.value=c.fibers.noiseScale;irisUniforms.fineFrequency.value=c.fibers.fineFrequency;irisUniforms.coarseFrequency.value=c.fibers.coarseFrequency;irisUniforms.radialAlignment.value=c.fibers.radialAlignment;irisUniforms.fiberWidth.value=.012+c.fibers.thickness*.028;irisUniforms.fiberOpacity.value=c.fibers.opacity*c.display.fiberOpacity;irisUniforms.fiberBrightness.value=c.fibers.brightness+c.fibers.glow;irisUniforms.fiberAnimationSpeed.value=c.fibers.animationSpeed;irisUniforms.fiberDensity.value=c.fibers.density;irisUniforms.fiberLength.value=c.fibers.length;irisUniforms.fiberCurvature.value=c.fibers.curvature;irisUniforms.fiberBranching.value=c.fibers.branching
  fiberUniforms.fiberLength.value=c.fibers.length;fiberUniforms.curvature.value=c.fibers.curvature;fiberUniforms.time.value=elapsed.current;fiberUniforms.movement.value=c.fibers.movement;fiberUniforms.thickness.value=c.fibers.thickness;fiberUniforms.branching.value=0;fiberUniforms.irisRadius.value=c.eye.irisRadius;fiberUniforms.irisBase.value=surfaceBase;fiberUniforms.irisBulge.value=surfaceBulge;fiberUniforms.irisOffset.value=c.eye.irisDepth;fiberUniforms.pupil.value=c.eye.pupilRadius/c.eye.irisRadius;fiberUniforms.glowColor.value.set(c.effects.glowColor);fiberUniforms.opacity.value=.35;fiberUniforms.brightness.value=c.fibers.brightness+c.fibers.glow;fiberUniforms.mixAmount.value=c.effects.mix;fiberUniforms.colorVariation.value=c.fibers.colorVariation
  for(const key of Object.keys(fiberUniforms) as (keyof typeof fiberUniforms)[]){secondaryUniforms[key]!.value=fiberUniforms[key].value}
  secondaryUniforms.branching.value=c.fibers.branching;secondaryUniforms.parentLength.value=c.fibers.length;secondaryUniforms.parentCurvature.value=c.fibers.curvature;secondaryUniforms.fiberLength.value=c.fibers.secondaryLength;secondaryUniforms.thickness.value=c.fibers.secondaryThickness;secondaryUniforms.curvature.value=c.fibers.secondaryCurvature;secondaryUniforms.brightness.value=c.fibers.secondaryBrightness+c.fibers.secondaryGlow;secondaryUniforms.colorVariation.value=c.fibers.secondaryColorVariation;secondaryUniforms.movement.value=c.fibers.secondaryMovement
  signalUniforms.uTime!.value=elapsed.current;signalUniforms.uZRelief!.value=c.memorySignal.zRelief;signalUniforms.uNoiseStrength!.value=c.memorySignal.noiseStrength;signalUniforms.uEdgeDiffusion!.value=c.memorySignal.edgeDiffusion;signalUniforms.uParticleSize!.value=c.particles.size;signalUniforms.uScatter!.value=c.memorySignal.scatter;signalUniforms.uOpacity!.value=c.display.particleOpacity*c.particles.opacity;signalUniforms.uColorIntensity!.value=c.memorySignal.colorIntensity;signalUniforms.uTwinkle!.value=c.particles.twinkle;signalUniforms.uDepthCaptured!.value=sourcePlane?.depthData?1:0;signalUniforms.uModelScale!.value=sourcePlane?.depthData?c.eye.scale:1.1
  syncMaterialUniformValues(irisMaterialRef.current,irisUniforms);syncMaterialUniformValues(rawParticleMaterialRef.current,uniforms);syncMaterialUniformValues(microMaterialRef.current,uniforms);syncMaterialUniformValues(highlightMaterialRef.current,uniforms);syncMaterialUniformValues(atmosphereMaterialRef.current,glowUniforms);syncMaterialUniformValues(primaryFiberMaterialRef.current,fiberUniforms);syncMaterialUniformValues(secondaryFiberMaterialRef.current,secondaryUniforms);syncMaterialUniformValues(memoryMaterialRef.current,signalUniforms)
 })
 useEffect(()=>{points.setDrawRange(0,Math.floor(assets.count*c.particles.density));highlights.setDrawRange(0,Math.floor(Math.ceil(assets.count/19)*c.particles.density));primary.setDrawRange(0,Math.floor(1800*c.fibers.density)*24);secondary.setDrawRange(0,Math.floor(1800*Math.min(c.fibers.density,c.fibers.secondaryDensity*c.fibers.branching))*24)},[points,highlights,primary,secondary,assets.count,c.particles.density,c.fibers.density,c.fibers.secondaryDensity,c.fibers.branching])
 useEffect(()=>{memoryGeometry.setDrawRange(0,Math.floor((memoryGeometry.getAttribute('position')?.count??0)*c.particles.density))},[memoryGeometry,c.particles.density])
 const texture=diagnostic==='authentic'?assets.authentic:diagnostic==='confidence'?assets.confidence:assets.cinematic
 const isDiag=diagnostic!=='eye'&&!albedoOnly; const raw=diagnostic==='particles'&&!albedoOnly
 if(isDiag && !raw) return <mesh><planeGeometry args={[2,2]}/><meshBasicMaterial map={texture} transparent /></mesh>
 if(raw) return <points geometry={points}><shaderMaterial ref={rawParticleMaterialRef} uniforms={uniforms} vertexShader={pointVertex} fragmentShader={pointFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>
 return <>
  <group scale={c.eye.scale}>
  <group ref={modelRootRef} visible={c.display.showModel||c.display.mode==='Fire Eye Fibers'}>
   <group ref={modelBodyRootRef} visible={c.display.showModel}>
   {!albedoOnly && <><ambientLight intensity={c.lighting.ambient}/><directionalLight intensity={c.lighting.key} color={c.lighting.keyColor} position={[c.lighting.keyX,c.lighting.keyY,4]}/><directionalLight intensity={c.lighting.fill} color="#b7c8df" position={[3,-1,3]}/><directionalLight intensity={c.lighting.rim} color="#8eb9f2" position={[1,2,-3]}/></>}
   {!albedoOnly && c.layers.eyeball && <mesh><sphereGeometry args={[1,96,64]}/><meshPhysicalMaterial color={c.material.scleraTint} roughness={c.material.roughness} clearcoat={c.material.reflection} clearcoatRoughness={.25} opacity={c.display.modelOpacity} transparent={c.display.modelOpacity<1}/></mesh>}
   {!albedoOnly && c.layers.cornea && <mesh geometry={cornea} renderOrder={3}><shaderMaterial vertexShader={corneaVertex} fragmentShader={corneaFragment} uniforms={{opacity:{value:c.material.corneaOpacity*c.display.modelOpacity},reflection:{value:c.material.reflection},roughness:{value:c.material.corneaRoughness}}} transparent depthWrite={false}/></mesh>}
   {!albedoOnly && c.layers.eyelids && <group><mesh geometry={upperLid} renderOrder={4}><meshStandardMaterial vertexColors transparent opacity={c.display.modelOpacity} depthWrite={false} side={THREE.DoubleSide} roughness={.92}/></mesh><mesh geometry={lowerLid} renderOrder={4}><meshStandardMaterial vertexColors transparent opacity={c.display.modelOpacity} depthWrite={false} side={THREE.DoubleSide} roughness={.92}/></mesh></group>}
   {!albedoOnly && c.layers.eyelashes && <mesh geometry={lashes} renderOrder={5}><meshBasicMaterial vertexColors side={THREE.DoubleSide} opacity={c.display.modelOpacity} transparent={c.display.modelOpacity<1}/></mesh>}
   </group>
   {(albedoOnly||c.layers.iris) && <mesh geometry={iris}><shaderMaterial ref={irisMaterialRef} vertexShader={irisVertex} fragmentShader={irisFragment} uniforms={irisUniforms} transparent /></mesh>}
   {c.layers.pupil && <mesh position={[0,0,Math.max(1.001+c.eye.irisDepth,1.01)]}><circleGeometry args={[c.eye.pupilRadius*1.22,96]}/><meshBasicMaterial color="#030507" opacity={c.display.modelOpacity} transparent={c.display.modelOpacity<1}/></mesh>}
   {c.layers.pupil && <mesh position={[0,0,Math.max(1.025+c.eye.irisDepth,1.015)]}><circleGeometry args={[c.eye.pupilRadius,96]}/><meshBasicMaterial color="#030507" opacity={c.display.modelOpacity} transparent={c.display.modelOpacity<1}/></mesh>}
  </group>
  {!albedoOnly && <group ref={overlayRootRef}>
   <group position={[0,0,1.027+c.eye.irisDepth]} scale={[c.eye.irisRadius,c.eye.irisRadius,1]}>
    {c.layers.microParticles && <points geometry={points}><shaderMaterial ref={microMaterialRef} uniforms={uniforms} vertexShader={pointVertex} fragmentShader={pointFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>}
    {c.layers.atmosphericGlow && <points geometry={highlights}><shaderMaterial ref={atmosphereMaterialRef} uniforms={glowUniforms} vertexShader={pointVertex} fragmentShader={pointFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>}
    {c.layers.highlightParticles && <points geometry={highlights}><shaderMaterial ref={highlightMaterialRef} uniforms={uniforms} vertexShader={pointVertex} fragmentShader={pointFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>}
    {c.layers.primaryFibers && <mesh geometry={primary}><shaderMaterial ref={primaryFiberMaterialRef} uniforms={fiberUniforms} vertexShader={fiberVertex} fragmentShader={fiberFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
    {c.layers.secondaryFibers && <mesh geometry={secondary}><shaderMaterial ref={secondaryFiberMaterialRef} uniforms={secondaryUniforms} vertexShader={fiberVertex} fragmentShader={fiberFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
   </group>
   {/* Memory Signal points are rendered outside the model scale because the offscreen capture already includes it. */}
  </group>}
  </group>
  {!albedoOnly && c.layers.memorySignal && <points ref={memoryPointsRef} geometry={memoryGeometry} frustumCulled={false}><shaderMaterial ref={memoryMaterialRef} uniforms={signalUniforms} vertexShader={memoryVertex} fragmentShader={memoryFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>}
 </>
}

function Metrics({config,assets,onStats,diagnostic}: {config:LabConfig;assets:IrisAssets;onStats:Props['onStats'];diagnostic:Diagnostic}) { const {gl}=useThree();const elapsed=useRef(0), frames=useRef(0);useFrame((_,d)=>{elapsed.current+=d;frames.current++;if(elapsed.current>=1){onStats({fps:Math.round(frames.current/elapsed.current),drawCalls:gl.info.render.calls,particles:diagnostic==='particles'?Math.floor(assets.count*config.particles.density):diagnostic==='eye'?(config.layers.microParticles?Math.floor(assets.count*config.particles.density):0)+((config.layers.highlightParticles?1:0)+(config.layers.atmosphericGlow?1:0))*Math.floor(Math.ceil(assets.count/19)*config.particles.density):0,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,dpr:gl.getPixelRatio(),status:'run_017 loaded'});elapsed.current=0;frames.current=0}});return null }

function ContextEvents({onChange}: {onChange: (lost: boolean) => void}) {
 const {gl}=useThree()
 useEffect(()=>{const canvas=gl.domElement;const lost=(e:Event)=>{e.preventDefault();onChange(true)};const restored=()=>onChange(false);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);return()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored)}},[gl,onChange])
 return null
}

export function EyeViewport({config,cameraView,onCameraChange,onCameraReader,onStats,onMemorySignalCount,imageSource=null,diagnostic='eye',previewGrading=true,albedoOnly=false,onBaselineStatus}:Props) {
 const [assets,setAssets]=useState<IrisAssets|null>(null);const [error,setError]=useState(''); const [contextLost,setContextLost]=useState(false); const [visible,setVisible]=useState(()=>!document.hidden)
 useEffect(()=>{const change=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[])
 useEffect(()=>{let active=true;let loaded:IrisAssets|null=null;loadIrisAssets().then(value=>{loaded=value;if(active)setAssets(value);else value.dispose()}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))});return()=>{active=false;loaded?.dispose()}},[])
 if(error)return <div role="alert">Could not load run_017: {error}</div>;if(!assets)return <div>Loading run_017...</div>
 const baseline=config.display.mode==='Memory Signal Baseline'
  const photoIris=isPhotoIrisMode(config.display.mode)
  const photoSource=resolveIrisPhotoSource(config.display.mode,imageSource,import.meta.env.DEV)??''
  const baselineSource=imageSource??(import.meta.env.DEV?'/__iris-assets/source-eye.png':null)
 const photoCamera=photoIris?{...config.camera,distance:Math.min(config.camera.distance,3.25),targetX:0,targetY:0}:config.camera
 return <><Canvas key={String(config.effects.antialias)} frameloop={visible?'always':'never'} dpr={baseline?Math.min(2,window.devicePixelRatio):Math.min(2,config.effects.dpr)} camera={baseline?{position:[0,0,500],fov:60,near:1,far:3000}:{position:[0,0,5.25],fov:config.camera.fov,near:.01,far:100}} gl={{antialias:baseline?false:config.effects.antialias,preserveDrawingBuffer:true}}>{!baseline&&!albedoOnly&&!photoIris&&<Environment strength={config.lighting.environment}/>}<ContextEvents onChange={setContextLost}/><color attach="background" args={[baseline?'#000000':photoIris?'#020612':albedoOnly?'#777a80':config.lighting.background]}/>{baseline?<MemorySignalBaseline imageSource={baselineSource} onCount={onMemorySignalCount??(()=>{})} onStatus={onBaselineStatus??(()=>{})}/>:<><CameraRig config={photoCamera} revision={cameraView} onChange={onCameraChange} onCameraReader={onCameraReader}/>{photoIris?<BlueParticleEyeView config={config} imageSource={photoSource} onPointCount={onMemorySignalCount??(()=>{})} onStatus={onBaselineStatus??(()=>{})}/>:<Eye config={config} assets={assets} diagnostic={diagnostic} previewGrading={previewGrading} albedoOnly={albedoOnly} imageSource={imageSource} onMemorySignalCount={onMemorySignalCount}/>}</>}<Metrics config={config} assets={assets} onStats={onStats} diagnostic={diagnostic}/><Post config={config} albedoOnly={albedoOnly} baseline={baseline}/></Canvas>{contextLost && <div role="alert">WebGL context lost. Waiting for restoration.</div>}</>
}
