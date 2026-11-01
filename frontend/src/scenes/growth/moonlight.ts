import { Matrix4, Quaternion, Vector3 } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

export type GrowthMoonlightSettings = Pick<SceneComposerConfig['scenes']['growth'],
  | 'moonLightIntensity'
  | 'moonLightColor'
  | 'moonBeamRadius'
  | 'moonBeamSoftness'
  | 'moonBeamIntensity'
  | 'moonPositionX'
  | 'moonPositionY'
  | 'moonPositionZ'
>

const MOONLIGHT_BASE = 0.68
const MOONLIGHT_GROWTH_BOOST = 0.32

export interface GrowthMoonlightLevels {
  key: number
  fill: number
  beam: number
  shadow: number
}

/** A restrained lunar base is present before impact, then deepens with the existing scene pose. */
export function getGrowthMoonlightLevels(
  lightIntensity: number,
  beamIntensity: number,
  growthProgress: number,
  environmentOpacity: number,
): GrowthMoonlightLevels {
  const progress = Math.min(1, Math.max(0, Number.isFinite(growthProgress) ? growthProgress : 0))
  const opacity = Math.min(1, Math.max(0, Number.isFinite(environmentOpacity) ? environmentOpacity : 0))
  const growth = MOONLIGHT_BASE + MOONLIGHT_GROWTH_BOOST * progress
  const intensity = Math.max(0, Number.isFinite(lightIntensity) ? lightIntensity : 0)
  const beam = Math.max(0, Number.isFinite(beamIntensity) ? beamIntensity : 0)
  return {
    key: intensity * growth * opacity,
    fill: intensity * growth * 0.4 * opacity,
    beam: beam * (0.68 + 0.32 * progress) * opacity,
    shadow: progress * opacity,
  }
}

export interface GrowthMoonlightBeamLayout {
  start: [number, number, number]
  end: [number, number, number]
  position: [number, number, number]
  source: [number, number, number]
  planeNormal: [number, number, number]
  depthOffset: number
  quaternion: Quaternion
  width: number
  height: number
}

/** Build a camera-facing beam plane along the configured light source to island axis. */
export function getGrowthMoonlightBeamLayout(settings: Pick<GrowthMoonlightSettings,
  'moonPositionX' | 'moonPositionY' | 'moonPositionZ' | 'moonBeamRadius'>,
): GrowthMoonlightBeamLayout {
  const source: [number, number, number] = [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ]
  const axis = new Vector3(...source).normalize()
  const towardCamera = new Vector3(0, 0, 1)
  const normal = towardCamera.addScaledVector(axis, -towardCamera.dot(axis))
  if (normal.lengthSq() < 1e-5) normal.set(1, 0, 0).addScaledVector(axis, -axis.x)
  normal.normalize()
  const right = axis.clone().cross(normal).normalize()
  normal.crossVectors(right, axis).normalize()
  const rotation = new Matrix4().makeBasis(right, axis, normal)
  const quaternion = new Quaternion().setFromRotationMatrix(rotation)
  const length = Math.max(0.05, Math.hypot(...source))
  const depthOffset = 0.28
  const midpoint = new Vector3(source[0] * 0.5, source[1] * 0.5, source[2] * 0.5)
    .addScaledVector(normal, -depthOffset)
  return {
    start: [0, 0, 0],
    end: [...source],
    source,
    position: [midpoint.x, midpoint.y, midpoint.z],
    planeNormal: [normal.x, normal.y, normal.z],
    depthOffset,
    quaternion,
    width: Math.max(0.1, settings.moonBeamRadius * 4),
    height: length,
  }
}

export const growthMoonBeamFragmentShader = `
  uniform vec3 uMoonColor;
  uniform float uOpacity;
  uniform float uBeamRadius;
  uniform float uSoftness;
  varying vec2 vUv;
  void main() {
    float softness = clamp(uSoftness, 0.0, 1.0);
    float halfWidth = max(0.025, uBeamRadius * mix(1.08, 0.42, vUv.y));
    float across = abs((vUv.x - 0.5) * (uBeamRadius * 4.0)) / halfWidth;
    float scatter = exp(-across * across * mix(2.7, 1.05, softness));
    float feather = 1.0 - smoothstep(1.1, 1.65 + softness * 0.5, across);
    float ends = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y));
    float wisps = 0.97 + 0.03 * sin(vUv.y * 18.0 + sin(vUv.x * 13.0));
    float energy = max(0.0, uOpacity);
    float compressedIntensity = 0.22 * energy / (1.0 + energy);
    float alpha = scatter * feather * ends * wisps * compressedIntensity;
    gl_FragColor = vec4(uMoonColor, alpha);
  }
`

export const growthContactShadowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const growthContactShadowFragmentShader = `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radiusSquared = dot(p, p);
    float broad = exp(-radiusSquared * 3.4) * 0.045;
    float contact = exp(-radiusSquared * 17.0) * 0.085;
    float edgeFade = 1.0 - smoothstep(0.36, 1.0, radiusSquared);
    float alpha = (broad + contact) * edgeFade * uOpacity;
    gl_FragColor = vec4(0.018, 0.028, 0.043, alpha);
  }
`
