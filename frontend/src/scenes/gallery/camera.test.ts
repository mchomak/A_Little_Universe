import { describe, expect, it } from 'vitest'
import { configureCameraFarPlane, focusCamera } from './camera'
describe('focus dolly', () => {
  it('approaches the exhibit with bounded movement and returns exactly to the corridor pose', () => {
    const start = [0, 0, 6] as const, exhibit = [-3, 0, -10] as const
    const focused = focusCamera(start, exhibit, 1)
    expect(focused.distance).toBeCloseTo(4.8)
    expect(focused.x).toBeLessThan(0); expect(focused.z).toBeLessThan(6)
    expect(focusCamera(start, exhibit, 0)).toEqual({ x: 0, y: 0, z: 6, distance: Math.hypot(3, 16) })
    expect(focusCamera(start, [3, 0, -80], 1).distance).toBeGreaterThan(70)
  })

  it('settles in front of a turned wall photo when given its surface normal', () => {
    const yaw = 0.72
    const target = [-3, 0, -10] as const
    const focused = focusCamera([0, 0, 6], target, 1, yaw)
    expect(focused.x).toBeCloseTo(target[0] + Math.sin(yaw) * 4.8)
    expect(focused.z).toBeCloseTo(target[2] + Math.cos(yaw) * 4.8)
    expect(focused.distance).toBeCloseTo(Math.hypot(4.8, 0.12))
    expect(focusCamera([0, 0, 6], target, 0, yaw)).toEqual({ x: 0, y: 0, z: 6, distance: Math.hypot(3, 16) })
  })

  it('extends the shared camera far plane only for gallery entry and restores it on exit', () => {
    const updates: number[] = []
    const camera = { far: 100, updateProjectionMatrix: () => updates.push(camera.far) }
    const restore = configureCameraFarPlane(camera, 'gallery')

    expect(camera.far).toBe(220)
    expect(updates).toEqual([220])
    restore()
    expect(camera.far).toBe(100)
    expect(updates).toEqual([220, 100])

    const restoreOtherScene = configureCameraFarPlane(camera, 'eye')
    expect(camera.far).toBe(100)
    expect(updates).toEqual([220, 100])
    restoreOtherScene()
    expect(camera.far).toBe(100)
  })
})
