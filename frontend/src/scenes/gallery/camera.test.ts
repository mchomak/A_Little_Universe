import { describe, expect, it } from 'vitest'
import { configureCameraFarPlane, focusCamera } from './camera'
import { galleryPhotoYaw, GALLERY_MEMORIES, memoryPosition } from './content'
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

  it('accepts a gallery-local focus distance while retaining the corridor pose at zero mix', () => {
    const target = [2, 0.5, -4] as const
    const yaw = -0.8
    const focused = focusCamera([0, 0, 6], target, 1, yaw, 9.25)

    expect(focused.x).toBeCloseTo(target[0] + Math.sin(yaw) * 9.25)
    expect(focused.z).toBeCloseTo(target[2] + Math.cos(yaw) * 9.25)
    expect(focused.distance).toBeCloseTo(Math.hypot(9.25, 0.12))
    expect(focusCamera([0, 0, 6], target, 0, yaw, 9.25)).toEqual({
      x: 0,
      y: 0,
      z: 6,
      distance: Math.hypot(2, 0.5, 10),
    })
  })

  it('keeps focus framing attached to the same exhibit as aisle width changes', () => {
    const memory = GALLERY_MEMORIES[0]!
    const narrowTarget = memoryPosition(memory, 6)
    const wideTarget = memoryPosition(memory, 10)
    const yaw = galleryPhotoYaw(memory)
    const narrow = focusCamera([0, 0, 6], narrowTarget, 1, yaw)
    const wide = focusCamera([0, 0, 6], wideTarget, 1, yaw)

    expect(wideTarget[0] - narrowTarget[0]).toBe(memory.side * 2)
    expect(wide.x - narrow.x).toBeCloseTo(memory.side * 2)
    expect(wide.z).toBeCloseTo(narrow.z)
    expect(wide.distance).toBeCloseTo(narrow.distance)
  })

  it('retargets a focused exhibit to its paired B position while the interaction index stays fixed', () => {
    const memory = GALLERY_MEMORIES[2]!
    const layout = { laneWidth: 8, offsetX: 0.25, offsetY: 0.1, offsetZ: -0.4 }
    const targetA = memoryPosition(memory, 7)
    const targetB = memoryPosition(memory, 7, 'between-columns', layout)
    const focusedA = focusCamera([0, 0, 6], targetA, 1, galleryPhotoYaw(memory))
    const focusedB = focusCamera([0, 0, 6], targetB, 1, galleryPhotoYaw(memory, 'between-columns'))

    expect(memory.order).toBe(2)
    expect(targetA).toEqual([-3.5, 0, -15.3])
    expect(targetB).toEqual([-4.25, 0.1, -22.21])
    expect(focusedA.z).not.toBeCloseTo(focusedB.z)
    expect(focusedB.x).toBeCloseTo(targetB[0] - memory.side * 4.8)
    expect(focusedB.z).toBeCloseTo(targetB[2])
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
