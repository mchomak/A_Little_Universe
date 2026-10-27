import type { Group } from 'three'
import { TIMING } from '../../engine/filmConfig'
import { ramp, smooth } from './progress'

export function poseGrowingLily(group: Group | null, time: number, reducedMotion: boolean) {
  const growth = smooth(ramp(time, TIMING.growth.stem))
  poseLily(group, reducedMotion ? Number(time >= TIMING.growth.stem[0]) : growth, 0)
}

export function poseLily(group: Group | null, growth: number, opening: number) {
  if (!group) return
  group.visible = growth > 0.001
  group.scale.setScalar(Math.max(0.001, growth))
  // Keep the root at the same point while the flower grows upward.
  group.position.y = -1.45 * (1 - growth)
  for (let index = 0; index < 6; index++) {
    const petal = group.getObjectByName(`petal-${index}`)
    if (petal) petal.rotation.x = 0.12 + Math.max(0, Math.min(1, opening * 1.12 - (index % 2) * 0.12)) * 1.5
  }
}

