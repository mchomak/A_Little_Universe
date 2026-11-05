import { expect, it } from 'vitest'
import { getIdentityCameraMoveTarget, getIdentityCameraPullbackPose } from './identityCamera'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'

it('moves back while gradually raising the focus point with the vortex', () => {
  const bloomEnd = { x: 0.27, y: 2.55, z: 2.3, tx: 0.27, ty: 1.25, tz: 0 }
  const target = getIdentityCameraMoveTarget(bloomEnd, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)

  expect(target).toMatchObject({ x: 0.27, z: 4.1, tx: 0.27, tz: 0 })
  expect(target.ty).toBeCloseTo(1.64, 8)
  expect(target.y).toBeCloseTo(3.2)
  const downwardAngle = Math.atan2(target.y - target.ty, target.z - target.tz) * 180 / Math.PI
  expect(downwardAngle).toBeGreaterThan(0)
  expect(downwardAngle).toBeLessThan(45)
})

it('continues the portrait dolly smoothly while preserving the face target', () => {
  const target = getIdentityCameraMoveTarget(
    { x: 0.27, y: 2.55, z: 2.3, tx: 0.27, ty: 1.25, tz: 0 },
    DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity,
  )
  const pulledBack = getIdentityCameraPullbackPose(target, 1.7)
  const beforeDistance = Math.hypot(target.x - target.tx, target.y - target.ty, target.z - target.tz)
  const afterDistance = Math.hypot(pulledBack.x - target.tx, pulledBack.y - target.ty, pulledBack.z - target.tz)

  expect(pulledBack.tx).toBe(target.tx)
  expect(pulledBack.ty).toBe(target.ty)
  expect(pulledBack.tz).toBe(target.tz)
  expect(afterDistance - beforeDistance).toBeCloseTo(1.7)
  expect(getIdentityCameraPullbackPose(target, Number.NaN)).toEqual(target)
})
