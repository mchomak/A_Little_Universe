import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DoubleSide, Group, Mesh, MeshStandardMaterial, Texture, Vector2 } from 'three'
import { expect, it, vi } from 'vitest'
import {
  applyLilyMaterialVariants,
  cloneEnhancedLilyMaterials,
  configureLilyTexture,
  getLilyMaterialSnapshot,
  getLilyTextureRole,
  loadLilyEnhancedTexturesWithLoader,
  resetLilyMaterialExperiment,
  resetLilyMaterialModeOutsideBloom,
  setLilyMaterialMode,
  shouldUseEnhancedLilyMaterials,
  type LilyEnhancedTextureSet,
} from './materialPolish'

it('maps every original GLB material to its matching prepared texture group', () => {
  expect([
    'Stem_SoftGreen', 'Leaf_SoftGreen', 'Petal_Pearl', 'Petal_Outside',
    'Filament_Ivory', 'Anther_SoftGold',
  ].map(getLilyTextureRole)).toEqual(['stem', 'leaf', 'petalPearl', 'petalOutside', 'filament', 'anther'])
  expect(getLilyTextureRole('Unknown')).toBeNull()
})

it('keeps the source GLB unchanged and maps every textured mesh slot by its material name', () => {
  const source = readFileSync(new URL('../../assets/lily/lily_004_final.glb', import.meta.url))
  expect(createHash('sha256').update(source).digest('hex').toUpperCase()).toBe('D185C66D7B990C2C7417D1ED8016FB41AB0D263E505AE730251DE4069F8EB18C')
  const jsonLength = source.readUInt32LE(12)
  const document = JSON.parse(source.toString('utf8', 20, 20 + jsonLength)) as {
    materials: Array<{ name: string }>
    meshes: Array<{ primitives: Array<{ material?: number; attributes: Record<string, number> }> }>
  }
  const materialNames = new Set(document.materials.map(({ name }) => name))
  expect([...materialNames].map(getLilyTextureRole).every(Boolean)).toBe(true)
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
    expect(getLilyTextureRole(document.materials[primitive.material!]?.name ?? '')).not.toBeNull()
    expect(primitive.attributes.TEXCOORD_0).toEqual(expect.any(Number))
  }
})

it('enables the material experiment only in DEV while scene 03 is active', () => {
  expect(shouldUseEnhancedLilyMaterials(true, 'bloom', 'enhanced')).toBe(true)
  expect(shouldUseEnhancedLilyMaterials(false, 'bloom', 'enhanced')).toBe(false)
  expect(shouldUseEnhancedLilyMaterials(true, 'growth', 'enhanced')).toBe(false)
  expect(shouldUseEnhancedLilyMaterials(true, 'identity', 'enhanced')).toBe(false)
  expect(shouldUseEnhancedLilyMaterials(true, 'bloom', 'original')).toBe(false)
})

it('creates separate enhanced materials and restores the baseline without changing it', () => {
  const baseColor = new Texture()
  const roughness = new Texture()
  const normal = new Texture()
  const maps: LilyEnhancedTextureSet = { baseColor, roughness, normal }
  const baseline = new MeshStandardMaterial({
    name: 'Leaf_SoftGreen', color: 0x885522, roughness: 0.4,
    opacity: 0.72, transparent: true, depthWrite: false, side: DoubleSide,
  })
  baseline.normalScale = new Vector2(0.8, 0.7)
  const variants = cloneEnhancedLilyMaterials([{ material: baseline }], { leaf: maps })
  const enhanced = variants.get(baseline) as MeshStandardMaterial
  const model = new Group()
  const mesh = new Mesh(undefined, baseline)
  model.add(mesh)

  expect(enhanced).not.toBe(baseline)
  expect(enhanced.map).toBe(baseColor)
  expect(enhanced.roughnessMap).toBe(roughness)
  expect(enhanced.normalMap).toBe(normal)
  expect(enhanced.color.getHex()).toBe(0xffffff)
  expect(enhanced.roughness).toBe(1)
  expect(enhanced.normalScale).toEqual(new Vector2(0.35, 0.35))
  expect(enhanced.opacity).toBe(0.72)
  expect(enhanced.transparent).toBe(true)
  expect(enhanced.depthWrite).toBe(false)
  expect(enhanced.side).toBe(DoubleSide)
  expect(baseline.map).toBeNull()
  expect(baseline.color.getHex()).toBe(0x885522)
  expect(baseline.roughness).toBe(0.4)

  applyLilyMaterialVariants(model, variants, true)
  expect(mesh.material).toBe(enhanced)
  applyLilyMaterialVariants(model, variants, false)
  expect(mesh.material).toBe(baseline)
  for (const material of variants.values()) material.dispose()
  baseColor.dispose()
  roughness.dispose()
  normal.dispose()
  baseline.dispose()
})

it('configures base color as sRGB and data textures as linear, with glTF UV orientation', () => {
  const texture = new Texture()
  configureLilyTexture(texture, 'baseColor')
  expect(texture.flipY).toBe(false)
  expect(texture.colorSpace).toBe('srgb')
  configureLilyTexture(texture, 'data')
  expect(texture.flipY).toBe(false)
  expect(texture.colorSpace).toBe('')
  texture.dispose()
})

it('disposes every successfully loaded texture when another map fails', async () => {
  const loaded: Texture[] = []
  const disposed: Texture[] = []
  let call = 0
  const loader = {
    loadAsync: vi.fn(async () => {
      call += 1
      if (call === 6) throw new Error('broken PNG')
      const texture = new Texture()
      texture.addEventListener('dispose', () => disposed.push(texture))
      loaded.push(texture)
      return texture
    }),
  }

  await expect(loadLilyEnhancedTexturesWithLoader(loader)).rejects.toThrow('broken PNG')
  expect(loader.loadAsync).toHaveBeenCalledTimes(18)
  expect(loaded).toHaveLength(17)
  expect(disposed).toHaveLength(17)
})

it('returns to Original when leaving scene 03 so Enhanced is never reapplied on a later visit', () => {
  resetLilyMaterialExperiment()
  setLilyMaterialMode('enhanced')
  expect(getLilyMaterialSnapshot().mode).toBe('enhanced')
  resetLilyMaterialModeOutsideBloom('identity')
  expect(getLilyMaterialSnapshot()).toEqual({ mode: 'original', status: 'idle' })
})
