import { Color, DoubleSide, NormalBlending, ShaderMaterial, Vector3 } from 'three'

export interface GalleryAtmosphereMaterialOptions {
  kind: 'cloud' | 'haze'
  seed: number
  opacity: number
  intensity: number
  moonPosition: readonly [number, number, number]
  moonLightIntensity: number
}

const atmosphereVertexShader = `
  uniform float uSeed;
  uniform float uContourStrength;
  varying vec3 vCloudPosition;
  varying vec3 vContourPosition;
  varying vec3 vBoundaryPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise3(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    float n000 = hash31(cell);
    float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));
    float x00 = mix(n000, n100, local.x);
    float x10 = mix(n010, n110, local.x);
    float x01 = mix(n001, n101, local.x);
    float x11 = mix(n011, n111, local.x);
    return mix(mix(x00, x10, local.y), mix(x01, x11, local.y), local.z);
  }

  void main() {
    float broadNoise = noise3(position * 2.4 + vec3(uSeed));
    float detailNoise = noise3(position * 6.8 + vec3(uSeed * 0.37));
    float baseDisplacement = (broadNoise - 0.5) * 0.16 + (detailNoise - 0.5) * 0.055;

    // The contour field is seeded per wisp to give each volume a soft, uneven edge.
    vec3 warp = vec3(
      noise3(position * 1.8 + vec3(uSeed * 0.11, uSeed * 0.07, uSeed * 0.03)),
      noise3(position * 1.8 + vec3(7.1, uSeed * 0.13, 2.7)),
      noise3(position * 1.8 + vec3(1.4, 4.8, uSeed * 0.09))
    ) - 0.5;
    vec3 warpedPosition = position + warp * 0.86;

    float broadLobe = noise3(position * 1.65 + vec3(uSeed * 0.031, uSeed * 0.017, uSeed * 0.023));
    vec3 asymmetryAxis = normalize(vec3(sin(uSeed * 0.71), cos(uSeed * 0.37), sin(uSeed * 0.19 + 1.7)));
    float oneSidedLobe = dot(position, asymmetryAxis) * 0.22;
    float contourDisplacement = ((broadLobe - 0.5) * 0.56 + oneSidedLobe) * uContourStrength;

    vec3 shadingPosition = position * (1.0 + baseDisplacement);
    vec3 boundaryPosition = position * (1.0 + baseDisplacement + contourDisplacement);
    vec4 worldPosition = modelMatrix * vec4(boundaryPosition, 1.0);
    vCloudPosition = shadingPosition;
    vContourPosition = warpedPosition;
    vBoundaryPosition = boundaryPosition;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const atmosphereFragmentShader = `
  uniform vec3 uMoonPosition;
  uniform vec3 uMoonColor;
  uniform vec3 uBaseColor;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uCloudIntensity;
  uniform float uContourStrength;
  uniform float uMoonLightIntensity;
  uniform float uIsHaze;
  varying vec3 vCloudPosition;
  varying vec3 vContourPosition;
  varying vec3 vBoundaryPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + uSeed * 17.0) * 43758.5453);
  }

  float noise3(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    float n000 = hash31(cell);
    float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));
    float x00 = mix(n000, n100, local.x);
    float x10 = mix(n010, n110, local.x);
    float x01 = mix(n001, n101, local.x);
    float x11 = mix(n011, n111, local.x);
    return mix(mix(x00, x10, local.y), mix(x01, x11, local.y), local.z);
  }

  float fbm(vec3 p) {
    float broad = noise3(p * 2.4) * 0.58;
    float detail = noise3(p * 5.1 + vec3(8.2, 3.7, 5.4)) * 0.29;
    float fine = noise3(p * 10.8 + vec3(2.7, 9.1, 1.3)) * 0.13;
    return broad + detail + fine;
  }

  void main() {
    float broadDensity = fbm(vCloudPosition + vec3(uSeed * 0.017));
    float contourShape = fbm(vContourPosition * 1.1 + vec3(uSeed * 0.013));
    float contourDetail = noise3(vContourPosition * 6.0 + vec3(uSeed * 0.19));
    float edgeOffset = ((contourShape - 0.5) * 0.36 + (contourDetail - 0.5) * 0.14) * uContourStrength;
    float edge = 1.0 - smoothstep(0.94 + edgeOffset, 1.075 + edgeOffset, length(vBoundaryPosition));
    float cloudBody = smoothstep(0.27, 0.67, broadDensity);
    float detail = noise3(vCloudPosition * 13.0 + vec3(uSeed * 0.31));
    float cloudDensity = edge * cloudBody * (0.66 + detail * 0.34);

    float isHaze = step(0.5, uIsHaze);
    float hazeBody = smoothstep(0.16, 0.62, broadDensity);
    float coverage = mix(cloudDensity, edge * hazeBody, isHaze);

    vec3 normal = normalize(vWorldNormal);
    vec3 toMoon = normalize(uMoonPosition - vWorldPosition);
    float moonFacing = max(dot(normal, toMoon), 0.0);
    vec3 toCamera = normalize(cameraPosition - vWorldPosition);
    float viewFacing = max(dot(normal, toCamera), 0.0);
    float softRim = pow(1.0 - viewFacing, 1.7) * (0.24 + moonFacing * 0.76);
    float lunarLift = clamp(moonFacing * uMoonLightIntensity * 0.38 + softRim * 0.16, 0.0, 0.82);
    vec3 color = mix(uBaseColor, uMoonColor, lunarLift);
    color *= (0.86 + broadDensity * 0.27) * uCloudIntensity;

    float densityScale = mix(0.74, 0.56, isHaze);
    float alpha = clamp(uOpacity * coverage * densityScale, 0.0, 0.55);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export function createGalleryAtmosphereMaterial(options: GalleryAtmosphereMaterialOptions) {
  return new ShaderMaterial({
    uniforms: {
      uMoonPosition: { value: new Vector3(...options.moonPosition) },
      uMoonColor: { value: new Color('#adc8e9') },
      uBaseColor: { value: new Color(options.kind === 'haze' ? '#192742' : '#101a2d') },
      uSeed: { value: options.seed },
      uOpacity: { value: Math.max(0, Math.min(1.5, options.opacity)) },
      uCloudIntensity: { value: Math.max(0, Math.min(2, options.intensity)) },
      uContourStrength: { value: options.kind === 'cloud' ? 1 : 0 },
      uMoonLightIntensity: { value: Math.max(0, options.moonLightIntensity) },
      uIsHaze: { value: options.kind === 'haze' ? 1 : 0 },
    },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: DoubleSide,
    toneMapped: false,
  })
}
