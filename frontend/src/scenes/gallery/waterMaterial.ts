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
import { GALLERY } from './content'
import { GALLERY_WORLD } from './world'

export type GalleryWaterSettings = SceneComposerConfig['scenes']['gallery']
type WorldPoint = Readonly<{ x: number; y: number; z: number }>

export interface GalleryMoonReflectionTrack {
  readonly origin: readonly [number, number]
  readonly direction: readonly [number, number]
  readonly hotspot: number
  readonly length: number
}

const MOON_TRACK_START_FADE_DISTANCE = 3
const MOON_TRACK_END_FADE_DISTANCE = 6
const MOON_TRACK_CORE_WIDTH = 3.8
const MOON_TRACK_TAIL_MIN_LENGTH = 24
const MOON_TRACK_TAIL_LENGTH_FACTOR = 0.75
const MOON_TRACK_TAIL_GAIN = 0.62

function smoothstepValue(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Reference mask for the shader's longitudinal lunar band, independent of the localized glint position. */
export function calculateGalleryMoonTrackLongitudinal(trackAlong: number, trackLength: number, hotspot: number) {
  const safeLength = Math.max(trackLength, 1)
  const startFade = smoothstepValue(-MOON_TRACK_START_FADE_DISTANCE, 0, trackAlong)
  const endFade = 1 - smoothstepValue(safeLength, safeLength + MOON_TRACK_END_FADE_DISTANCE, Math.max(trackAlong, 0))
  const moonCore = Math.exp(-Math.pow((trackAlong - hotspot) / MOON_TRACK_CORE_WIDTH, 2))
  const moonTail = Math.exp(-Math.max(trackAlong, 0) / Math.max(MOON_TRACK_TAIL_MIN_LENGTH, safeLength * MOON_TRACK_TAIL_LENGTH_FACTOR)) * MOON_TRACK_TAIL_GAIN
  return Math.max(moonCore, moonTail) * startFade * endFade
}

/** Keeps the localized moon glint off when the shared reflection control is set to zero. */
export function calculateWaterMoonReflectionGain(reflectionStrength: number) {
  if (!Number.isFinite(reflectionStrength)) return 0
  return Math.max(0, Math.min(1.2, reflectionStrength / 0.5))
}

/** Keeps the moonlit band anchored to the moon and gallery entrance as the camera moves. */
export function calculateMoonReflectionTrack(
  moon: WorldPoint,
  target: WorldPoint,
  floorY: number,
): GalleryMoonReflectionTrack {
  const aimVertical = target.y - moon.y
  const floorProjectionT = Math.abs(aimVertical) < 0.0001
    ? 1
    : Math.max(0, Math.min(2, (floorY - moon.y) / aimVertical))
  const floorPointX = moon.x + (target.x - moon.x) * floorProjectionT
  const floorPointZ = moon.z + (target.z - moon.z) * floorProjectionT
  const originX = moon.x
  const originZ = moon.z
  let directionX = floorPointX - originX
  let directionZ = floorPointZ - originZ
  let aimLength = Math.hypot(directionX, directionZ)

  // The configured aim can be moved off the gallery path. Keep the band aimed
  // through the entrance in that case so it never turns away from the water.
  if (aimLength < 0.0001 || directionZ <= 0.0001) {
    directionX = -originX
    directionZ = GALLERY.startZ - originZ
    aimLength = Math.hypot(directionX, directionZ)
  }
  directionX /= aimLength
  directionZ /= aimLength

  const hotspot = Math.max(0, Math.min(
    (GALLERY.startZ - originZ) / directionZ,
    (floorPointX - originX) * directionX + (floorPointZ - originZ) * directionZ,
  ))
  const trackLength = Math.max(0.5, (GALLERY.startZ - originZ) / directionZ)
  return {
    origin: [originX, originZ],
    direction: [directionX, directionZ],
    hotspot,
    length: trackLength,
  }
}

const TAU = Math.PI * 2

function waterHeight(u: number, v: number) {
  return Math.sin(TAU * (2 * u + v)) * 0.28
    + Math.sin(TAU * (5 * v - 3 * u)) * 0.18
    + Math.sin(TAU * (9 * u + 7 * v)) * 0.04
    + Math.sin(TAU * (15 * u - 11 * v)) * 0.022
    + Math.sin(TAU * (19 * v + 13 * u)) * 0.014
}

export function createGalleryWaterNormalTexture(size = 128) {
  const data = new Uint8Array(size * size * 4)
  const step = 1 / size
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x * step
      const v = y * step
      const slopeX = (waterHeight(u - step, v) - waterHeight(u + step, v)) * size * 0.016
      const slopeZ = (waterHeight(u, v - step) - waterHeight(u, v + step)) * size * 0.016
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
  uniform vec2 uMoonTrackOrigin;
  uniform vec2 uMoonTrackDirection;
  uniform float uMoonTrackHotspot;
  uniform float uMoonTrackLength;
  uniform vec3 uCameraPosition;
  uniform float uTime;
  uniform float uReflectionStrength;
  uniform float uReflectionBlur;
  uniform float uReflectionFalloff;
  uniform float uBaseBrightness;
  uniform float uWaterDistortion;
  uniform float uDistortionScale;
  uniform float uRippleSpeed;
  uniform float uNormalStrength;
  uniform float uMoonHighlightStrength;
  uniform float uMoonReflectionGain;
  uniform float uMoonReflectionSpread;
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
    vec2 waveTime = vec2(uTime * uRippleSpeed * 0.095, -uTime * uRippleSpeed * 0.073);
    vec2 normalUvA = vWorldPosition.xz * vec2(0.23, 0.17) * uDistortionScale + waveTime;
    vec2 normalUvB = vWorldPosition.xz * vec2(-0.64, 0.51) * uDistortionScale - waveTime * 0.63;
    vec2 slopeA = texture2D(uNormalMap, normalUvA).rg * 2.0 - 1.0;
    vec2 slopeB = texture2D(uNormalMap, normalUvB).rg * 2.0 - 1.0;
    vec2 slope = (slopeA * 0.72 + slopeB * 0.28) * uNormalStrength;
    vec3 surfaceNormal = normalize(vec3(-slope.x, 1.0, -slope.y));

    vec2 reflectedUv = vReflectionCoord.xy / max(vReflectionCoord.w, 0.0001);
    reflectedUv += slope * uWaterDistortion;
    reflectedUv = clamp(reflectedUv, vec2(0.001), vec2(0.999));
    float blurRadius = mix(0.65, 4.5, clamp(uReflectionBlur, 0.0, 1.0)) + max(uReflectionBlur - 1.0, 0.0) * 3.5;
    vec2 blurOffset = uReflectionTexelSize * blurRadius;
    vec3 rawReflection = blurredReflection(reflectedUv, blurOffset);
    vec3 reflection = pow(clamp(rawReflection, vec3(0.0), vec3(1.0)), vec3(1.45));
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float facing = max(dot(viewDirection, surfaceNormal), 0.0);
    float fresnel = 0.025 + 0.38 * pow(1.0 - facing, 2.4);
    float distanceFade = 1.0 - smoothstep(44.0, 205.0, length(uCameraPosition - vWorldPosition));
    distanceFade = pow(max(distanceFade, 0.0), uReflectionFalloff);
    float breakup = 0.91 + 0.09 * (0.5 + 0.5 * sin(vWorldPosition.x * 0.19 + vWorldPosition.z * 0.07 + slope.x * 4.0));
    float reflectionMix = clamp(uReflectionStrength * fresnel * 1.25 * distanceFade * breakup, 0.0, 0.48);

    vec3 deepNavy = vec3(0.0014, 0.0035, 0.013);
    float baseRipple = (slope.x * slope.y) * 0.004;
    vec3 color = deepNavy * uBaseBrightness + vec3(0.004, 0.009, 0.02) * max(0.0, baseRipple);
    vec2 trackOffset = vWorldPosition.xz - uMoonTrackOrigin;
    float trackAlong = dot(trackOffset, uMoonTrackDirection);
    float trackAcross = length(trackOffset - uMoonTrackDirection * trackAlong);
    float trackLength = max(uMoonTrackLength, 1.0);
    float lunarWashDistance = length(vec2((trackAlong - uMoonTrackHotspot) * 0.58, trackAcross));
    float lunarWash = exp(-lunarWashDistance / 18.0);
    float reflectionLuminance = dot(rawReflection, vec3(0.2126, 0.7152, 0.0722));
    vec3 reflectionDetailSample = texture2D(uReflectionMap, reflectedUv).rgb;
    float reflectionDetail = length(reflectionDetailSample - rawReflection);
    float broadAmbient = (1.0 - smoothstep(0.45, 0.9, reflectionLuminance))
      * (1.0 - smoothstep(0.035, 0.16, reflectionDetail));
    reflection *= 1.0 - lunarWash * broadAmbient * 0.88;
    color = mix(color, reflection * vec3(0.78, 0.91, 1.04), reflectionMix);

    float startFade = smoothstep(-${MOON_TRACK_START_FADE_DISTANCE.toFixed(1)}, 0.0, trackAlong);
    float endFade = 1.0 - smoothstep(trackLength, trackLength + ${MOON_TRACK_END_FADE_DISTANCE.toFixed(1)}, max(trackAlong, 0.0));
    float moonCore = exp(-pow((trackAlong - uMoonTrackHotspot) / ${MOON_TRACK_CORE_WIDTH.toFixed(1)}, 2.0));
    float moonTail = exp(-max(trackAlong, 0.0) / max(${MOON_TRACK_TAIL_MIN_LENGTH.toFixed(1)}, trackLength * ${MOON_TRACK_TAIL_LENGTH_FACTOR.toFixed(2)})) * ${MOON_TRACK_TAIL_GAIN.toFixed(2)};
    float longitudinal = max(moonCore, moonTail) * startFade * endFade;
    float trackWidth = uMoonReflectionSpread * mix(0.55, 1.25, clamp(max(trackAlong, 0.0) / trackLength, 0.0, 1.0));
    float core = exp(-trackAcross / max(trackWidth, 0.01));
    float glow = exp(-trackAcross / max(trackWidth * 2.6, 0.01));
    float moonGrainA = sin(dot(vWorldPosition.xz, vec2(0.47, 0.31)) + uTime * uRippleSpeed * 0.18);
    float moonGrainB = cos(dot(vWorldPosition.xz, vec2(-0.29, 0.71)) - uTime * uRippleSpeed * 0.135);
    float moonShimmer = 0.92 + moonGrainA * 0.045 + moonGrainB * 0.025 + (slope.x - slope.y) * 0.015;
    float moonTrail = (core * 0.68 + glow * 0.15) * longitudinal * breakup * moonShimmer;
    vec3 moonTone = mix(vec3(0.18, 0.34, 0.61), vec3(0.78, 0.87, 1.0), clamp(core * 0.46 + moonCore * 0.54, 0.0, 1.0));
    color += moonTone * moonTrail
      * uMoonHighlightStrength * uMoonReflectionGain * uMoonLightIntensity * uMoonBrightness * uColdLightIntensity;

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
      uMoonTrackOrigin: { value: new Vector2() },
      uMoonTrackDirection: { value: new Vector2(0, 1) },
      uMoonTrackHotspot: { value: 0 },
      uMoonTrackLength: { value: 1 },
      uCameraPosition: { value: new Vector3() },
      uMoonPosition: { value: new Vector3() },
      uMoonTarget: { value: new Vector3() },
      uTime: { value: 0 },
      uReflectionStrength: { value: 0 },
      uReflectionBlur: { value: 0 },
      uReflectionFalloff: { value: 1 },
      uBaseBrightness: { value: 0.72 },
      uWaterDistortion: { value: 0 },
      uDistortionScale: { value: 1 },
      uRippleSpeed: { value: 0 },
      uNormalStrength: { value: 0 },
      uMoonHighlightStrength: { value: 0 },
      uMoonReflectionGain: { value: 0 },
      uMoonReflectionSpread: { value: 1 },
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
  entryRevealAlpha = 1,
) {
  material.uniforms.uReflectionStrength!.value = settings.reflectionStrength
  material.uniforms.uReflectionBlur!.value = settings.reflectionBlur
  material.uniforms.uReflectionFalloff!.value = settings.reflectionFalloff
  material.uniforms.uBaseBrightness!.value = settings.waterBaseBrightness
  material.uniforms.uWaterDistortion!.value = settings.waterDistortion
  material.uniforms.uDistortionScale!.value = settings.waterDistortionScale
  material.uniforms.uRippleSpeed!.value = settings.waterRippleSpeed
  material.uniforms.uNormalStrength!.value = settings.waterNormalStrength
  material.uniforms.uMoonHighlightStrength!.value = settings.moonHighlightStrength
  material.uniforms.uMoonReflectionGain!.value = calculateWaterMoonReflectionGain(settings.reflectionStrength)
  material.uniforms.uMoonReflectionSpread!.value = settings.moonReflectionSpread
  material.uniforms.uMoonLightIntensity!.value = settings.moonLightIntensity
  material.uniforms.uMoonBrightness!.value = settings.moonBrightness
  material.uniforms.uColdLightIntensity!.value = settings.coldLightIntensity
  const safeEntryRevealAlpha = Number.isFinite(entryRevealAlpha)
    ? Math.max(0, Math.min(1, entryRevealAlpha))
    : 0
  material.uniforms.uWaterOpacity!.value = settings.waterOpacity * safeEntryRevealAlpha
  ;(material.uniforms.uMoonPosition!.value as Vector3).set(settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ)
  ;(material.uniforms.uMoonTarget!.value as Vector3).set(settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ)
  material.uniforms.uTime!.value = reducedMotion || !Number.isFinite(galleryTime) ? 0 : galleryTime
}

export function updateGalleryWaterCamera(material: ShaderMaterial, camera: Camera) {
  camera.getWorldPosition(material.uniforms.uCameraPosition!.value as Vector3)
  const moon = material.uniforms.uMoonPosition!.value as Vector3
  const target = material.uniforms.uMoonTarget!.value as Vector3
  const track = calculateMoonReflectionTrack(moon, target, GALLERY_WORLD.floor.y)
  ;(material.uniforms.uMoonTrackOrigin!.value as Vector2).set(track.origin[0], track.origin[1])
  ;(material.uniforms.uMoonTrackDirection!.value as Vector2).set(track.direction[0], track.direction[1])
  material.uniforms.uMoonTrackHotspot!.value = track.hotspot
  material.uniforms.uMoonTrackLength!.value = track.length
}
