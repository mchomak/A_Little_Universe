import { AnimationMixer, LoopOnce, type LoopOnce as LoopOnceType, LoopRepeat, type Object3D, type AnimationClip } from 'three'

export class LilyAnimationPlayer {
  readonly mixer: AnimationMixer
  private readonly actions: Map<string, ReturnType<AnimationMixer['clipAction']>>
  private active: string | null = null
  private disposed = false

  constructor(private readonly root: Object3D, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(root)
    this.actions = new Map(clips.map((clip) => [clip.name, this.mixer.clipAction(clip)]))
  }

  play(name: string, loop: typeof LoopOnceType | typeof LoopRepeat, repetitions = 1): boolean {
    if (this.disposed) return false
    const action = this.actions.get(name)
    if (!action) return false
    if (this.active !== name) {
      this.mixer.stopAllAction()
      action.reset()
      action.enabled = true
      action.clampWhenFinished = loop === LoopOnce
      action.setLoop(loop, repetitions)
      action.play()
      this.active = name
    }
    return true
  }

  seek(time: number): void {
    if (!this.disposed && Number.isFinite(time)) this.mixer.setTime(Math.max(0, time))
  }

  stop(): void {
    if (this.disposed || !this.active) return
    this.mixer.stopAllAction()
    this.active = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.active = null
  }
}

export function attachLilyAnimationPlayer(
  ref: { current: LilyAnimationPlayer | null },
  root: Object3D,
  clips: AnimationClip[],
): () => void {
  const player = new LilyAnimationPlayer(root, clips)
  ref.current = player
  return () => {
    player.dispose()
    if (ref.current === player) ref.current = null
  }
}
