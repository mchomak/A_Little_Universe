import { Color, Vector3, type Material } from 'three'
import type { LilyBloomPollenSettings, LilyBudGlowSettings, LilyLeafMaterialSettings } from '../../systems/scene-config/config'

export type LilyAppearancePart = 'bud' | 'leaf' | 'center' | 'other'

export interface LilyAppearanceUniforms {
  uLilyAppearancePart: { value: number }
  uLilyGrowthProgress: { value: number }
  uLilyBloomProgress: { value: number }
  uLilyBudGlowIntensity: { value: number }
  uLilyBudGlowColor: { value: Color }
  uLilyBudRimStrength: { value: number }
  uLilyBudBloomBoost: { value: number }
  uLilyLeafTranslucency: { value: number }
  uLilyLeafEdgeLight: { value: number }
  uLilyLeafColorVariation: { value: number }
  uLilyInnerCupGlow: { value: number }
  uLilyCupCenter: { value: Vector3 }
}

export function createLilyAppearanceUniforms(): LilyAppearanceUniforms {
  return {
    uLilyAppearancePart: { value: 2 },
    uLilyGrowthProgress: { value: 0 },
    uLilyBloomProgress: { value: 0 },
    uLilyBudGlowIntensity: { value: 0.48 },
    uLilyBudGlowColor: { value: new Color('#E9B9CE') },
    uLilyBudRimStrength: { value: 0.28 },
    uLilyBudBloomBoost: { value: 0.7 },
    uLilyLeafTranslucency: { value: 0.32 },
    uLilyLeafEdgeLight: { value: 0.2 },
    uLilyLeafColorVariation: { value: 0.24 },
    uLilyInnerCupGlow: { value: 0.35 },
    uLilyCupCenter: { value: new Vector3(0.09, 0.823, 0.18) },
  }
}

/** Resolve the two authored leaves and petal head without changing GLB names or geometry. */
export function lilyAppearancePart(name: string, materialNames: readonly string[], dissolvePart: number): LilyAppearancePart {
  if (/anther|filament|pistil|flower[_ ]?(interior|details)|calyx/i.test(`${name} ${materialNames.join(' ')}`)) return 'center'
  if (/leaf|foliage/i.test(`${name} ${materialNames.join(' ')}`)) return 'leaf'
  return dissolvePart === 0 ? 'bud' : 'other'
}

/** Add the appearance shader after the existing dissolve hook so both effects compile together. */
export function patchLilyAppearanceMaterial(
  material: Material,
  part: LilyAppearancePart,
  uniforms: LilyAppearanceUniforms,
) {
  const dissolveCompile = material.onBeforeCompile
  const dissolveCacheKey = material.customProgramCacheKey
  const partValue = part === 'bud' ? 0 : part === 'leaf' ? 1 : part === 'center' ? 2 : 3
  material.onBeforeCompile = (shader, renderer) => {
    dissolveCompile(shader, renderer)
    Object.assign(shader.uniforms, uniforms, { uLilyAppearancePart: { value: partValue } })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLilyAppearanceNormal;\nvarying vec2 vLilyAppearanceUv;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
          vLilyAppearanceUv = vMapUv;
        #else
          vLilyAppearanceUv = vec2(0.5);
        #endif`)
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvLilyAppearanceNormal = normalize(transformedNormal);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLilyAppearanceNormal;
        varying vec2 vLilyAppearanceUv;
        uniform float uLilyAppearancePart;
        uniform float uLilyGrowthProgress;
        uniform float uLilyBloomProgress;
        uniform float uLilyBudGlowIntensity;
        uniform vec3 uLilyBudGlowColor;
        uniform float uLilyBudRimStrength;
        uniform float uLilyBudBloomBoost;
        uniform float uLilyLeafTranslucency;
        uniform float uLilyLeafEdgeLight;
        uniform float uLilyLeafColorVariation;
        uniform float uLilyInnerCupGlow;
        uniform vec3 uLilyCupCenter;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uLilyAppearancePart > 0.5 && uLilyAppearancePart < 1.5) {
          float leafTone = sin(vLilyWorld.x * 3.7 + vLilyWorld.y * 1.9 + vLilyWorld.z * 2.8);
          diffuseColor.rgb *= 1.0 + leafTone * uLilyLeafColorVariation * 0.055;
          #ifdef USE_MAP
            float leafCentralVein = exp(-pow((vLilyAppearanceUv.x - 0.492) / 0.012, 2.0));
            diffuseColor.rgb *= 1.0 - leafCentralVein * 0.025;
          #endif
        } else if (uLilyAppearancePart < 0.5) {
          #ifdef USE_MAP
            float petalLongitudinalVein = exp(-pow((vLilyAppearanceUv.x - 0.513) / 0.014, 2.0))
              + 0.28 * exp(-pow((vLilyAppearanceUv.x - 0.43) / 0.018, 2.0))
              + 0.28 * exp(-pow((vLilyAppearanceUv.x - 0.596) / 0.018, 2.0));
            diffuseColor.rgb *= 1.0 + clamp(petalLongitudinalVein, 0.0, 1.0) * 0.014;
          #endif
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 lilyAppearanceNormal = normalize(vLilyAppearanceNormal);
        vec3 lilyAppearanceView = normalize(vViewPosition);
        float lilyAppearanceRim = pow(1.0 - clamp(dot(lilyAppearanceNormal, lilyAppearanceView), 0.0, 1.0), 2.6);
        if (uLilyAppearancePart < 0.5) {
          float growthGlow = 0.18 + 0.82 * smoothstep(0.52, 1.0, uLilyGrowthProgress);
          float bloomGlow = 0.78 + 0.22 * smoothstep(0.0, 0.45, uLilyBloomProgress);
          float budBloomBoost = uLilyBudBloomBoost * smoothstep(0.2, 0.95, uLilyBloomProgress);
          float budGlow = growthGlow * bloomGlow * (1.0 + budBloomBoost * 0.14);
          float petalBaseDistance = length(vLilyWorld - uLilyCupCenter);
          float petalBaseFalloff = 1.0 - smoothstep(0.12, 0.56, petalBaseDistance);
          float petalBaseSurfaceGlow = uLilyInnerCupGlow * smoothstep(0.08, 0.72, uLilyBloomProgress) * petalBaseFalloff;
          vec3 warmPearl = vec3(1.0, 0.84, 0.63);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.02 + warmPearl * 0.014,
            clamp(petalBaseSurfaceGlow * 0.12, 0.0, 0.12));
          totalEmissiveRadiance += uLilyBudGlowColor * (uLilyBudGlowIntensity * 0.22 * budGlow
            + uLilyBudRimStrength * 0.13 * lilyAppearanceRim * bloomGlow);
          totalEmissiveRadiance += warmPearl * (petalBaseSurfaceGlow * (0.013 + lilyAppearanceRim * 0.01));
        } else if (uLilyAppearancePart < 1.5) {
          float leafThroughLight = pow(1.0 - abs(dot(lilyAppearanceNormal, lilyAppearanceView)), 2.0);
          #ifdef USE_MAP
            float leafCentralVein = exp(-pow((vLilyAppearanceUv.x - 0.492) / 0.012, 2.0));
            totalEmissiveRadiance += diffuseColor.rgb * (leafCentralVein * 0.012);
          #endif
          totalEmissiveRadiance += diffuseColor.rgb * (uLilyLeafTranslucency * leafThroughLight * 0.055
            + uLilyLeafEdgeLight * lilyAppearanceRim * 0.07);
        } else if (uLilyAppearancePart < 2.5) {
          float innerCupProgress = smoothstep(0.08, 0.72, uLilyBloomProgress);
          float innerCupSurfaceGlow = uLilyInnerCupGlow * innerCupProgress;
          float centerRim = pow(1.0 - clamp(dot(lilyAppearanceNormal, lilyAppearanceView), 0.0, 1.0), 1.9);
          vec3 warmPearl = vec3(1.0, 0.84, 0.63);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.025 + warmPearl * 0.018,
            clamp(innerCupSurfaceGlow * 0.13, 0.0, 0.14));
          totalEmissiveRadiance += warmPearl * (innerCupSurfaceGlow * (0.016 + centerRim * 0.04));
        }`)
    material.needsUpdate = true
  }
  material.customProgramCacheKey = () => `${dissolveCacheKey()}-lily-appearance-v5-${part}`
  material.needsUpdate = true
}

export function updateLilyAppearance(
  uniforms: LilyAppearanceUniforms,
  budGlow: LilyBudGlowSettings,
  leafMaterial: LilyLeafMaterialSettings,
  growthProgress: number,
  bloomProgress: number,
  bloomPollen: LilyBloomPollenSettings,
) {
  uniforms.uLilyGrowthProgress.value = finiteUnit(growthProgress)
  uniforms.uLilyBloomProgress.value = finiteUnit(bloomProgress)
  uniforms.uLilyBudGlowIntensity.value = finite(budGlow.enabled ? budGlow.intensity : 0, 0, 2)
  uniforms.uLilyBudGlowColor.value.set(budGlow.color)
  uniforms.uLilyBudRimStrength.value = finite(budGlow.enabled ? budGlow.rimStrength : 0, 0, 2)
  uniforms.uLilyBudBloomBoost.value = finite(budGlow.enabled ? budGlow.bloomBoost : 0, 0, 2)
  uniforms.uLilyLeafTranslucency.value = finite(leafMaterial.translucencyStrength, 0, 1)
  uniforms.uLilyLeafEdgeLight.value = finite(leafMaterial.edgeLightIntensity, 0, 1)
  uniforms.uLilyLeafColorVariation.value = finite(leafMaterial.colorVariation, 0, 1)
  uniforms.uLilyInnerCupGlow.value = finite(bloomPollen.enabled ? bloomPollen.innerCupGlow : 0, 0, 2)
}

function finiteUnit(value: number) {
  return finite(value, 0, 1)
}

function finite(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min
}
