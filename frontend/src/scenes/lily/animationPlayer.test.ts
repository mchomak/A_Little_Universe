import { AnimationClip, AnimationMixer, Group, LoopOnce, LoopRepeat, VectorKeyframeTrack } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { attachLilyAnimationPlayer, LilyAnimationPlayer } from './animationPlayer'

afterEach(() => vi.restoreAllMocks())

it('seeks Growth, switches to Bloom at a matching pose, and loops IdleClosed', () => {
  const root = new Group()
  const lily = new Group()
  lily.name = 'Lily'
  root.add(lily)
  const clips = [
    new AnimationClip('Growth', 9, [new VectorKeyframeTrack('Lily.position', [0, 9], [0, 0, 0, 1, 0, 0])]),
    new AnimationClip('Bloom', 16, [new VectorKeyframeTrack('Lily.position', [0, 16], [1, 0, 0, 3, 0, 0])]),
    new AnimationClip('IdleClosed', 2, [new VectorKeyframeTrack('Lily.position', [0, 2], [0, 0, 0, 1, 0, 0])]),
  ]
  const player = new LilyAnimationPlayer(root, clips)

  expect(player.play('Growth', LoopOnce)).toBe(true)
  player.seek(9)
  expect(lily.position.x).toBeCloseTo(1)
  expect(player.play('Bloom', LoopOnce)).toBe(true)
  player.seek(0)
  expect(lily.position.x).toBeCloseTo(1)
  player.seek(8)
  expect(lily.position.x).toBeCloseTo(2)
  expect(player.play('IdleClosed', LoopRepeat, Infinity)).toBe(true)
  player.seek(2.5)
  expect(lily.position.x).toBeCloseTo(0.25)
  player.dispose()
})

it('uncaches only on disposal and ignores further seeks afterward', () => {
  const root = new Group()
  const lily = new Group()
  lily.name = 'Lily'
  root.add(lily)
  const clip = new AnimationClip('Growth', 1, [new VectorKeyframeTrack('Lily.position', [0, 1], [0, 0, 0, 1, 0, 0])])
  const player = new LilyAnimationPlayer(root, [clip])
  const uncache = vi.spyOn(AnimationMixer.prototype, 'uncacheRoot')

  player.play('Growth', LoopOnce)
  player.seek(0.5)
  expect(lily.position.x).toBeCloseTo(0.5)
  expect(uncache).not.toHaveBeenCalled()
  player.dispose()
  const positionAfterDispose = lily.position.x
  player.seek(0)
  expect(uncache).toHaveBeenCalledOnce()
  expect(uncache).toHaveBeenCalledWith(root)
  expect(lily.position.x).toBe(positionAfterDispose)
  expect(player.play('Growth', LoopOnce)).toBe(false)
})

it('creates a live player again for the StrictMode setup-cleanup-setup cycle', () => {
  const root = new Group()
  const lily = new Group()
  lily.name = 'Lily'
  root.add(lily)
  const clip = new AnimationClip('Growth', 1, [new VectorKeyframeTrack('Lily.position', [0, 1], [0, 0, 0, 1, 0, 0])])
  const ref: { current: LilyAnimationPlayer | null } = { current: null }

  const cleanupFirst = attachLilyAnimationPlayer(ref, root, [clip])
  const firstPlayer = ref.current
  cleanupFirst()
  const cleanupSecond = attachLilyAnimationPlayer(ref, root, [clip])
  const replayedPlayer = ref.current

  expect(replayedPlayer).not.toBe(firstPlayer)
  expect(replayedPlayer?.play('Growth', LoopOnce)).toBe(true)
  replayedPlayer?.seek(0.5)
  expect(lily.position.x).toBeCloseTo(0.5)
  cleanupSecond()
  expect(ref.current).toBeNull()
})
