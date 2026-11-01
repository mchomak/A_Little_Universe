import { expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { createLilyGeometryParticleSource, lilyDissolvePart } from './particleSource'

it('groups Lily 004 meshes in petal, floral-center, and foliage dissolve phases', () => {
  expect(lilyDissolvePart('Petals')).toBe(0)
  expect(lilyDissolvePart('Petals_Outside')).toBe(0)
  // The semantic parent name remains supported for loader variants that expose it as a mesh.
  expect(lilyDissolvePart('Flower_Details')).toBe(1)
  expect(lilyDissolvePart('Calyx')).toBe(1)
  expect(lilyDissolvePart('Stem')).toBe(2)
  expect(lilyDissolvePart('Leaf_A')).toBe(2)
  expect(lilyDissolvePart('Leaf_B')).toBe(2)
})

it('samples the GLB anther and filament meshes in the floral-center phase by material name', () => {
  const centerMeshes = [
    ['Cube003', 'Anther_SoftGold'],
    ['Cube003_1', 'Filament_Ivory'],
  ] as const

  for (const [meshName, materialName] of centerMeshes) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    const material = new MeshBasicMaterial()
    material.name = materialName
    const mesh = new Mesh(geometry, material)
    mesh.name = meshName
    const root = new Group()
    root.add(mesh)

    expect(lilyDissolvePart(mesh.name, [material.name])).toBe(1)
    expect(createLilyGeometryParticleSource(root).sampleSurface(0, 1).part).toBe(1)

    geometry.dispose()
    material.dispose()
  }

  expect(lilyDissolvePart('UnlabeledCenter', ['Anther_SoftGold'])).toBe(1)
  expect(lilyDissolvePart('UnlabeledCenter', ['Filament_Ivory'])).toBe(1)
})
