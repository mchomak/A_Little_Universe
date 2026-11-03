import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { acquireGalleryArchMaterials, setGalleryArchOpacity } from './archModel'

describe('gallery arch fading', () => {
  it('keeps smooth opacity while depth-writing visible shells and releases zero-opacity depth', () => {
    const root = new Group()
    const source = new MeshStandardMaterial({ color: '#777777' })
    const mesh = new Mesh(new BoxGeometry(2, 3, 1), source)
    root.add(mesh)

    const release = acquireGalleryArchMaterials(root)
    const material = mesh.material as MeshStandardMaterial
    expect(material).not.toBe(source)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(true)

    setGalleryArchOpacity(root, 0.42)
    expect(material.opacity).toBeCloseTo(0.42)
    expect(material.depthWrite).toBe(true)

    setGalleryArchOpacity(root, 0)
    expect(material.opacity).toBe(0)
    expect(material.depthWrite).toBe(false)

    release()
    expect(mesh.material).toBe(source)
    material.dispose()
    source.dispose()
    mesh.geometry.dispose()
  })
})
