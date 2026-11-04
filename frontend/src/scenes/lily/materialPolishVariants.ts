import { Material, Mesh, type Object3D } from 'three'

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
