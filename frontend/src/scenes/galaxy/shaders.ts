import type { IUniform } from 'three'
import { AdditiveBlending, Color, ShaderMaterial, Vector2 } from 'three'
import type { Texture } from 'three'

export type GalaxyUniforms = Record<string, IUniform>

const LOCAL_ACES = `
  vec3 localAces(vec3 color) {
    return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
  }
`

/** Original starShader adapted to the XY disk and the shared film clock. */
export function createStarMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uRotTime: { value: 0 }, uSize: { value: 1.03 },
    uPixelRatio: { value: 1 }, uRotationSpeed: { value: 0.045 }, uTwinkle: { value: 0.5 }, uTwinkleSpeed: { value: 0.72 },
    uExposure: { value: 1 }, uReveal: { value: 0 }, uProjectionScale: { value: 24.6 }, uMaxPointSize: { value: 48 },
    uPhotoMap: { value: null as Texture | null }, uPhotoMask: { value: 0 }, uPhotoAspect: { value: 1 },
    uViewportAspect: { value: 1 }, uPhotoZoom: { value: 1 }, uPhotoResolution: { value: new Vector2(1, 1) },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uRotTime;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform float uRotationSpeed;
      uniform float uTwinkle;
      uniform float uTwinkleSpeed;
      uniform float uExposure;
      uniform float uReveal;
      uniform float uProjectionScale;
      uniform float uMaxPointSize;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aSeed;
      attribute float aRegion;
      varying vec3 vColor;
      varying float vGlow;
      varying float vCore;
      void main() {
        vec3 p = position;
        float a = uRotationSpeed * uRotTime;
        float s = sin(a);
        float c = cos(a);
        p.xy = mat2(c, -s, s, c) * p.xy;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float twinkle = 1.0 - uTwinkle * 0.45 * (0.5 + 0.5 * sin(uTime * 1.6 * uTwinkleSpeed + aSeed * 6.2831853));
        vColor = aColor * uExposure;
        vGlow = twinkle * uReveal;
        vCore = aRegion;
        float size = aSize * uSize * uPixelRatio * (uProjectionScale / -mvPosition.z);
        gl_PointSize = clamp(size, 0.55 * uPixelRatio, min(30.0 * uPixelRatio, uMaxPointSize));
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vColor;
      varying float vGlow;
      varying float vCore;
      uniform sampler2D uPhotoMap;
      uniform float uPhotoMask;
      uniform float uPhotoAspect;
      uniform float uViewportAspect;
      uniform float uPhotoZoom;
      uniform vec2 uPhotoResolution;
      ${LOCAL_ACES}
      float photoStarMask() {
        if (uPhotoMask <= 0.001) return 1.0;
        float cropX = min(1.0, uViewportAspect / max(0.001, uPhotoAspect));
        float cropY = min(1.0, uPhotoAspect / max(0.001, uViewportAspect));
        vec2 screenUv = gl_FragCoord.xy / max(uPhotoResolution, vec2(1.0));
        vec2 photoUv = (screenUv - 0.5) * vec2(cropX, cropY) / max(1.0, uPhotoZoom) + 0.5;
        float luminance = dot(texture2D(uPhotoMap, photoUv).rgb, vec3(0.299, 0.587, 0.114));
        return mix(1.0, smoothstep(0.2, 0.62, luminance), uPhotoMask);
      }
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv) * 2.0;
        float halo = pow(1.0 - smoothstep(0.0, 1.0, d), 1.9);
        float core = 1.0 - smoothstep(0.0, 0.32, d);
        float intensity = (halo * 0.85 + core * 0.7) * vGlow * mix(1.0, 0.14, vCore) * photoStarMask();
        if (intensity < 0.003) discard;
        vec3 color = mix(vColor, vec3(1.0, 0.96, 0.88), vCore * 0.5);
        gl_FragColor = vec4(localAces(color * intensity), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

/** Original sunShader adapted to the XY disk and local display-safe ACES shoulder. */
export function createSunMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uRotTime: { value: 0 }, uSize: { value: 1.4 },
    uPixelRatio: { value: 1 }, uRotationSpeed: { value: 0.045 }, uTwinkleSpeed: { value: 0.72 },
    uExposure: { value: 1.1 }, uReveal: { value: 0 }, uBrightTint: { value: new Color('#7FB4FF') },
    uProjectionScale: { value: 26.24 }, uMaxPointSize: { value: 48 },
    uPhotoMap: { value: null as Texture | null }, uPhotoMask: { value: 0 }, uPhotoAspect: { value: 1 },
    uViewportAspect: { value: 1 }, uPhotoZoom: { value: 1 }, uPhotoResolution: { value: new Vector2(1, 1) },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uRotTime;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform float uRotationSpeed;
      uniform float uTwinkleSpeed;
      uniform float uExposure;
      uniform float uReveal;
      uniform vec3 uBrightTint;
      uniform float uProjectionScale;
      uniform float uMaxPointSize;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vPulse;
      varying vec3 vTint;
      void main() {
        vec3 p = position;
        float a = uRotationSpeed * uRotTime;
        float s = sin(a);
        float c = cos(a);
        p.xy = mat2(c, -s, s, c) * p.xy;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float pulse = 0.82 + 0.18 * sin(uTime * (0.5 + aSeed) * uTwinkleSpeed + aSeed * 6.2831853);
        vColor = aColor * uExposure;
        vPulse = pulse * uReveal;
        vTint = uBrightTint;
        float size = aSize * uSize * pulse * uPixelRatio * (uProjectionScale / -mvPosition.z);
        gl_PointSize = clamp(size, 2.0 * uPixelRatio, min(48.0 * uPixelRatio, uMaxPointSize));
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vColor;
      varying float vPulse;
      varying vec3 vTint;
      uniform sampler2D uPhotoMap;
      uniform float uPhotoMask;
      uniform float uPhotoAspect;
      uniform float uViewportAspect;
      uniform float uPhotoZoom;
      uniform vec2 uPhotoResolution;
      float photoStarMask() {
        if (uPhotoMask <= 0.001) return 1.0;
        float cropX = min(1.0, uViewportAspect / max(0.001, uPhotoAspect));
        float cropY = min(1.0, uPhotoAspect / max(0.001, uViewportAspect));
        vec2 screenUv = gl_FragCoord.xy / max(uPhotoResolution, vec2(1.0));
        vec2 photoUv = (screenUv - 0.5) * vec2(cropX, cropY) / max(1.0, uPhotoZoom) + 0.5;
        float luminance = dot(texture2D(uPhotoMap, photoUv).rgb, vec3(0.299, 0.587, 0.114));
        return mix(1.0, smoothstep(0.2, 0.62, luminance), uPhotoMask);
      }
      ${LOCAL_ACES}
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv) * 2.0;
        float halo = pow(1.0 - smoothstep(0.0, 1.0, d), 2.4);
        float core = 1.0 - smoothstep(0.0, 0.22, d);
        float intensity = (halo * 0.7 + core * 1.1) * vPulse * photoStarMask();
        if (intensity < 0.003) discard;
        vec3 color = mix(vColor, vTint, 0.12);
        color = mix(color, vec3(1.0), core * 0.35) * intensity;
        gl_FragColor = vec4(localAces(color), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

/** Original nebula arm/noise shader adapted to a true circular XY gas disk. */
export function createGasMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uMotionTime: { value: 0 }, uNoiseSpeed: { value: 0.018 },
    uRotationSpeed: { value: 0.045 }, uRadius: { value: 8.2 }, uIntensity: { value: 0.46 },
    uDensity: { value: 0.5 }, uOpacity: { value: 0.72 }, uScale: { value: 1.35 },
    uSaturation: { value: 1 }, uReveal: { value: 0 }, uArms: { value: 5 }, uSpin: { value: 4.6 },
    uCoreSize: { value: 0.24 }, uExposure: { value: 1 }, uColorCore: { value: new Color('#FFCF8A') },
    uColorMid: { value: new Color('#9A52FF') }, uColorEdge: { value: new Color('#3A1A7A') },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: 2,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uRadius;
      varying vec2 vPos;
      void main() {
        vPos = position.xy / uRadius;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision mediump float;
      uniform float uTime;
      uniform float uMotionTime;
      uniform float uNoiseSpeed;
      uniform float uRotationSpeed;
      uniform float uIntensity;
      uniform float uDensity;
      uniform float uOpacity;
      uniform float uScale;
      uniform float uSaturation;
      uniform float uReveal;
      uniform float uArms;
      uniform float uSpin;
      uniform float uCoreSize;
      uniform float uExposure;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;
      varying vec2 vPos;
      ${LOCAL_ACES}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float valueNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amplitude = 0.5;
        for (int octave = 0; octave < 3; octave++) {
          value += amplitude * valueNoise(p); p *= 2.03; amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        float radius = length(vPos);
        if (radius > 1.0) discard;
        float theta = atan(vPos.y, vPos.x + 1e-6);
        float noiseTime = uTime * uNoiseSpeed;
        float cosine = cos(noiseTime * 0.02); float sine = sin(noiseTime * 0.02);
        vec2 q = mat2(cosine, -sine, sine, cosine) * vPos;
        float noise = fbm(q * (2.6 * uScale) + vec2(noiseTime * 0.015, -noiseTime * 0.01));
        float rotation = uRotationSpeed * uMotionTime;
        float arm = 0.5 + 0.5 * cos(uArms * (theta - uSpin * radius + rotation));
        arm = pow(arm, 2.2);
        vec3 color = mix(uColorCore, uColorMid, smoothstep(0.0, 0.5, radius));
        color = mix(color, uColorEdge, smoothstep(0.5, 1.0, radius));
        float brightness = (1.0 - smoothstep(0.0, 1.0, radius));
        brightness *= (0.25 + 0.75 * noise);
        brightness *= (0.18 + 0.82 * arm);
        brightness += (1.0 - smoothstep(0.0, uCoreSize * 1.6, radius)) * 1.3;
        brightness *= uIntensity * uDensity * uOpacity * uReveal * uExposure;
        if (brightness < 0.002) discard;
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(vec3(luminance), color, uSaturation);
        gl_FragColor = vec4(localAces(color * brightness), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

/** Broad local glow restores the soft core lost when the source HDR compositor is absent. */
export function createCoreMaterial() {
  const uniforms: GalaxyUniforms = {
    uColor: { value: new Color('#FFE6AD') }, uGlow: { value: 1 },
    uReveal: { value: 0 }, uExposure: { value: 1 }, uTime: { value: 0 },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform vec3 uColor; uniform float uGlow; uniform float uReveal; uniform float uExposure; uniform float uTime;
      varying vec2 vUv;
      ${LOCAL_ACES}
      void main() {
        vec2 p=(vUv-.5)*2.; float r=length(p);
        float halo=exp(-r*r*4.2); float heart=exp(-r*r*18.); float bloom=exp(-r*r*2.0);
        float edgeFade=1.0-smoothstep(0.82,1.0,r);
        float breath=1.0+.025*sin(uTime*.7);
        float glow=(halo*.24+heart*.48+bloom*.14)*uGlow*uReveal*uExposure*breath*edgeFade;
        float goldBlend=smoothstep(0.08,0.85,r)*0.78;
        vec3 color=mix(vec3(1.0,0.97,0.9),uColor,goldBlend);
        gl_FragColor=vec4(localAces(color*glow*.2),1.0);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

/** Reveal-only foreground gas. The base galaxy nebula remains a separate persistent layer. */
export function createFogMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uDensity: { value: 0.14 }, uOpacity: { value: 0.55 },
    uScale: { value: 1.5 }, uTurbulence: { value: 0.18 }, uColor: { value: new Color('#A5B8E8') },
    uLayer: { value: 0 }, uMotion: { value: 0.02 },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: 2,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform float uTime; uniform float uDensity; uniform float uOpacity; uniform float uScale;
      uniform float uTurbulence; uniform float uLayer; uniform float uMotion; uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,289.3)))*951.1357);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.55;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,8.3);a*=.5;}return v;}
      void main(){
        vec2 p=(vUv-.5)*2.; vec2 drift=vec2(uTime*uMotion*(.8+uLayer*.07),-uTime*uMotion*.55);
        float n=fbm(p*uScale*3.+drift); float wisps=fbm(p*uScale*7.-drift*1.7);
        float uneven=n+wisps*uTurbulence*.35; float edge=length(p*vec2(.88,1.06));
        float cloud=smoothstep(.51-uDensity*.22,.88,uneven);
        float boundary=1.0-smoothstep(.4,.86,edge+(.5-uneven)*.34);
        float alpha=cloud*boundary*uOpacity*uDensity;
        vec3 color=uColor*(.62+wisps*.62);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function applyGalaxyFrameMaterials(materials: {
  disk: ReturnType<typeof createStarMaterial>
  bright: ReturnType<typeof createSunMaterial>
  gas: ReturnType<typeof createGasMaterial>
  core: ReturnType<typeof createCoreMaterial>
  fog: ReturnType<typeof createFogMaterial>[]
}, frame: {
  motionTime: number
  phaseTime: number
  reveal: number
  firstStars: number
  diskBrightness: number
  brightBrightness: number
  nebulaBrightness: number
  sceneLight: number
  gasReveal: number
  coreReveal: number
  coreBrightness: number
  coreGlow: number
  twinkleSpeed: number
  fogOpacity: number
}) {
  for (const stars of [materials.disk, materials.bright]) {
    stars.uniforms.uTime!.value = frame.motionTime
    stars.uniforms.uRotTime!.value = frame.motionTime
    stars.uniforms.uTwinkleSpeed!.value = frame.twinkleSpeed
  }
  materials.disk.uniforms.uExposure!.value = frame.diskBrightness
  materials.disk.uniforms.uReveal!.value = frame.reveal
  materials.bright.uniforms.uExposure!.value = frame.brightBrightness
  materials.bright.uniforms.uReveal!.value = frame.reveal

  materials.gas.uniforms.uTime!.value = frame.phaseTime
  materials.gas.uniforms.uMotionTime!.value = frame.motionTime
  materials.gas.uniforms.uReveal!.value = frame.gasReveal
  materials.gas.uniforms.uExposure!.value = frame.nebulaBrightness * frame.sceneLight
  materials.core.uniforms.uReveal!.value = frame.coreReveal
  materials.core.uniforms.uExposure!.value = frame.coreBrightness
  materials.core.uniforms.uGlow!.value = frame.coreGlow
  materials.core.uniforms.uTime!.value = frame.motionTime
  for (const fog of materials.fog) {
    fog.uniforms.uTime!.value = frame.phaseTime
    fog.uniforms.uOpacity!.value = frame.fogOpacity
  }
}
