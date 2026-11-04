import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import { GALLERY_WATER_REFLECTION_EXCLUDED } from './planarReflection'

/** Creates the dark card backing while keeping it out of the floor reflection capture. */
export function createGalleryWaterReflectionBackplate(width: number, height: number) {
  const backplate = new Mesh(
    new BoxGeometry(width + 0.08, height + 0.08, 0.07),
    new MeshStandardMaterial({ color: '#171b23', roughness: 0.96, metalness: 0.02 }),
  )
  backplate.position.z = -0.04
  backplate.userData[GALLERY_WATER_REFLECTION_EXCLUDED] = true
  return backplate
}
