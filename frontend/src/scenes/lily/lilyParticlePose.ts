import { Group, type Object3D } from 'three'

/** Keep the offline capture under the exact parent transform used by AnimatedLily. */
export const LILY_PARTICLE_MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
export const LILY_PARTICLE_MODEL_SCALE = 0.75
export const LILY_PARTICLE_POSE_REVISION = 'procedural-bloom-end-world-v1'

export function createLilyParticleModelWrapper(model: Object3D, rotation = 0) {
  const wrapper = new Group()
  wrapper.position.set(...LILY_PARTICLE_MODEL_POSITION)
  wrapper.scale.setScalar(LILY_PARTICLE_MODEL_SCALE)
  wrapper.rotation.y = rotation * Math.PI / 180
  wrapper.add(model)
  return wrapper
}

/** Stable identity for the asset, authored pose, and parent transform being sampled. */
export function getLilyParticleSourceSignature(bloomClipDuration: number, rotation = 0) {
  return JSON.stringify([
    LILY_PARTICLE_POSE_REVISION,
    LILY_PARTICLE_MODEL_POSITION,
    LILY_PARTICLE_MODEL_SCALE,
    rotation,
    Number.isFinite(bloomClipDuration) ? bloomClipDuration : 0,
  ])
}
