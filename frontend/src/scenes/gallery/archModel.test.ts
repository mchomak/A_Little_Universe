import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { acquireGalleryArchMaterials, setGalleryArchOpacity } from './archModel'

describe('gallery arch fading', () => {
  it('applies fade and depth behavior to every material on a multi-part arch', () => {
    const root = new Group()
    const sources = [
      new MeshStandardMaterial({ color: '#777777' }),
      new MeshStandardMaterial({ color: '#888888' }),
      new MeshStandardMaterial({ color: '#999999' }),
    ]
    const meshes = [
      new Mesh(new BoxGeometry(2, 3, 1), sources[0]!),
      new Mesh(new BoxGeometry(1, 2, 1), sources[1]!),
      new Mesh(new BoxGeometry(1, 1, 1), [sources[0]!, sources[2]!]),
      new Mesh(new BoxGeometry(0.5, 2, 0.5), sources[2]!),
    ]
    meshes.forEach((mesh, index) => {
      mesh.position.set(index * 0.1, index * 0.2, 0)
      root.add(mesh)
    })
    const originals = meshes.map((mesh) => mesh.material)

    const release = acquireGalleryArchMaterials(root)
    const variants = meshes.flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    const uniqueVariants = [...new Set(variants)] as MeshStandardMaterial[]
    expect(uniqueVariants).toHaveLength(sources.length)
    uniqueVariants.forEach((material, index) => {
      expect(material).not.toBe(sources[index])
      expect(material.transparent).toBe(true)
      expect(material.depthWrite).toBe(true)
    })

    setGalleryArchOpacity(root, 0.42)
    uniqueVariants.forEach((material) => {
      expect(material.opacity).toBeCloseTo(0.42)
      expect(material.depthWrite).toBe(true)
    })

    setGalleryArchOpacity(root, 0)
    uniqueVariants.forEach((material) => {
      expect(material.opacity).toBe(0)
      expect(material.depthWrite).toBe(false)
    })

    release()
    meshes.forEach((mesh, index) => {
      expect(mesh.material).toBe(originals[index])
      mesh.geometry.dispose()
    })
    uniqueVariants.forEach((material) => material.dispose())
    sources.forEach((material) => material.dispose())
  })
})
