export type AudioCue = 'prologue-intro' | 'prologue-second' | 'prologue-touch' | 'growth'

export class AudioDirector {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private buffers = new Map<AudioCue, AudioBuffer>()
  private sources = new Set<AudioBufferSourceNode>()
  private speed = 1
  private disposed = false
  private unlocked = false
  private wantsPause = false
  error: string | null = null

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  /** Call synchronously from the deliberate start gesture; context creation is lazy. */
  async unlock(): Promise<boolean> {
    if (this.disposed) return false
    try {
      if (!this.context) {
        this.context = this.createContext()
        this.gain = this.context.createGain()
        this.gain.gain.value = 0.65
        this.gain.connect(this.context.destination)
      }
      const context = this.context
      await context.resume()
      if (this.disposed) return false
      this.unlocked = context.state === 'running'
      // A pause/visibility change can arrive while the gesture unlock is pending.
      // Reconcile the latest intent before resolving; unlock means availability, not playback.
      while (!this.disposed && this.unlocked && (
        (this.wantsPause && context.state === 'running') || (!this.wantsPause && context.state === 'suspended')
      )) {
        if (this.wantsPause) await context.suspend()
        else await context.resume()
      }
      return this.unlocked && !this.disposed
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Звук недоступен'
      this.unlocked = false
      return false
    }
  }

  setBuffer(cue: AudioCue, buffer: AudioBuffer): void {
    if (!this.disposed) this.buffers.set(cue, buffer)
  }

  /** No registered asset means genuine silence and a false result. No synthetic music. */
  cue(cue: AudioCue): boolean {
    const buffer = this.buffers.get(cue)
    if (this.disposed || !this.unlocked || this.wantsPause || !buffer || !this.context || !this.gain) return false
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = this.speed
    source.connect(this.gain)
    source.onended = () => { this.sources.delete(source); source.disconnect() }
    this.sources.add(source)
    try { source.start(); return true } catch (error) {
      source.onended = null
      this.sources.delete(source)
      source.disconnect()
      this.error = error instanceof Error ? error.message : 'Звук не запущен'
      return false
    }
  }

  pause(): void {
    this.wantsPause = true
    if (!this.disposed && this.unlocked && this.context?.state === 'running') {
      void this.context.suspend().then(() => {
        if (!this.disposed && !this.wantsPause) this.resume()
      }).catch((error: unknown) => { this.error = String(error) })
    }
  }

  resume(): void {
    this.wantsPause = false
    if (!this.disposed && this.unlocked && this.context?.state === 'suspended') {
      void this.context.resume().then(() => {
        if (!this.disposed && this.wantsPause) this.pause()
      }).catch((error: unknown) => { this.error = String(error) })
    }
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) return
    this.speed = speed
    for (const source of this.sources) source.playbackRate.value = speed
  }

  stop(): void {
    for (const source of this.sources) {
      source.onended = null
      source.stop()
      source.disconnect()
    }
    this.sources.clear()
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.unlocked = false
    this.stop()
    this.buffers.clear()
    this.gain?.disconnect()
    if (this.context && this.context.state !== 'closed') {
      try { await this.context.close() } catch (error) { this.error = String(error) }
    }
    this.context = null
    this.gain = null
  }
}
