import { Group, LoopOnce, type AnimationClip, type Object3D } from 'three'
import { LILY_MODEL_URL } from '../../assets/lily/lilyAsset'
import type { LilyAnimationPlayer } from './animationPlayer'

/** Keep the offline capture under the exact parent transform used by AnimatedLily. */
export const LILY_PARTICLE_MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
export const LILY_PARTICLE_MODEL_SCALE = 3
export const LILY_PARTICLE_POSE_REVISION = 'bloom-end-world-v1'

export function createLilyParticleModelWrapper(model: Object3D) {
  const wrapper = new Group()
  wrapper.position.set(...LILY_PARTICLE_MODEL_POSITION)
  wrapper.scale.setScalar(LILY_PARTICLE_MODEL_SCALE)
  wrapper.add(model)
  return wrapper
}

/** Use the same Bloom clip endpoint that AnimatedLily holds during scene 04. */
export function seekLilyBloomEndpoint(player: Pick<LilyAnimationPlayer, 'play' | 'seek'>, clip: AnimationClip) {
  if (!player.play('Bloom', LoopOnce, 1)) throw new Error('Bloom animation is unavailable for the lily surface capture.')
  player.seek(clip.duration)
}

/** Stable identity for the asset, authored pose, and parent transform being sampled. */
export function getLilyParticleSourceSignature(bloomClipDuration: number) {
  return JSON.stringify([
    LILY_MODEL_URL,
    LILY_PARTICLE_POSE_REVISION,
    LILY_PARTICLE_MODEL_POSITION,
    LILY_PARTICLE_MODEL_SCALE,
    Number.isFinite(bloomClipDuration) ? bloomClipDuration : 0,
  ])
}
