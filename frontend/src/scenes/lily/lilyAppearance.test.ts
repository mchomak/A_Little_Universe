import { Color, Material, MeshStandardMaterial, ShaderLib, type WebGLRenderer } from 'three'
import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { patchLilyMaterial, createLilyDissolveUniforms } from './dissolve'
import { createLilyAppearanceUniforms, lilyAppearancePart, patchLilyAppearanceMaterial, updateLilyAppearance } from './lilyAppearance'

it('composes bud and leaf appearance shading with the existing dissolve shader hooks', () => {
  const material = new MeshStandardMaterial()
  const dissolve = createLilyDissolveUniforms()
  const appearance = createLilyAppearanceUniforms()
  patchLilyMaterial(material, 0, dissolve)
  patchLilyAppearanceMaterial(material, 'bud', appearance)

  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  } as unknown as Parameters<Material['onBeforeCompile']>[0]
  material.onBeforeCompile(shader, {} as WebGLRenderer)

  expect(shader.uniforms).toMatchObject({
    uLilyActive: dissolve.uLilyActive,
    uLilyBudGlowIntensity: appearance.uLilyBudGlowIntensity,
    uLilyAppearancePart: { value: 0 },
  })
  const appearanceNormalAssignment = shader.vertexShader.indexOf('vLilyAppearanceNormal =')
  expect(shader.vertexShader.indexOf('#include <morphnormal_vertex>')).toBeLessThan(appearanceNormalAssignment)
  expect(shader.vertexShader.indexOf('#include <skinnormal_vertex>')).toBeLessThan(appearanceNormalAssignment)
  expect(shader.vertexShader.indexOf('#include <defaultnormal_vertex>')).toBeLessThan(appearanceNormalAssignment)
  expect(shader.vertexShader).toContain('vLilyAppearanceNormal = normalize(transformedNormal)')
  expect(shader.fragmentShader).toContain('lilyThreshold')
  expect(shader.fragmentShader).toContain('lilyEdgeLight')
  expect(shader.fragmentShader).toContain('growthGlow')
  expect(shader.fragmentShader).toContain('uLilyBudGlowColor')
  expect(shader.vertexShader).toContain('vLilyAppearanceUv = vMapUv')
  expect(shader.fragmentShader).toContain('petalLongitudinalVein')
  expect(shader.fragmentShader).toContain('leafCentralVein')
  expect(shader.fragmentShader).toContain('uLilyInnerCupGlow')
  expect(shader.fragmentShader).toContain('innerCupSurfaceGlow')
  expect(shader.fragmentShader).toContain('uLilyCupCenter')
  expect(shader.fragmentShader).toContain('petalBaseSurfaceGlow')
  expect(shader.fragmentShader).toContain('uLilyBudBloomBoost * smoothstep')
  expect(shader.fragmentShader).not.toContain('uLilyMoonlightColor')
  expect(shader.fragmentShader).not.toContain('lilyMoonlightPart')
  expect(material.customProgramCacheKey()).toContain('lily-dissolve-v1-0-lily-appearance-v5-bud')

  material.dispose()

  const leafMaterial = new MeshStandardMaterial()
  patchLilyMaterial(leafMaterial, 2, dissolve)
  patchLilyAppearanceMaterial(leafMaterial, 'leaf', appearance)
  expect(leafMaterial.customProgramCacheKey()).toContain('lily-appearance-v5-leaf')
  leafMaterial.dispose()
})

it('keeps moonlight out of lily emissive shading so authored petal and leaf colors survive', () => {
  const material = new MeshStandardMaterial()
  patchLilyAppearanceMaterial(material, 'bud', createLilyAppearanceUniforms())

  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  } as unknown as Parameters<Material['onBeforeCompile']>[0]
  material.onBeforeCompile(shader, {} as WebGLRenderer)

  expect(shader.fragmentShader).not.toContain('uLilyMoonlightColor')
  expect(shader.fragmentShader).not.toContain('lilyMoonlightPart')
  material.dispose()
})

it('selects leaf and bud variants from authored mesh or material names', () => {
  expect(lilyAppearancePart('Leaf_A', [], 2)).toBe('leaf')
  expect(lilyAppearancePart('mesh', ['Leaf_Green'], 2)).toBe('leaf')
  expect(lilyAppearancePart('Petals', ['Petal'], 0)).toBe('bud')
  expect(lilyAppearancePart('Cube003', ['Anther_SoftGold'], 1)).toBe('center')
  expect(lilyAppearancePart('Cube003_1', ['Filament_Ivory'], 1)).toBe('center')
  expect(lilyAppearancePart('Calyx', ['Stem_SoftGreen'], 1)).toBe('center')
  expect(lilyAppearancePart('Stem', ['Stem_Green'], 2)).toBe('other')
})

it('updates appearance uniforms live and keeps glow disabled without disturbing leaf controls', () => {
  const uniforms = createLilyAppearanceUniforms()
  const { lilyBudGlow, lilyLeafMaterial } = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth
  updateLilyAppearance(uniforms, { ...lilyBudGlow, enabled: false }, {
    translucencyStrength: 0.85, edgeLightIntensity: 0.42, colorVariation: 0.68,
  }, 0.72, 0.35, { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen, innerCupGlow: 1.2 })

  expect(uniforms.uLilyGrowthProgress.value).toBe(0.72)
  expect(uniforms.uLilyBloomProgress.value).toBe(0.35)
  expect(uniforms.uLilyBudGlowIntensity.value).toBe(0)
  expect(uniforms.uLilyBudGlowColor.value).toBeInstanceOf(Color)
  expect(uniforms.uLilyBudRimStrength.value).toBe(0)
  expect(uniforms.uLilyLeafTranslucency.value).toBe(0.85)
  expect(uniforms.uLilyLeafEdgeLight.value).toBe(0.42)
  expect(uniforms.uLilyLeafColorVariation.value).toBe(0.68)
  expect(uniforms.uLilyInnerCupGlow.value).toBe(1.2)

  updateLilyAppearance(uniforms, lilyBudGlow, lilyLeafMaterial, Number.NaN, 3,
    { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen, enabled: false, innerCupGlow: 1.2 })
  expect(uniforms.uLilyGrowthProgress.value).toBe(0)
  expect(uniforms.uLilyBloomProgress.value).toBe(1)
  expect(uniforms.uLilyBudGlowIntensity.value).toBe(lilyBudGlow.intensity)
  expect(uniforms.uLilyInnerCupGlow.value).toBe(0)
})
