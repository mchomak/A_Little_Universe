export type AudioCue = 'prologue-intro' | 'prologue-first' | 'prologue-second' | 'prologue-dissolve' | 'prologue-touch' | 'growth'

export type MusicChannel = { gain: GainNode; dispose(): void }

export class AudioDirector {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private musicMaster: GainNode | null = null
  private musicVolume = 1
  private musicSources = new Map<HTMLMediaElement, MediaElementAudioSourceNode>()
  private musicChannels = new Map<HTMLMediaElement, MusicChannel>()
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

  /** The music master stays separate from the cue bus, but shares its AudioContext. */
  setMusicVolume(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) return
    this.musicVolume = value
    if (this.musicMaster) this.musicMaster.gain.value = value
  }

  /**
   * Route an HTML media element through its own channel and the shared music master.
   * The context is created only by unlock(), so callers retry after the start gesture.
   */
  createMusicChannel(element: HTMLMediaElement): MusicChannel | null {
    if (this.disposed || !this.unlocked || !this.context) return null
    const existing = this.musicChannels.get(element)
    if (existing) return existing

    let source = this.musicSources.get(element)
    try {
      if (!source) {
        source = this.context.createMediaElementSource(element)
        this.musicSources.set(element, source)
      }
      if (!this.musicMaster) {
        this.musicMaster = this.context.createGain()
        this.musicMaster.gain.value = this.musicVolume
        this.musicMaster.connect(this.context.destination)
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Музыкальный канал недоступен'
      return null
    }

    const channelGain = this.context.createGain()
    channelGain.gain.value = 1
    let sourceConnected = false
    try {
      source.connect(channelGain)
      sourceConnected = true
      channelGain.connect(this.musicMaster)
    } catch (error) {
      if (sourceConnected) {
        try { source.disconnect(channelGain) } catch (disconnectError) { this.error = String(disconnectError) }
      }
      channelGain.disconnect()
      this.error = error instanceof Error ? error.message : 'Музыкальный канал недоступен'
      return null
    }

    let disposed = false
    const channel: MusicChannel = {
      gain: channelGain,
      dispose: () => {
        if (disposed) return
        disposed = true
        source.disconnect(channelGain)
        channelGain.disconnect()
        if (this.musicChannels.get(element) === channel) this.musicChannels.delete(element)
      },
    }
    this.musicChannels.set(element, channel)
    return channel
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
    for (const channel of this.musicChannels.values()) channel.dispose()
    this.musicChannels.clear()
    for (const source of this.musicSources.values()) source.disconnect()
    this.musicSources.clear()
    this.gain?.disconnect()
    this.musicMaster?.disconnect()
    if (this.context && this.context.state !== 'closed') {
      try { await this.context.close() } catch (error) { this.error = String(error) }
    }
    this.context = null
    this.gain = null
    this.musicMaster = null
  }
}
