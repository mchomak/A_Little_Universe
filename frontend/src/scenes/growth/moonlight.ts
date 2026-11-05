import { Quaternion, Vector3 } from 'three'
import type { DirectionalLight, Object3D } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
export { createGrowthShadowMapLease, enableGrowthObjectShadows } from './sceneShadows'
export type { GrowthShadowMapLease, GrowthShadowMapState } from './sceneShadows'

export type GrowthMoonlightSettings = Pick<SceneComposerConfig['scenes']['growth'],
  | 'islandRadius'
  | 'moonLightIntensity'
  | 'moonLightColor'
  | 'moonBeamRadius'
  | 'moonBeamSoftness'
  | 'moonBeamIntensity'
  | 'moonPositionX'
  | 'moonPositionY'
  | 'moonPositionZ'
> & { moonScatteringIntensity?: number }

export interface GrowthMoonlightLevels {
  key: number
  fill: number
  beam: number
  scattering: number
  shadow: number
}

export interface GrowthMoonlightRigGains {
  key: number
  fill: number
}

/** Scene 02's tighter key and reduced ambient fill return to the shared Bloom rig by settle. */
export function getGrowthMoonlightRigGains(settleProgress: number, focused: boolean): GrowthMoonlightRigGains {
  if (!focused) return { key: 1, fill: 1 }
  const settle = Math.min(1, Math.max(0, Number.isFinite(settleProgress) ? settleProgress : 0))
  return {
    key: 2 - settle,
    fill: 0.65 + 0.35 * settle,
  }
}

/** The island's local fill stays dim during Scene 02, then restores its Bloom level at handoff. */
export function getGrowthIslandLocalLightIntensity(settleProgress: number): number {
  const settle = Math.min(1, Math.max(0, Number.isFinite(settleProgress) ? settleProgress : 0))
  return 0.12 + 0.5 * settle
}

/** Tightens the beam during Scene 02 and restores its shared-scene radius by settle. */
export function getGrowthMoonlightBeamRadius(radius: number, settleProgress: number, focused: boolean): number {
  const baseRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0
  if (!focused) return baseRadius
  const settle = Math.min(1, Math.max(0, Number.isFinite(settleProgress) ? settleProgress : 0))
  return baseRadius * (0.72 + 0.28 * settle)
}

/** All lunar contributions follow the history-free impact ramp supplied by the seed pose. */
export function getGrowthMoonlightLevels(
  lightIntensity: number,
  beamIntensity: number,
  growthProgress: number,
  environmentOpacity: number,
  scatteringIntensity = 0.35,
  keyFocusGain = 1,
  hemisphereFillGain = 1,
): GrowthMoonlightLevels {
  const progress = Math.min(1, Math.max(0, Number.isFinite(growthProgress) ? growthProgress : 0))
  const opacity = Math.min(1, Math.max(0, Number.isFinite(environmentOpacity) ? environmentOpacity : 0))
  const intensity = Math.max(0, Number.isFinite(lightIntensity) ? lightIntensity : 0)
  const beam = Math.max(0, Number.isFinite(beamIntensity) ? beamIntensity : 0)
  const scattering = Math.max(0, Number.isFinite(scatteringIntensity) ? scatteringIntensity : 0.35)
  const focusGain = Number.isFinite(keyFocusGain) ? Math.max(0, Math.min(3, keyFocusGain)) : 1
  const fillGain = Number.isFinite(hemisphereFillGain) ? Math.max(0, Math.min(2, hemisphereFillGain)) : 1
  return {
    key: intensity * progress * opacity * focusGain,
    fill: intensity * progress * 0.4 * opacity * fillGain,
    beam: beam * progress * opacity,
    scattering: scattering * progress * opacity,
    shadow: progress * opacity,
  }
}

export interface GrowthMoonlightBeamLayout {
  start: [number, number, number]
  end: [number, number, number]
  position: [number, number, number]
  source: [number, number, number]
  radius: number
  quaternion: Quaternion
  width: number
  height: number
}

/** Keep the physical key and its target in the same local world, even after a seek or config edit. */
export function syncGrowthDirectionalKeyPose(
  light: DirectionalLight,
  target: Object3D,
  layout: Pick<GrowthMoonlightBeamLayout, 'source'>,
): void {
  target.position.set(0, 0, 0)
  light.position.set(...layout.source)
  light.target = target
  target.updateMatrixWorld(true)
  light.updateMatrixWorld(true)
}

/** Keep the light over the island center and express its radius as a scale of the island. */
export function getGrowthMoonlightBeamLayout(settings: Pick<GrowthMoonlightSettings,
  'islandRadius' | 'moonBeamRadius' | 'moonPositionX' | 'moonPositionY' | 'moonPositionZ'>,
): GrowthMoonlightBeamLayout {
  const sourceHeight = Number.isFinite(settings.moonPositionY) ? Math.max(0.05, settings.moonPositionY) : 5.5
  const sourceX = Number.isFinite(settings.moonPositionX) ? settings.moonPositionX : 0
  const sourceZ = Number.isFinite(settings.moonPositionZ) ? settings.moonPositionZ : 0
  const islandRadius = Number.isFinite(settings.islandRadius) ? Math.max(0.05, settings.islandRadius) : 0.82
  const radiusScale = Number.isFinite(settings.moonBeamRadius) ? Math.min(2, Math.max(0.2, settings.moonBeamRadius / 2)) : 1
  const radius = islandRadius * radiusScale
  const source: [number, number, number] = [sourceX, sourceHeight, sourceZ]
  const direction = new Vector3(...source).normalize()
  const height = Math.hypot(...source)
  const quaternion = new Quaternion()
  quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction)
  return {
    start: [0, 0, 0],
    end: [...source],
    source,
    position: [sourceX * 0.5, sourceHeight * 0.5, sourceZ * 0.5],
    radius,
    quaternion,
    // Leave room beyond the shader's feather so the analytic volume cannot
    // reveal the rectangular edge of its single transparent plane.
    width: Math.max(0.1, radius * 12),
    height,
  }
}

export const growthMoonBeamFragmentShader = `
  uniform vec3 uMoonColor;
  uniform float uOpacity;
  uniform float uScatteringIntensity;
  uniform float uBeamRadius;
  uniform float uSoftness;
  varying vec2 vUv;
  void main() {
    float softness = clamp(uSoftness, 0.0, 1.0);
    float worldAcross = abs((vUv.x - 0.5) * (uBeamRadius * 12.0));
    float shaftHalfWidth = max(0.025, uBeamRadius * mix(1.0, 0.52, vUv.y));
    float shaftAcross = worldAcross / shaftHalfWidth;
    float shaft = exp(-shaftAcross * shaftAcross * mix(2.2, 0.82, softness));
    float shaftFeather = 1.0 - smoothstep(1.1, 2.0 + softness * 0.35, shaftAcross);
    float hazeHalfWidth = shaftHalfWidth * (1.35 + softness * 0.3);
    float hazeAcross = worldAcross / hazeHalfWidth;
    float haze = exp(-hazeAcross * hazeAcross * mix(1.0, 0.42, softness));
    float hazeFeather = 1.0 - smoothstep(1.25, 2.6 + softness * 0.4, hazeAcross);
    float ends = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.96, 1.0, vUv.y));
    float shaftEnergy = max(0.0, uOpacity);
    float hazeEnergy = max(0.0, uScatteringIntensity);
    float compressedShaft = 0.12 * shaftEnergy / (0.55 + shaftEnergy);
    float compressedHaze = 0.065 * hazeEnergy / (0.4 + hazeEnergy);
    float alpha = ends * (shaft * shaftFeather * compressedShaft + haze * hazeFeather * compressedHaze);
    gl_FragColor = vec4(uMoonColor, alpha);
    #include <colorspace_fragment>
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
