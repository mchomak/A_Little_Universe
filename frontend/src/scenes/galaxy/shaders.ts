import type { IUniform } from 'three'
import { AdditiveBlending, Color, ShaderMaterial } from 'three'

export type GalaxyUniforms = Record<string, IUniform>

export function createStarMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uSpin: { value: 0.006 }, uSize: { value: 1.2 },
    uBrightness: { value: 0.7 }, uTwinkle: { value: 0.2 }, uTwinkleSpeed: { value: 0.7 },
    uCoreColor: { value: new Color('#FFE9C8') }, uInnerColor: { value: new Color('#AFC9F8') },
    uArmColor: { value: new Color('#C6A9EE') }, uReveal: { value: 0 }, uRadius: { value: 8.2 },
    uCoreSize: { value: 1.35 }, uExposure: { value: 1 }, uDpr: { value: 1 }, uBackground: { value: 0 },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      attribute float aRadius;
      uniform float uTime;
      uniform float uSpin;
      uniform float uSize;
      uniform float uTwinkle;
      uniform float uTwinkleSpeed;
      uniform float uReveal;
      uniform float uRadius;
      uniform float uCoreSize;
      uniform float uDpr;
      uniform float uBackground;
      uniform vec3 uCoreColor;
      uniform vec3 uInnerColor;
      uniform vec3 uArmColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vRadius;
      void main() {
        float differential = mix(1.0, 0.52, aRadius);
        float angle = uTime * uSpin * differential;
        mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec3 p = position;
        p.xy = turn * p.xy;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float core = 1.0 - smoothstep(uCoreSize / uRadius * 0.45, uCoreSize / uRadius * 1.25, aRadius);
        vec3 armColor = mix(uInnerColor, uArmColor, smoothstep(0.18, 0.95, aRadius));
        vColor = mix(armColor, uCoreColor, core * 0.92);
        float pulse = 1.0 - uTwinkle * 0.42 + uTwinkle * 0.42 * sin(uTime * uTwinkleSpeed + aSeed * 31.416);
        float revealNoise = (fract(aSeed * 17.31) - 0.5) * 0.11;
        float radialReveal = smoothstep(0.0, 0.18, uReveal - aRadius - revealNoise);
        vAlpha = mix(radialReveal, uReveal, uBackground) * pulse;
        vAlpha *= mix(0.82, 1.1, aSeed);
        vSeed = aSeed;
        vRadius = aRadius;
        gl_PointSize = clamp(aSize * uSize * uDpr * (16.0 / max(1.2, -mvPosition.z)), 0.7, 9.0);
      }`,
    fragmentShader: `
      uniform float uBrightness;
      uniform float uExposure;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vRadius;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p) * 2.0;
        if (r > 1.0) discard;
        float core = exp(-r * r * 9.0);
        float halo = exp(-r * r * 3.2) * 0.28;
        float warm = smoothstep(0.94, 0.995, vSeed) * 0.22;
        vec3 tint = mix(vColor, vec3(1.0, 0.77, 0.55), warm);
        float alpha = (core + halo) * vAlpha * uBrightness;
        gl_FragColor = vec4(tint * alpha * uExposure, alpha);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function createGasMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uScale: { value: 1.35 }, uDensity: { value: 0.58 },
    uBrightness: { value: 0.48 }, uOpacity: { value: 0.62 }, uIntensity: { value: 0.7 },
    uSpeed: { value: 0.018 }, uSaturation: { value: 0.72 }, uReveal: { value: 0 },
    uColor: { value: new Color('#E3AFCF') }, uRadius: { value: 8.2 },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: 2,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uSpeed;
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vPosition = position;
        vec3 p = position;
        float angle = uTime * uSpeed;
        p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uScale;
      uniform float uDensity;
      uniform float uBrightness;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform float uSaturation;
      uniform float uReveal;
      uniform float uRadius;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vPosition;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amp = 0.56;
        for (int i=0; i<5; i++) { value += amp * noise(p); p = p*2.03 + vec2(7.1, 3.7); amp *= 0.49; }
        return value;
      }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float spiral = sin(angle * 4.0 - radius * 8.0 + uTime * uSpeed * 3.0);
        float cloud = fbm(p * uScale * 6.0 + vec2(uTime*uSpeed, -uTime*uSpeed*0.67));
        float clouds = smoothstep(0.26, 0.74, cloud + spiral*0.12);
        float disk = (1.0 - smoothstep(0.08, 1.03, radius)) * smoothstep(0.02, 0.16, radius);
        float armDust = smoothstep(0.22, 0.9, clouds + max(spiral, 0.0)*0.25);
        float alpha = disk * armDust * uDensity * uOpacity * uIntensity * uBrightness * uReveal;
        vec3 gas = mix(uColor * 0.48, uColor * 1.42, clouds);
        gas = mix(vec3(dot(gas, vec3(0.299,0.587,0.114))), gas, uSaturation);
        gl_FragColor = vec4(gas, alpha);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function createFogMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uDensity: { value: 0.55 }, uOpacity: { value: 0.55 },
    uScale: { value: 1.5 }, uTurbulence: { value: 0.18 }, uColor: { value: new Color('#A5B8E8') },
    uLayer: { value: 0 }, uMotion: { value: 0.02 },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: 2,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float uTime; uniform float uDensity; uniform float uOpacity; uniform float uScale;
      uniform float uTurbulence; uniform float uLayer; uniform float uMotion; uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,289.3)))*951.1357);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.55;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,8.3);a*=.5;}return v;}
      void main(){
        vec2 p=(vUv-.5)*2.;
        vec2 drift=vec2(uTime*uMotion*(.8+uLayer*.07),-uTime*uMotion*.55);
        float n=fbm(p*uScale*3.+drift);
        float wisps=fbm(p*uScale*7.-drift*1.7);
        float uneven=n+wisps*uTurbulence*.35;
        float edge=length(p*vec2(.88,1.06));
        float cloud=smoothstep(.51-uDensity*.22,.88,uneven);
        float boundary=1.0-smoothstep(.23,1.12,edge+(.5-uneven)*.34);
        float alpha=cloud*boundary*uOpacity*uDensity;
        vec3 color=uColor*(.62+wisps*.62);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function createBackgroundGasMaterial() {
  const uniforms: GalaxyUniforms = {
    uTime: { value: 0 }, uDensity: { value: 0.12 }, uBrightness: { value: 0.3 },
    uScale: { value: 1.2 }, uSpeed: { value: 0.014 }, uColor: { value: new Color('#8492C8') },
  }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: 2,
    blending: AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float uTime; uniform float uDensity; uniform float uBrightness; uniform float uScale; uniform float uSpeed; uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(27.1,93.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.54;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.01+vec2(5.3,2.4);a*=.5;}return v;}
      void main(){vec2 p=(vUv-.5)*2.;vec2 drift=vec2(uTime*uSpeed,-uTime*uSpeed*.64);float n=fbm(p*uScale*4.+drift);float detail=fbm(p*uScale*9.-drift*1.4);float clouds=smoothstep(.45,.79,n+detail*.17);float veil=1.0-smoothstep(.22,1.25,length(p*vec2(.93,1.0)));float a=clouds*veil*uDensity*uBrightness;vec3 c=uColor*(.55+detail*.7);gl_FragColor=vec4(c,a);
      #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function createCoreMaterial() {
  const uniforms: GalaxyUniforms = { uColor: { value: new Color('#FFE9C8') }, uGlow: { value: 1.18 }, uReveal: { value: 0 }, uTime: { value: 0 } }
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform vec3 uColor; uniform float uGlow; uniform float uReveal; uniform float uTime; varying vec2 vUv; void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float halo=exp(-r*r*5.2);float heart=exp(-r*r*24.);float breath=1.0+.025*sin(uTime*.7);float a=(halo*.18+heart*.5)*uGlow*uReveal*breath;vec3 c=mix(uColor,vec3(1.0),heart*.35);gl_FragColor=vec4(c*a,a);
      #include <colorspace_fragment>
      }`,
  })
  return { material, uniforms }
}

export function applyGalaxyFrameMaterials(materials: {
  disk: ReturnType<typeof createStarMaterial>
  bright: ReturnType<typeof createStarMaterial>
  background: ReturnType<typeof createStarMaterial>
  backgroundGas: ReturnType<typeof createBackgroundGasMaterial>
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
  backgroundBrightness: number
  gasBrightness: number
  gasReveal: number
  backgroundGasBrightness: number
  coreReveal: number
  light: number
  fogOpacity: number
}) {
  materials.disk.uniforms.uTime!.value = frame.motionTime
  materials.disk.uniforms.uReveal!.value = frame.reveal
  materials.disk.uniforms.uBrightness!.value = frame.diskBrightness
  materials.bright.uniforms.uTime!.value = frame.motionTime
  materials.bright.uniforms.uReveal!.value = frame.reveal
  materials.bright.uniforms.uBrightness!.value = frame.brightBrightness
  materials.background.uniforms.uTime!.value = frame.motionTime
  materials.background.uniforms.uReveal!.value = frame.firstStars
  materials.background.uniforms.uBrightness!.value = frame.backgroundBrightness
  materials.gas.uniforms.uTime!.value = frame.phaseTime
  materials.gas.uniforms.uBrightness!.value = frame.gasBrightness
  materials.gas.uniforms.uReveal!.value = frame.gasReveal
  materials.backgroundGas.uniforms.uTime!.value = frame.phaseTime
  materials.backgroundGas.uniforms.uBrightness!.value = frame.backgroundGasBrightness
  materials.core.uniforms.uReveal!.value = frame.coreReveal
  materials.core.uniforms.uTime!.value = frame.motionTime
  materials.core.material.opacity = frame.light
  for (const fog of materials.fog) {
    fog.uniforms.uTime!.value = frame.phaseTime
    fog.uniforms.uOpacity!.value = frame.fogOpacity
  }
}
