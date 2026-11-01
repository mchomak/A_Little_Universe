import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type Object3D,
} from 'three'

import antherBase from '../../assets/lily/enhanced/anther_base.png?url'
import antherNormal from '../../assets/lily/enhanced/anther_normal.png?url'
import antherRoughness from '../../assets/lily/enhanced/anther_roughness.png?url'
import filamentBase from '../../assets/lily/enhanced/filament_base.png?url'
import filamentNormal from '../../assets/lily/enhanced/filament_normal.png?url'
import filamentRoughness from '../../assets/lily/enhanced/filament_roughness.png?url'
import leafBase from '../../assets/lily/enhanced/leaf_base.png?url'
import leafNormal from '../../assets/lily/enhanced/leaf_normal.png?url'
import leafRoughness from '../../assets/lily/enhanced/leaf_roughness.png?url'
import petalOutsideBase from '../../assets/lily/enhanced/petal_outside_base.png?url'
import petalOutsideNormal from '../../assets/lily/enhanced/petal_outside_normal.png?url'
import petalOutsideRoughness from '../../assets/lily/enhanced/petal_outside_roughness.png?url'
import petalPearlBase from '../../assets/lily/enhanced/petal_pearl_base.png?url'
import petalPearlNormal from '../../assets/lily/enhanced/petal_pearl_normal.png?url'
import petalPearlRoughness from '../../assets/lily/enhanced/petal_pearl_roughness.png?url'
import stemBase from '../../assets/lily/enhanced/stem_base.png?url'
import stemNormal from '../../assets/lily/enhanced/stem_normal.png?url'
import stemRoughness from '../../assets/lily/enhanced/stem_roughness.png?url'

export type LilyTextureRole = 'anther' | 'filament' | 'leaf' | 'petalOutside' | 'petalPearl' | 'stem'
export type LilyMaterialMode = 'original' | 'enhanced'
export type LilyMaterialStatus = 'idle' | 'loading' | 'ready' | 'error'
export type LilySceneId = 'growth' | 'bloom' | 'identity' | string

export interface LilyEnhancedTextureSet {
  baseColor: Texture
  roughness: Texture
  normal: Texture
}

export interface LilyMaterialStateSnapshot {
  mode: LilyMaterialMode
  status: LilyMaterialStatus
}

const TEXTURE_URLS: Record<LilyTextureRole, { baseColor: string; roughness: string; normal: string }> = {
  anther: { baseColor: antherBase, roughness: antherRoughness, normal: antherNormal },
  filament: { baseColor: filamentBase, roughness: filamentRoughness, normal: filamentNormal },
  leaf: { baseColor: leafBase, roughness: leafRoughness, normal: leafNormal },
  petalOutside: { baseColor: petalOutsideBase, roughness: petalOutsideRoughness, normal: petalOutsideNormal },
  petalPearl: { baseColor: petalPearlBase, roughness: petalPearlRoughness, normal: petalPearlNormal },
  stem: { baseColor: stemBase, roughness: stemRoughness, normal: stemNormal },
}

const MATERIAL_ROLES: Record<string, LilyTextureRole> = {
  Anther_SoftGold: 'anther',
  Filament_Ivory: 'filament',
  Leaf_SoftGreen: 'leaf',
  Petal_Outside: 'petalOutside',
  Petal_Pearl: 'petalPearl',
  Stem_SoftGreen: 'stem',
}

export function getLilyTextureRole(materialName: string): LilyTextureRole | null {
  return MATERIAL_ROLES[materialName] ?? null
}

export function shouldUseEnhancedLilyMaterials(dev: boolean, scene: LilySceneId, mode: LilyMaterialMode): boolean {
  return dev && scene === 'bloom' && mode === 'enhanced'
}

export function configureLilyTexture(texture: Texture, kind: 'baseColor' | 'data'): Texture {
  texture.flipY = false
  texture.colorSpace = kind === 'baseColor' ? SRGBColorSpace : NoColorSpace
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export async function loadLilyEnhancedTextures(): Promise<Record<LilyTextureRole, LilyEnhancedTextureSet>> {
  return loadLilyEnhancedTexturesWithLoader(new TextureLoader())
}

export async function loadLilyEnhancedTexturesWithLoader(
  loader: { loadAsync(url: string): Promise<Texture> },
): Promise<Record<LilyTextureRole, LilyEnhancedTextureSet>> {
  const roleUrls = Object.entries(TEXTURE_URLS) as [LilyTextureRole, typeof TEXTURE_URLS[LilyTextureRole]][]
  const requests = roleUrls.flatMap(([role, urls]) => (['baseColor', 'roughness', 'normal'] as const).map((slot) => ({ role, slot, url: urls[slot] })))
  const settled = await Promise.allSettled(requests.map(({ url }) => loader.loadAsync(url)))
  const loaded = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  try {
    const failure = settled.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    const result = {} as Record<LilyTextureRole, LilyEnhancedTextureSet>
    const assigned = new Map<LilyTextureRole, Partial<LilyEnhancedTextureSet>>()
    requests.forEach(({ role, slot }, index) => {
      const response = settled[index]!
      if (response.status !== 'fulfilled') return
      const maps = assigned.get(role) ?? {}
      maps[slot] = configureLilyTexture(response.value, slot === 'baseColor' ? 'baseColor' : 'data')
      assigned.set(role, maps)
    })
    for (const [role] of roleUrls) {
      const maps = assigned.get(role)
      if (!maps?.baseColor || !maps.roughness || !maps.normal) throw new Error(`Incomplete enhanced lily textures for ${role}`)
      result[role] = maps as LilyEnhancedTextureSet
    }
    return result
  } catch (error) {
    for (const texture of loaded) texture.dispose()
    throw error
  }
}

export function cloneEnhancedLilyMaterials(
  states: readonly { material: Material }[],
  textureSets: Partial<Record<LilyTextureRole, LilyEnhancedTextureSet>>,
): Map<Material, Material> {
  const variants = new Map<Material, Material>()
  for (const { material } of states) {
    if (!(material instanceof MeshStandardMaterial)) continue
    const role = getLilyTextureRole(material.name)
    const maps = role ? textureSets[role] : undefined
    if (!maps) continue

    const enhanced = material.clone()
    enhanced.color.setRGB(1, 1, 1)
    enhanced.map = maps.baseColor
    enhanced.roughnessMap = maps.roughness
    enhanced.normalMap = maps.normal
    enhanced.roughness = 1
    enhanced.normalScale.set(0.35, 0.35)
    enhanced.needsUpdate = true
    variants.set(material, enhanced)
  }
  return variants
}

export function applyLilyMaterialVariants(root: Object3D, variants: ReadonlyMap<Material, Material>, enabled: boolean): void {
  if (!variants.size) return
  const replacements = new Map<Material, Material>()
  for (const [original, enhanced] of variants) replacements.set(enabled ? original : enhanced, enabled ? enhanced : original)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => replacements.get(material) ?? material)
      : replacements.get(object.material) ?? object.material
  })
}

let materialSnapshot: LilyMaterialStateSnapshot = { mode: 'original', status: 'idle' }
const materialListeners = new Set<() => void>()

export function getLilyMaterialSnapshot(): LilyMaterialStateSnapshot {
  return materialSnapshot
}

export function subscribeLilyMaterialExperiment(listener: () => void): () => void {
  materialListeners.add(listener)
  return () => materialListeners.delete(listener)
}

function updateMaterialSnapshot(next: LilyMaterialStateSnapshot): void {
  if (next.mode === materialSnapshot.mode && next.status === materialSnapshot.status) return
  materialSnapshot = next
  for (const listener of materialListeners) listener()
}

export function setLilyMaterialMode(mode: LilyMaterialMode): void {
  if (mode === materialSnapshot.mode) return
  updateMaterialSnapshot({ mode, status: mode === 'enhanced' ? 'loading' : 'idle' })
}

export function resetLilyMaterialModeOutsideBloom(scene: LilySceneId): void {
  if (scene !== 'bloom') setLilyMaterialMode('original')
}

export function setLilyMaterialStatus(status: LilyMaterialStatus): void {
  updateMaterialSnapshot({ ...materialSnapshot, status })
}

export function resetLilyMaterialExperiment(): void {
  updateMaterialSnapshot({ mode: 'original', status: 'idle' })
}

export function disposeLilyEnhancedTextures(textures: Record<LilyTextureRole, LilyEnhancedTextureSet>): void {
  const disposed = new Set<Texture>()
  for (const maps of Object.values(textures)) {
    for (const texture of Object.values(maps)) {
      if (!disposed.has(texture)) {
        disposed.add(texture)
        texture.dispose()
      }
    }
  }
}
