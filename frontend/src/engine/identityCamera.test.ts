import { expect, it } from 'vitest'
import { getIdentityCameraMoveTarget, getIdentityCameraPullbackPose } from './identityCamera'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'

it('moves back and upward while keeping the bloom focus point fixed', () => {
  const bloomEnd = { x: 0.27, y: 2.55, z: 2.3, tx: 0.27, ty: 1.25, tz: 0 }
  const target = getIdentityCameraMoveTarget(bloomEnd, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)

  expect(target).toMatchObject({ x: 0.27, z: 4.1, tx: 0.27, ty: 1.25, tz: 0 })
  expect(target.y).toBeCloseTo(3.2)
  const downwardAngle = Math.atan2(target.y - target.ty, target.z - target.tz) * 180 / Math.PI
  expect(downwardAngle).toBeGreaterThan(0)
  expect(downwardAngle).toBeLessThan(45)
})

it('continues the camera retreat without changing its viewing angle or focus target', () => {
  const base = { x: 0.27, y: 3.2, z: 4.1, tx: 0.27, ty: 1.25, tz: 0 }
  const pulledBack = getIdentityCameraPullbackPose(base, 1.7)
  const before = [base.x - base.tx, base.y - base.ty, base.z - base.tz]
  const after = [pulledBack.x - pulledBack.tx, pulledBack.y - pulledBack.ty, pulledBack.z - pulledBack.tz]
  const beforeLength = Math.hypot(...before)
  const afterLength = Math.hypot(...after)

  expect(afterLength - beforeLength).toBeCloseTo(1.7)
  expect(after.map((value) => value / afterLength)).toEqual(before.map((value) => value / beforeLength))
  expect(pulledBack).toMatchObject({ tx: base.tx, ty: base.ty, tz: base.tz })
  expect(getIdentityCameraPullbackPose(base, -10)).toEqual(base)
})
