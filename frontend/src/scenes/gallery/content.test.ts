import { describe, expect, it } from 'vitest'
import { Group, Vector3 } from 'three'
import { gallerySupportGroupScale, gallerySupportLocalPositions } from './content'

describe('gallery support transforms', () => {
  it('keeps both B column rails mirrored through the first-memory intro scale', () => {
    const photoPosition = [-3.5, 0, -9.9] as const
    const supports = [
      [-3.5, 0, -4.5], [3.5, 0, -4.5],
      [-3.5, 0, -15.3], [3.5, 0, -15.3],
    ] as const

    for (const introScale of [1, 1.175, 1.35]) {
      const scale = gallerySupportGroupScale('between-columns', introScale)
      const localPositions = gallerySupportLocalPositions('between-columns', photoPosition, supports)
      const parent = new Group()
      parent.position.set(...photoPosition)
      parent.scale.setScalar(scale)
      const children = localPositions.map((position) => {
        const child = new Group()
        child.position.set(...position)
        parent.add(child)
        return child
      })
      parent.updateMatrixWorld(true)
      const worldPositions = children.map((child) => child.getWorldPosition(new Vector3()))

      expect(scale).toBe(1)
      expect(worldPositions[0]!.x).toBeCloseTo(-worldPositions[1]!.x)
      expect(worldPositions[0]!.z).toBeCloseTo(worldPositions[1]!.z)
      expect(worldPositions[2]!.x).toBeCloseTo(-worldPositions[3]!.x)
      expect(worldPositions[2]!.z).toBeCloseTo(worldPositions[3]!.z)
      expect(worldPositions.map(({ z }) => z)).toEqual([-4.5, -4.5, -15.3, -15.3])
    }
  })

  it('preserves the original A intro parent position and scale', () => {
    const photoPosition = [-2.1, 0.2, -1.4] as const
    const scale = gallerySupportGroupScale('on-columns', 1.35)
    const localPositions = gallerySupportLocalPositions('on-columns', photoPosition, [[-3.5, 0, -4.5]])

    expect(photoPosition).toEqual([-2.1, 0.2, -1.4])
    expect(scale).toBe(1.35)
    expect(localPositions).toEqual([[0, 0, 0]])
  })
})
