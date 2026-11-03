import { Box3, Camera, Color, Light, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'

const ARCH_TINT = new Color('#9eb5d7')
const ARCH_EMISSIVE = new Color('#253e62')

export interface GalleryArchBounds {
  width: number
  height: number
  depth: number
}

export function centerGalleryArchAtFloor(root: Object3D): GalleryArchBounds | null {
  root.updateWorldMatrix(true, true)
  const bounds = new Box3().setFromObject(root)
  if (bounds.isEmpty()) return null
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  root.position.x -= center.x
  root.position.y -= bounds.min.y
  root.position.z -= center.z
  root.updateWorldMatrix(true, true)
  return { width: size.x, height: size.y, depth: size.z }
}

/** The single arch can use private material variants because its opacity changes continuously with camera distance. */
export function acquireGalleryArchMaterials(root: Object3D): () => void {
  const originals = new Map<Mesh, Material | Material[]>()
  const materials = new Set<MeshStandardMaterial>()
  const sourceVariants = new Map<MeshStandardMaterial, MeshStandardMaterial>()
  const ignoreRaycast = () => undefined
  const nonRenderable: Object3D[] = []
  root.traverse((object) => {
    if (object instanceof Camera || object instanceof Light) {
      nonRenderable.push(object)
      return
    }
    if (!(object instanceof Mesh)) return
    object.raycast = ignoreRaycast
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    let changed = false
    const variants = sourceMaterials.map((source) => {
      if (!(source instanceof MeshStandardMaterial)) return source
      let material = sourceVariants.get(source)
      if (!material) {
        material = source.clone()
        material.color.multiply(ARCH_TINT)
        material.emissive.copy(ARCH_EMISSIVE)
        material.emissiveIntensity = Math.max(0.1, material.emissiveIntensity)
        material.roughness = Math.max(0.82, material.roughness)
        material.metalness = Math.min(0.08, material.metalness)
        material.transparent = true
        material.opacity = 0.7
        material.depthWrite = false
        material.needsUpdate = true
        sourceVariants.set(source, material)
        materials.add(material)
      }
      changed = true
      return material
    })
    if (changed) {
      originals.set(object, object.material)
      object.material = Array.isArray(object.material) ? variants : variants[0]!
    }
  })
  nonRenderable.forEach((object) => object.parent?.remove(object))

  let released = false
  return () => {
    if (released) return
    released = true
    originals.forEach((material, mesh) => { mesh.material = material })
    materials.forEach((material) => material.dispose())
  }
}

export function setGalleryArchOpacity(root: Object3D, opacity: number) {
  const alpha = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const values = Array.isArray(object.material) ? object.material : [object.material]
    values.forEach((material) => { if (material instanceof MeshStandardMaterial) material.opacity = alpha })
  })
}
