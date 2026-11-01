import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, Texture } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

export type GalleryArtSettings = Readonly<SceneComposerConfig['scenes']['gallery']>

export interface ReflectionSourceTransform {
  readonly position: Readonly<{ x: number; y: number; z: number }>
  readonly yaw: number
  readonly width: number
  readonly height: number
  readonly scale?: number
  readonly floorY: number
}

export interface PhotoReflectionLayout {
  readonly position: readonly [number, number, number]
  readonly yaw: number
  readonly scale: number
  readonly size: readonly [number, number]
  readonly footprintSize: readonly [number, number]
}

/** A horizontal plane's local +Z normal becomes world +Y after this rotation. */
export const PHOTO_REFLECTION_PLANE_ROTATION_X = -Math.PI / 2

const REFLECTION_DEPTH_RATIO = 0.85
const FRAME_FOOTPRINT_WIDTH_SCALE = 1.12
const FRAME_FOOTPRINT_DEPTH_SCALE = 1.25
const MAX_REFLECTION_ALPHA = 0.18
const REFLECTION_STRENGTH_GAIN = 0.4
const REFLECTION_EDGE_FADE_UV = 0.12

function edgeFadeShader() {
  const start = REFLECTION_EDGE_FADE_UV.toFixed(2)
  const end = (1 - REFLECTION_EDGE_FADE_UV).toFixed(2)
  return `
    float edgeFade(vec2 uv) {
      float horizontalFade = smoothstep(0.0, ${start}, uv.x) * (1.0 - smoothstep(${end}, 1.0, uv.x));
      float verticalFade = smoothstep(0.0, ${start}, uv.y) * (1.0 - smoothstep(${end}, 1.0, uv.y));
      return horizontalFade * verticalFade;
    }
  `
}

function smoothstep(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

function edgeFadeAxis(value: number) {
  const axis = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return smoothstep(0, REFLECTION_EDGE_FADE_UV, axis)
    * (1 - smoothstep(1 - REFLECTION_EDGE_FADE_UV, 1, axis))
}

/** Four-sided UV mask shared by the photo wash and the soft frame footprint. */
export function getReflectionUvEdgeMask(u: number, v: number) {
  return edgeFadeAxis(u) * edgeFadeAxis(v)
}

const reflectionVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const reflectionFragmentShader = `
  uniform sampler2D map;
  uniform float uStrength;
  uniform float uBlur;
  uniform float uOpacity;
  varying vec2 vUv;
  ${edgeFadeShader()}
  void main() {
    float blurRadius = mix(0.04, 0.12, clamp(uBlur, 0.0, 1.0));
    vec2 blur = vec2(blurRadius, blurRadius * 0.72);
    vec2 reflectedUv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 color = texture2D(map, reflectedUv) * 2.0;
    color += texture2D(map, reflectedUv + vec2(blur.x, 0.0));
    color += texture2D(map, reflectedUv - vec2(blur.x, 0.0));
    color += texture2D(map, reflectedUv + vec2(0.0, blur.y));
    color += texture2D(map, reflectedUv - vec2(0.0, blur.y));
    color += texture2D(map, reflectedUv + blur * 0.68);
    color += texture2D(map, reflectedUv - blur * 0.68);
    color /= 8.0;

    float depthFade = pow(clamp(vUv.y, 0.0, 1.0), 1.75);
    float alpha = color.a * uOpacity * min(${MAX_REFLECTION_ALPHA.toFixed(2)}, max(0.0, uStrength) * ${REFLECTION_STRENGTH_GAIN.toFixed(2)});
    alpha *= edgeFade(vUv) * depthFade;
    gl_FragColor = vec4(color.rgb, alpha);
    #include <colorspace_fragment>
  }
`

const frameFootprintFragmentShader = `
  uniform sampler2D map;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${edgeFadeShader()}
  void main() {
    vec4 halo = texture2D(map, vUv);
    float alpha = halo.a * uOpacity * edgeFade(vUv);
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number, fallback: number) {
  return Math.max(minimum, Math.min(maximum, finiteOr(value, fallback)))
}

/** Maps a live photo pose to a faint floor wash aligned with its inward-facing normal. */
export function createPhotoReflectionLayout(source: ReflectionSourceTransform): PhotoReflectionLayout {
  const x = finiteOr(source.position.x, 0)
  const z = finiteOr(source.position.z, 0)
  const yaw = finiteOr(source.yaw, 0)
  const scale = Math.max(0, finiteOr(source.scale ?? 1, 1))
  const width = Math.max(0, finiteOr(source.width, 0))
  const depth = Math.max(0, finiteOr(source.height, 0)) * REFLECTION_DEPTH_RATIO
  const forward = depth * scale / 2
  const floorY = finiteOr(source.floorY, -2.35)

  return {
    position: [
      x + Math.sin(yaw) * forward,
      floorY + 0.01,
      z + Math.cos(yaw) * forward,
    ],
    yaw,
    scale,
    size: [width, depth],
    footprintSize: [width * FRAME_FOOTPRINT_WIDTH_SCALE, depth * FRAME_FOOTPRINT_DEPTH_SCALE],
  }
}

/** Creates a restrained, depth-fading image wash for a horizontal reflection plane. */
export function createPhotoReflectionMaterial(map: Texture, settings: GalleryArtSettings) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      uStrength: { value: clamp(settings.reflectionStrength, 0, 0.6, 0.24) },
      uBlur: { value: clamp(settings.reflectionBlur, 0.3, 1, 0.8) },
      uOpacity: { value: 1 },
    },
    vertexShader: reflectionVertexShader,
    fragmentShader: reflectionFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}

/** Creates a warm footprint whose alpha also fades at every edge of the plane. */
export function createFrameFootprintMaterial(map: Texture, color = '#e3b38e') {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      uOpacity: { value: 0 },
      uColor: { value: new Color(color) },
    },
    vertexShader: reflectionVertexShader,
    fragmentShader: frameFootprintFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}

/** Keeps the footprint responsive to Inspector edits while playback is paused. */
export function updateFrameFootprintMaterial(material: ShaderMaterial, opacity: number) {
  material.uniforms.uOpacity!.value = clamp(opacity, 0, 1, 0)
}

/** Updates settings and visibility independently of the film clock. */
export function updatePhotoReflectionMaterial(
  material: ShaderMaterial,
  settings: GalleryArtSettings,
  visibility = 1,
) {
  material.uniforms.uStrength!.value = clamp(settings.reflectionStrength, 0, 0.6, 0.24)
  material.uniforms.uBlur!.value = clamp(settings.reflectionBlur, 0.3, 1, 0.8)
  material.uniforms.uOpacity!.value = clamp(visibility, 0, 1, 1)
}
