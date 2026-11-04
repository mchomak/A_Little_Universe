import { expect, it } from 'vitest'
import { getIdentityCameraMoveTarget } from './identityCamera'
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
