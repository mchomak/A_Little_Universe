import {
  Camera,
  DataTexture,
  LinearFilter,
  Matrix4,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

export type GalleryWaterSettings = SceneComposerConfig['scenes']['gallery']

const TAU = Math.PI * 2

function waterHeight(u: number, v: number) {
  return Math.sin(TAU * (2 * u + v)) * 0.28
    + Math.sin(TAU * (5 * v - 3 * u)) * 0.15
    + Math.sin(TAU * (9 * u + 7 * v)) * 0.04
}

export function createGalleryWaterNormalTexture(size = 128) {
  const data = new Uint8Array(size * size * 4)
  const step = 1 / size
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x * step
      const v = y * step
      const slopeX = (waterHeight(u - step, v) - waterHeight(u + step, v)) * size * 0.0125
      const slopeZ = (waterHeight(u, v - step) - waterHeight(u, v + step)) * size * 0.0125
      const offset = (y * size + x) * 4
      data[offset] = Math.round(128 + Math.max(-0.62, Math.min(0.62, slopeX)) * 145)
      data[offset + 1] = Math.round(128 + Math.max(-0.62, Math.min(0.62, slopeZ)) * 145)
      data[offset + 2] = 255
      data[offset + 3] = 255
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.colorSpace = NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const waterVertexShader = `
  uniform mat4 uTextureMatrix;
  varying vec3 vWorldPosition;
  varying vec4 vReflectionCoord;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vReflectionCoord = uTextureMatrix * worldPosition;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const waterFragmentShader = `
  uniform sampler2D uReflectionMap;
  uniform sampler2D uNormalMap;
  uniform vec2 uReflectionTexelSize;
  uniform vec2 uMoonStart;
  uniform vec2 uMoonEnd;
  uniform float uMoonDepthSpan;
  uniform vec3 uCameraPosition;
  uniform float uTime;
  uniform float uReflectionStrength;
  uniform float uReflectionBlur;
  uniform float uWaterDistortion;
  uniform float uRippleSpeed;
  uniform float uNormalStrength;
  uniform float uMoonHighlightStrength;
  uniform float uMoonLightIntensity;
  uniform float uMoonBrightness;
  uniform float uColdLightIntensity;
  uniform float uWaterOpacity;
  varying vec3 vWorldPosition;
  varying vec4 vReflectionCoord;

  vec3 blurredReflection(vec2 uv, vec2 offset) {
    vec3 color = texture2D(uReflectionMap, uv).rgb * 0.4;
    color += texture2D(uReflectionMap, uv + vec2(offset.x, 0.0)).rgb * 0.15;
    color += texture2D(uReflectionMap, uv - vec2(offset.x, 0.0)).rgb * 0.15;
    color += texture2D(uReflectionMap, uv + vec2(0.0, offset.y)).rgb * 0.15;
    color += texture2D(uReflectionMap, uv - vec2(0.0, offset.y)).rgb * 0.15;
    return color;
  }

  void main() {
    vec2 waveTime = vec2(uTime * uRippleSpeed * 0.018, -uTime * uRippleSpeed * 0.013);
    vec2 normalUvA = vWorldPosition.xz * vec2(0.13, 0.085) + waveTime;
    vec2 normalUvB = vWorldPosition.xz * vec2(-0.071, 0.16) - waveTime * 0.63;
    vec2 slopeA = texture2D(uNormalMap, normalUvA).rg * 2.0 - 1.0;
    vec2 slopeB = texture2D(uNormalMap, normalUvB).rg * 2.0 - 1.0;
    vec2 slope = (slopeA + slopeB * 0.32) * uNormalStrength;
    vec3 surfaceNormal = normalize(vec3(-slope.x, 1.0, -slope.y));

    vec2 reflectedUv = vReflectionCoord.xy / max(vReflectionCoord.w, 0.0001);
    reflectedUv += slope * uWaterDistortion;
    reflectedUv = clamp(reflectedUv, vec2(0.001), vec2(0.999));
    vec2 blurRadius = uReflectionTexelSize * mix(0.65, 4.5, clamp(uReflectionBlur, 0.0, 1.0));
    vec3 reflection = blurredReflection(reflectedUv, blurRadius);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float facing = max(dot(viewDirection, surfaceNormal), 0.0);
    float fresnel = 0.035 + 0.65 * pow(1.0 - facing, 3.0);
    float distanceFade = 1.0 - smoothstep(52.0, 255.0, length(uCameraPosition - vWorldPosition));
    float breakup = 0.91 + 0.09 * (0.5 + 0.5 * sin(vWorldPosition.x * 0.19 + vWorldPosition.z * 0.07 + slope.x * 4.0));
    float reflectionMix = clamp(uReflectionStrength * fresnel * 1.1 * distanceFade * breakup, 0.0, 0.64);

    vec3 deepNavy = vec3(0.0025, 0.0065, 0.022);
    float baseRipple = (slope.x * slope.y) * 0.012;
    vec3 color = deepNavy + vec3(0.008, 0.016, 0.035) * max(0.0, baseRipple);
    color = mix(color, reflection * vec3(0.82, 0.93, 1.04), reflectionMix);

    float span = abs(uMoonDepthSpan) < 0.0001 ? 1.0 : uMoonDepthSpan;
    float trackProgress = clamp((vWorldPosition.z - uMoonStart.y) / span, 0.0, 1.0);
    float trackCenter = mix(uMoonStart.x, uMoonEnd.x, trackProgress);
    float pathFade = smoothstep(-300.0, -145.0, vWorldPosition.z) * (1.0 - smoothstep(5.0, 30.0, vWorldPosition.z));
    float trackWidth = mix(1.2, 3.8, clamp(uReflectionBlur, 0.0, 1.0));
    float core = exp(-abs(vWorldPosition.x - trackCenter) / trackWidth);
    float glow = exp(-abs(vWorldPosition.x - trackCenter) / (trackWidth * 3.6));
    float moonTrail = (core * 0.58 + glow * 0.13) * pathFade * breakup;
    color += vec3(0.21, 0.35, 0.60) * moonTrail
      * uMoonHighlightStrength * uMoonLightIntensity * uMoonBrightness * uColdLightIntensity;

    float xFade = 1.0 - smoothstep(56.0, 70.0, abs(vWorldPosition.x));
    float nearFade = 1.0 - smoothstep(24.0, 44.0, vWorldPosition.z);
    float farFade = smoothstep(-420.0, -325.0, vWorldPosition.z);
    float edgeFade = xFade * nearFade * farFade;
    gl_FragColor = vec4(color, edgeFade * uWaterOpacity);
    #include <colorspace_fragment>
  }
`

export function createGalleryWaterMaterial(
  reflectionTexture: Texture,
  normalTexture: Texture,
  textureMatrix: Matrix4,
) {
  const image = reflectionTexture.image as { width?: number; height?: number } | undefined
  const width = Math.max(1, image?.width ?? 1024)
  const height = Math.max(1, image?.height ?? 1024)
  return new ShaderMaterial({
    uniforms: {
      uReflectionMap: { value: reflectionTexture },
      uNormalMap: { value: normalTexture },
      uTextureMatrix: { value: textureMatrix },
      uReflectionTexelSize: { value: new Vector2(1 / width, 1 / height) },
      uMoonStart: { value: new Vector2() },
      uMoonEnd: { value: new Vector2() },
      uMoonDepthSpan: { value: 1 },
      uCameraPosition: { value: new Vector3() },
      uTime: { value: 0 },
      uReflectionStrength: { value: 0 },
      uReflectionBlur: { value: 0 },
      uWaterDistortion: { value: 0 },
      uRippleSpeed: { value: 0 },
      uNormalStrength: { value: 0 },
      uMoonHighlightStrength: { value: 0 },
      uMoonLightIntensity: { value: 0 },
      uMoonBrightness: { value: 0 },
      uColdLightIntensity: { value: 0 },
      uWaterOpacity: { value: 0 },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}

export function updateGalleryWaterMaterial(
  material: ShaderMaterial,
  settings: GalleryWaterSettings,
  galleryTime: number,
  reducedMotion: boolean,
) {
  material.uniforms.uReflectionStrength!.value = settings.reflectionStrength
  material.uniforms.uReflectionBlur!.value = settings.reflectionBlur
  material.uniforms.uWaterDistortion!.value = settings.waterDistortion
  material.uniforms.uRippleSpeed!.value = settings.waterRippleSpeed
  material.uniforms.uNormalStrength!.value = settings.waterNormalStrength
  material.uniforms.uMoonHighlightStrength!.value = settings.moonHighlightStrength
  material.uniforms.uMoonLightIntensity!.value = settings.moonLightIntensity
  material.uniforms.uMoonBrightness!.value = settings.moonBrightness
  material.uniforms.uColdLightIntensity!.value = settings.coldLightIntensity
  material.uniforms.uWaterOpacity!.value = settings.waterOpacity
  ;(material.uniforms.uMoonStart!.value as Vector2).set(settings.moonPositionX, settings.moonPositionZ)
  ;(material.uniforms.uMoonEnd!.value as Vector2).set(settings.moonTargetX, settings.moonTargetZ)
  material.uniforms.uMoonDepthSpan!.value = settings.moonTargetZ - settings.moonPositionZ
  material.uniforms.uTime!.value = reducedMotion || !Number.isFinite(galleryTime) ? 0 : galleryTime
}

export function updateGalleryWaterCamera(material: ShaderMaterial, camera: Camera) {
  camera.getWorldPosition(material.uniforms.uCameraPosition!.value as Vector3)
}
