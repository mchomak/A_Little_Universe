import { Quaternion } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

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

const MOONLIGHT_BASE = 0.68
const MOONLIGHT_GROWTH_BOOST = 0.32

export interface GrowthMoonlightLevels {
  key: number
  fill: number
  beam: number
  scattering: number
  shadow: number
}

/** A restrained lunar base is present before impact, then deepens with the existing scene pose. */
export function getGrowthMoonlightLevels(
  lightIntensity: number,
  beamIntensity: number,
  growthProgress: number,
  environmentOpacity: number,
  scatteringIntensity = 0.35,
): GrowthMoonlightLevels {
  const progress = Math.min(1, Math.max(0, Number.isFinite(growthProgress) ? growthProgress : 0))
  const opacity = Math.min(1, Math.max(0, Number.isFinite(environmentOpacity) ? environmentOpacity : 0))
  const growth = MOONLIGHT_BASE + MOONLIGHT_GROWTH_BOOST * progress
  const intensity = Math.max(0, Number.isFinite(lightIntensity) ? lightIntensity : 0)
  const beam = Math.max(0, Number.isFinite(beamIntensity) ? beamIntensity : 0)
  const scattering = Math.max(0, Number.isFinite(scatteringIntensity) ? scatteringIntensity : 0.35)
  return {
    key: intensity * growth * opacity,
    fill: intensity * growth * 0.4 * opacity,
    beam: beam * (0.68 + 0.32 * progress) * opacity,
    scattering: scattering * (0.68 + 0.32 * progress) * opacity,
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

/** Keep the light over the island center and express its radius as a scale of the island. */
export function getGrowthMoonlightBeamLayout(settings: Pick<GrowthMoonlightSettings,
  'islandRadius' | 'moonBeamRadius' | 'moonPositionY'>,
): GrowthMoonlightBeamLayout {
  const sourceHeight = Number.isFinite(settings.moonPositionY) ? Math.max(0.05, settings.moonPositionY) : 5.5
  const islandRadius = Number.isFinite(settings.islandRadius) ? Math.max(0.05, settings.islandRadius) : 0.82
  const radiusScale = Number.isFinite(settings.moonBeamRadius) ? Math.min(2, Math.max(0.2, settings.moonBeamRadius / 2)) : 1
  const radius = islandRadius * radiusScale
  const source: [number, number, number] = [0, sourceHeight, 0]
  const quaternion = new Quaternion()
  return {
    start: [0, 0, 0],
    end: [...source],
    source,
    position: [0, sourceHeight * 0.5, 0],
    radius,
    quaternion,
    // Leave room beyond the shader's feather so the analytic volume cannot
    // reveal the rectangular edge of its single transparent plane.
    width: Math.max(0.1, radius * 12),
    height: sourceHeight,
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
    float hazeHalfWidth = shaftHalfWidth * (1.45 + softness * 0.45);
    float hazeAcross = worldAcross / hazeHalfWidth;
    float haze = exp(-hazeAcross * hazeAcross * mix(1.0, 0.42, softness));
    float hazeFeather = 1.0 - smoothstep(1.25, 2.6 + softness * 0.4, hazeAcross);
    float ends = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.96, 1.0, vUv.y));
    float shaftEnergy = max(0.0, uOpacity);
    float hazeEnergy = max(0.0, uScatteringIntensity);
    float compressedShaft = 0.34 * shaftEnergy / (0.55 + shaftEnergy);
    float compressedHaze = 0.30 * hazeEnergy / (0.4 + hazeEnergy);
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
