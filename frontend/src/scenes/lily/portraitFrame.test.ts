import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTICLE_PORTRAIT_SETTINGS } from '../../particle-portrait-lab/config'
import { createPortraitCameraBasis } from './portraitTargets'
import { createLilyPortraitFrameGeometry } from './portraitFrame'

describe('scene 04 portrait frame', () => {
  it('registers its thin particle border around the portrait on the shared camera plane', () => {
    const basis = createPortraitCameraBasis({
      eye: [0.2, 2.6, 4.4], lookAt: [0.2, 1.6, 0], aspect: 16 / 9, fovDegrees: 38, planeDistance: 3.4,
    })
    const geometry = createLilyPortraitFrameGeometry(basis, 1, DEFAULT_PARTICLE_PORTRAIT_SETTINGS)
    const positions = geometry.getAttribute('position')
    const starts = geometry.getAttribute('aStartPosition')
    const delays = geometry.getAttribute('aAssemblyDelay')
    expect(positions.count).toBeGreaterThan(600)
    const rightCoordinates: number[] = []
    const upCoordinates: number[] = []

    for (let index = 0; index < positions.count; index += 1) {
      const delta = [
        positions.getX(index) - basis.center[0],
        positions.getY(index) - basis.center[1],
        positions.getZ(index) - basis.center[2],
      ]
      rightCoordinates.push(delta[0]! * basis.right[0] + delta[1]! * basis.right[1] + delta[2]! * basis.right[2])
      upCoordinates.push(delta[0]! * basis.up[0] + delta[1]! * basis.up[1] + delta[2]! * basis.up[2])
      const travel = Math.hypot(
        starts.getX(index) - positions.getX(index),
        starts.getY(index) - positions.getY(index),
        starts.getZ(index) - positions.getZ(index),
      )
      expect(travel).toBeGreaterThan(0.4)
      expect(delays.getX(index)).toBeGreaterThanOrEqual(0)
      expect(delays.getX(index)).toBeLessThan(1)
    }

    const spanX = Math.max(...rightCoordinates) - Math.min(...rightCoordinates)
    const spanY = Math.max(...upCoordinates) - Math.min(...upCoordinates)
    expect(spanX).toBeCloseTo(basis.visibleHeight * DEFAULT_PARTICLE_PORTRAIT_SETTINGS.scale + 0.15, 2)
    expect(spanY).toBeCloseTo(basis.visibleHeight * DEFAULT_PARTICLE_PORTRAIT_SETTINGS.scale + 0.15, 2)
    geometry.dispose()
  })
})
