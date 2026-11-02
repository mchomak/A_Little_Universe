import { describe, expect, it } from 'vitest'
import { defaults } from './config'
import { irisMaskHandles, moveIrisMaskHandle } from './irisMaskMath'

describe('photo iris mask editor', () => {
  it('positions the center and radius handles on a rotated ellipse', () => {
    const settings = { ...defaults.blueEye, irisCenterX: 0.4, irisCenterY: 0.5, irisRadiusX: 0.2, irisRadiusY: 0.1, irisRotation: Math.PI / 2 }
    const handles = irisMaskHandles(settings, 'iris')
    expect(handles['iris-center']).toEqual({ x: 0.4, y: 0.5 })
    expect(handles['iris-radius-x'].x).toBeCloseTo(0.4)
    expect(handles['iris-radius-x'].y).toBeCloseTo(0.7)
    expect(handles['iris-radius-y'].x).toBeCloseTo(0.3)
    expect(handles['iris-radius-y'].y).toBeCloseTo(0.5)
  })

  it('moves only the selected center or radius and clamps it to image bounds', () => {
    const moved = moveIrisMaskHandle(defaults.blueEye, 'iris-center', { x: -0.1, y: 1.2 })
    expect(moved.irisCenterX).toBe(0)
    expect(moved.irisCenterY).toBe(1)
    expect(moved.pupilCenterX).toBe(defaults.blueEye.pupilCenterX)

    const resized = moveIrisMaskHandle(defaults.blueEye, 'pupil-radius-x', { x: 1.2, y: defaults.blueEye.pupilCenterY })
    expect(resized.pupilRadiusX).toBe(0.5)
    expect(resized.pupilRadiusY).toBe(defaults.blueEye.pupilRadiusY)
  })

  it('projects pointer movement along rotated axes when resizing', () => {
    const settings = { ...defaults.blueEye, irisCenterX: 0.5, irisCenterY: 0.5, irisRotation: Math.PI / 2 }
    const resized = moveIrisMaskHandle(settings, 'iris-radius-x', { x: 0.5, y: 0.72 })
    expect(resized.irisRadiusX).toBeCloseTo(0.22)
  })

  it('uses photo-calibrated defaults with the pupil above the iris center', () => {
    expect(defaults.blueEye.irisCenterY).toBeGreaterThan(defaults.blueEye.pupilCenterY)
    expect(defaults.blueEye.irisRadiusX).toBeCloseTo(0.215)
    expect(defaults.blueEye.irisRadiusY).toBeCloseTo(0.16)
    expect(defaults.blueEye.pupilRadiusX / defaults.blueEye.irisRadiusX).toBeCloseTo(0.275)
    expect(defaults.blueEye.pupilRadiusX / defaults.blueEye.irisRadiusX).toBeCloseTo(defaults.blueEye.pupilRadiusY / defaults.blueEye.irisRadiusY)
  })
})
