import { expect, it, vi } from 'vitest'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { createLilyGeometryParticleSource, createLilyGeometryParticleSourceAsync, lilyDissolvePart } from './particleSource'

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

it('captures the same posed surface while yielding between triangle chunks', async () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, -1, 0, 0,
  ]), 3))
  const material = new MeshBasicMaterial()
  const mesh = new Mesh(geometry, material)
  mesh.name = 'Petals'
  const root = new Group()
  root.add(mesh)
  const yields = vi.fn(async () => undefined)

  const synchronous = createLilyGeometryParticleSource(root)
  const asynchronous = await createLilyGeometryParticleSourceAsync(root, { chunkSize: 1, yieldToMain: yields })

  expect(yields).toHaveBeenCalled()
  expect(asynchronous.center).toEqual(synchronous.center)
  expect(asynchronous.radius).toBe(synchronous.radius)
  expect(asynchronous.minY).toBe(synchronous.minY)
  expect(asynchronous.maxY).toBe(synchronous.maxY)
  for (let index = 0; index < 20; index += 1) {
    expect(asynchronous.sampleSurface(index, 20)).toEqual(synchronous.sampleSurface(index, 20))
  }

  geometry.dispose()
  material.dispose()
})

it('cancels asynchronous surface capture at a yield boundary', async () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, -1, 0, 0,
  ]), 3))
  const material = new MeshBasicMaterial()
  const mesh = new Mesh(geometry, material)
  const root = new Group()
  root.add(mesh)
  const getVertexPosition = vi.spyOn(mesh, 'getVertexPosition')
  let cancelled = false

  const pending = createLilyGeometryParticleSourceAsync(root, {
    chunkSize: 1,
    yieldToMain: async () => { cancelled = true },
    isCancelled: () => cancelled,
  })

  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(getVertexPosition).toHaveBeenCalledTimes(3)
  geometry.dispose()
  material.dispose()
})
