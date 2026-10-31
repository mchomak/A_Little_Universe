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
    if (this.disposed || !Number.isFinite(time)) return
    // AnimationMixer.setTime rewinds the mixer clock to zero before applying an
    // absolute sample. A LoopOnce action that previously reached its endpoint is
    // paused, so the next seek otherwise restores its bound objects to the base
    // pose. Resetting just the active action makes every sample independent of
    // the direction and history of the film timeline.
    const action = this.active ? this.actions.get(this.active) : undefined
    if (action) action.reset().play()
    this.mixer.setTime(Math.max(0, time))
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
