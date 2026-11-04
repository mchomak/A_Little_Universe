/*
 * Memory Signal Baseline adapts the pixel sampler and GLSL particle shaders
 * from shuhari04/memory-signal-threejs (Copyright (c) 2025 shuhari04).
 * The MIT notice is preserved in frontend/public/THIRD-PARTY-NOTICES.md.
 */

export type MemorySignalBaselineSample = {
  positions: Float32Array
  colors: Float32Array
  brightness: Float32Array
  random: Float32Array
  edgeFactor: Float32Array
  count: number
  width: number
  height: number
  fitDistance: number
}

export const memorySignalBaselineDefaults = {
  bloomStrength: 0.82,
  bloomRadius: 0.082,
  bloomThreshold: 0.103,
  particleSize: 0.8448,
  zRelief: 52.6,
  noiseStrength: 1.805,
} as const

/** The reference app downsizes only when the largest image edge exceeds 300 px. */
export function memorySignalBaselineDimensions(sourceWidth: number, sourceHeight: number) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) throw new Error('Invalid image dimensions')
  let width = sourceWidth
  let height = sourceHeight
  const maxSize = 300
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height)
    width = Math.floor(width * ratio)
    height = Math.floor(height * ratio)
  }
  return { width, height }
}

/**
 * Exact Memory Signal pixel acceptance, geometry mapping and neighborhood edge
 * math. Pixel data must already have been drawn at memorySignalBaselineDimensions.
 */
export function processMemorySignalBaselinePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  random: () => number = Math.random,
): MemorySignalBaselineSample {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid RGBA pixel plane')

  const positions: number[] = []
  const colors: number[] = []
  const brightnessArray: number[] = []
  const randoms: number[] = []
  const edgeFactors: number[] = []
  const tempAlpha = new Float32Array(width * height)
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY

  // Pass 1: Gather raw alpha, including transparent pixels in the source image.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]!
      tempAlpha[y * width + x] = a / 255.0
    }
  }

  // Pass 2: Build the same point cloud as the original main.js.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const a = data[i + 3]!
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

      if (a > 20 && brightness > 0.05) {
        const posX = (x - width / 2) * 1.5
        const posY = -(y - height / 2) * 1.5
        positions.push(posX, posY, 0)
        minX = Math.min(minX, posX); maxX = Math.max(maxX, posX)
        minY = Math.min(minY, posY); maxY = Math.max(maxY, posY)
        colors.push(r / 255.0, g / 255.0, b / 255.0)
        brightnessArray.push(brightness)
        randoms.push(random())

        let alphaSum = 0
        let count = 0
        const radius = 3
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) alphaSum += tempAlpha[ny * width + nx]!
            count++
          }
        }
        const avgAlpha = alphaSum / count
        let edge = 1.0 - avgAlpha
        edge = Math.pow(edge, 1.5)
        if (brightness < 0.2) edge += 0.2
        edgeFactors.push(Math.min(1.0, Math.max(0.0, edge)))
      }
    }
  }

  const count = brightnessArray.length
  const pointBoundsSpan = count > 0 ? Math.max(maxX - minX, maxY - minY) : 0
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    brightness: new Float32Array(brightnessArray),
    random: new Float32Array(randoms),
    edgeFactor: new Float32Array(edgeFactors),
    count,
    width,
    height,
    fitDistance: pointBoundsSpan * 1.2,
  }
}

/** Original Memory Signal vertex shader, including simplex/curl noise and its edge tear. */
export const memorySignalBaselineVertexShader = `
uniform float uTime;
uniform float uParticleSize;
uniform float uZRelief;
uniform float uNoiseStrength;

attribute float brightness;
attribute float random;
attribute float edgeFactor;
attribute vec3 customColor;

varying vec3 vColor;
varying float vAlpha;
varying float vEdge;

// Simplex 3D Noise
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 curlNoise( vec3 p ){
  const float e = 0.1;
  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );

  vec3 p_x0 = vec3( snoise(p - dx), snoise(p - dx + vec3(100.)), snoise(p - dx + vec3(200.)) );
  vec3 p_x1 = vec3( snoise(p + dx), snoise(p + dx + vec3(100.)), snoise(p + dx + vec3(200.)) );
  vec3 p_y0 = vec3( snoise(p - dy), snoise(p - dy + vec3(100.)), snoise(p - dy + vec3(200.)) );
  vec3 p_y1 = vec3( snoise(p + dy), snoise(p + dy + vec3(100.)), snoise(p + dy + vec3(200.)) );
  vec3 p_z0 = vec3( snoise(p - dz), snoise(p - dz + vec3(100.)), snoise(p - dz + vec3(200.)) );
  vec3 p_z1 = vec3( snoise(p + dz), snoise(p + dz + vec3(100.)), snoise(p + dz + vec3(200.)) );

  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

  return normalize( vec3( x , y , z ) );
}

void main() {
    vColor = customColor;
    vEdge = edgeFactor;
    vec3 pos = position;
    float zReliefValue = brightness * uZRelief;
    float wave = sin(uTime * 1.5 + pos.x * 0.01 + pos.y * 0.01 + random * 6.28) * 5.0 * (1.0 + brightness);
    vec3 cnoise = curlNoise(pos * 0.005 + vec3(0.0, uTime * 0.1, uTime * 0.05));
    float noisePower = mix(2.0, 100.0, smoothstep(0.0, 1.0, edgeFactor));
    noisePower += random * 30.0 * edgeFactor;
    vec3 flowOffset = cnoise * noisePower * uNoiseStrength;
    pos.z += zReliefValue + wave;
    pos += flowOffset;
    if (edgeFactor > 0.3) {
      float tearForce = (snoise(vec3(pos.xy * 0.01, uTime * 0.5)) * 0.5 + 0.5) * edgeFactor;
      pos += cnoise * tearForce * 150.0;
      vColor = mix(vColor, vec3(0.5, 0.8, 1.0), edgeFactor * 0.8);
    }
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float pSize = mix(1.0, 4.0, brightness) + random * 2.0;
    pSize *= mix(1.0, 2.0, edgeFactor);
    pSize *= uParticleSize;
    gl_PointSize = pSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = mix(0.9, 0.1, edgeFactor);
    vAlpha *= smoothstep(500.0, -100.0, mvPosition.z);
}
`

/** Original Memory Signal fragment shader; points use additive blending. */
export const memorySignalBaselineFragmentShader = `
varying vec3 vColor;
varying float vAlpha;
varying float vEdge;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
    vec3 finalColor = vColor;
    finalColor += vec3(0.1, 0.3, 0.5) * vEdge;
    gl_FragColor = vec4(finalColor, alpha);
}
`
