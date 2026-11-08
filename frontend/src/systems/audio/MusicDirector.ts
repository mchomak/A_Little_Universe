import type { FilmState } from '../../engine/film'
import { MUSIC_CONFIG, type MusicGroup, type MusicTrackDefinition } from './musicCatalog'
import type { MusicChannel } from './AudioDirector'
import { getMusicSettings, normalizeMusicSettings, saveMusicSettings, type MusicSettings } from './musicSettings'

export type MusicPlaybackState = 'silent' | 'intro' | 'gallery' | 'outro' | 'ended'

export interface MusicDirectorSnapshot {
  state: MusicPlaybackState
  currentTrack: MusicTrackDefinition | null
  nextTrack: MusicTrackDefinition | null
  currentTime: number
  duration: number | null
  enabled: boolean
  paused: boolean
  error: string | null
}

export interface MusicScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
  now(): number
}

export interface MusicDirectorDependencies {
  createMusicChannel(element: HTMLMediaElement): MusicChannel | null
  setMusicVolume(value: number): void
  createMediaElement?: () => HTMLAudioElement
  scheduler?: MusicScheduler
  settings?: MusicSettings
}

interface MusicSlot {
  element: HTMLAudioElement
  channel: MusicChannel | null
  track: MusicTrackDefinition | null
  generation: number
  currentGain: number
  seekOffset: number
  failed: boolean
  listeners: Array<[string, EventListener]>
}

interface ActiveFade {
  id: number
  from: MusicSlot | null
  to: MusicSlot
  timer: unknown | null
  stage: 'fade-out' | 'silence' | 'fade-in'
  startedAt: number
  duration: number
  fadeInDuration: number
  silenceDuration: number
  fromGain: number
  toGain: number
}

type MusicListener = (snapshot: MusicDirectorSnapshot) => void

const browserScheduler: MusicScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => (typeof performance === 'undefined' ? Date.now() : performance.now()) / 1000,
}

function browserMediaElement(): HTMLAudioElement {
  if (typeof document === 'undefined') throw new Error('Audio playback requires a browser document')
  return document.createElement('audio')
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export class MusicDirector {
  private readonly createMusicChannel: MusicDirectorDependencies['createMusicChannel']
  private readonly setMasterVolume: MusicDirectorDependencies['setMusicVolume']
  private readonly createMediaElement: () => HTMLAudioElement
  private readonly scheduler: MusicScheduler
  private readonly listeners = new Set<MusicListener>()
  private readonly slots: MusicSlot[] = []
  private readonly failedTracks = new Set<string>()
  private settings: MusicSettings
  private playbackState: MusicPlaybackState = 'silent'
  private activeSlot: MusicSlot | null = null
  private fade: ActiveFade | null = null
  private fadeSerial = 0
  private disposed = false
  private paused = false
  private introFailed = false
  private introFinished = false
  private outroFailed = false
  private returningFromEnding = false
  private lastFilmState: FilmState | null = null
  private snapshot: MusicDirectorSnapshot

  constructor(dependencies: MusicDirectorDependencies) {
    this.createMusicChannel = dependencies.createMusicChannel
    this.setMasterVolume = dependencies.setMusicVolume
    this.createMediaElement = dependencies.createMediaElement ?? browserMediaElement
    this.scheduler = dependencies.scheduler ?? browserScheduler
    this.settings = dependencies.settings ? { ...dependencies.settings } : getMusicSettings()
    this.snapshot = {
      state: 'silent', currentTrack: null, nextTrack: null, currentTime: 0,
      duration: null, enabled: this.settings.enabled, paused: false, error: null,
    }
    this.setMasterVolume(this.settings.volume)
  }

  getSnapshot(): MusicDirectorSnapshot {
    return this.snapshot
  }

  subscribe(listener: MusicListener): () => void {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  syncFilmState(state: FilmState): void {
    if (this.disposed) return
    const previous = this.lastFilmState
    this.lastFilmState = state
    if (state.scene === 'gallery' && state.returnToEnding) this.returningFromEnding = true
    else if (state.scene === 'prologue' && state.mode === 'playing' && state.elapsed === 0) this.returningFromEnding = false
    else if (state.scene !== 'gallery' && state.scene !== 'ending') this.returningFromEnding = false

    if (state.paused || state.reading) this.pause()
    else if (this.paused && this.settings.enabled) this.resume()

    if (state.scene === 'prologue' && state.mode === 'ready') {
      this.publish()
      return
    }

    const group = this.sceneGroup(state.scene)
    if (!group || !this.settings.enabled || !this.ensureSlots()) {
      this.publish()
      return
    }

    if (group === 'intro') {
      const replayAtStart = state.scene === 'prologue' && state.elapsed === 0 && state.mode === 'playing'
        && previous !== null && previous.revision !== state.revision
      if (this.playbackState !== 'intro' || this.activeSlot?.track?.id !== MUSIC_CONFIG.intro.id || replayAtStart) {
        this.startIntro(replayAtStart)
      }
    } else if (group === 'gallery') {
      if (this.playbackState === 'intro' && this.activeSlot?.track?.id === MUSIC_CONFIG.intro.id) {
        this.startGalleryEntry()
      } else if (previous?.scene === 'gallery' && state.scene === 'gallery' && this.playbackState === 'silent') {
        // A failed gallery session stays silent until the next real gallery entry.
      } else if (this.playbackState !== 'gallery' || !this.activeSlot?.track || this.activeSlot.track.group !== 'gallery') {
        this.startGalleryEntry()
      }
    } else if (state.scene === 'ending' && this.returningFromEnding) {
      this.publish()
      return
    } else if (this.playbackState !== 'outro' && this.playbackState !== 'ended') {
      this.startOutro()
    }
    this.publish()
  }

  handleGalleryExit(returnToEnding: boolean): void {
    if (this.disposed) return
    if (returnToEnding) {
      this.returningFromEnding = true
      return
    }
    if (this.returningFromEnding || this.playbackState === 'outro' || this.playbackState === 'ended' || this.outroFailed) return
    if (!this.settings.enabled || !this.ensureSlots()) return
    this.startOutro()
  }

  setSettings(value: Partial<MusicSettings>): void {
    if (this.disposed) return
    this.settings = saveMusicSettings(normalizeMusicSettings({ ...this.settings, ...value }))
    this.setMasterVolume(this.settings.volume)
    if (!this.settings.enabled) {
      this.pause()
      this.cancelFade()
      for (const slot of this.slots) this.setSlotGain(slot, 0)
      this.publish()
    } else {
      for (const slot of this.slots) {
        if (slot.track && !this.fade) this.setSlotGain(slot, this.trackVolume(slot.track))
      }
      if (this.lastFilmState) this.syncFilmState(this.lastFilmState)
      else this.publish()
    }
  }

  previewNext(): boolean {
    if (this.disposed || !this.settings.enabled || this.playbackState !== 'gallery' || !this.activeSlot?.track) return false
    if (!this.ensureSlots()) return false
    return this.startNextGalleryTrack()
  }

  pause(): void {
    if (this.disposed || this.paused) return
    this.paused = true
    for (const slot of this.slots) slot.element.pause()
    this.publish()
  }

  resume(): void {
    if (this.disposed) return
    if (!this.settings.enabled) {
      this.publish()
      return
    }
    this.paused = false
    if (!this.activeSlot?.track) {
      this.publish()
      return
    }
    if (!this.fade) this.playSlot(this.activeSlot)
    else if (this.fade.stage === 'fade-out' && this.fade.from) this.playSlot(this.fade.from)
    else if (this.fade.stage === 'fade-in') this.playSlot(this.fade.to)
    this.publish()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.cancelFade()
    for (const slot of this.slots) {
      for (const [eventName, listener] of slot.listeners) slot.element.removeEventListener(eventName, listener)
      slot.element.pause()
      slot.element.removeAttribute('src')
      slot.element.load()
      slot.channel?.dispose()
      slot.channel = null
      slot.track = null
      slot.listeners = []
    }
    this.slots.length = 0
    this.activeSlot = null
    this.listeners.clear()
    this.playbackState = 'silent'
  }

  private sceneGroup(scene: FilmState['scene']): MusicGroup | null {
    if (scene === 'prologue' || scene === 'growth' || scene === 'bloom' || scene === 'identity') return 'intro'
    if (scene === 'gallery') return 'gallery'
    if (scene === 'cosmos' || scene === 'greeting' || scene === 'ending') return 'outro'
    return null
  }

  private ensureSlots(): boolean {
    if (this.slots.length === 0) {
      try {
        for (let index = 0; index < 2; index += 1) {
          const element = this.createMediaElement()
          const slot: MusicSlot = { element, channel: null, track: null, generation: 0, currentGain: 1, seekOffset: 0, failed: false, listeners: [] }
          this.slots.push(slot)
        }
      } catch (error) {
        this.setError(errorMessage(error, 'Не удалось создать музыкальный поток'))
        return false
      }
    }
    let ready = true
    for (const slot of this.slots) {
      if (slot.channel) continue
      try {
        slot.channel = this.createMusicChannel(slot.element)
      } catch (error) {
        this.setError(errorMessage(error, 'Музыкальный канал недоступен'))
        ready = false
      }
      if (!slot.channel) ready = false
    }
    return ready
  }

  private attachListeners(slot: MusicSlot): void {
    const generation = slot.generation
    const entries: Array<[string, EventListener]> = [
      ['timeupdate', () => { if (slot.generation === generation) this.onTimeUpdate(slot) }],
      ['loadedmetadata', () => { if (slot.generation === generation) this.applyPendingSeek(slot) }],
      ['ended', () => { if (slot.generation === generation) this.onEnded(slot) }],
      ['error', () => { if (slot.generation === generation) this.onMediaError(slot) }],
    ]
    for (const [eventName, listener] of entries) slot.element.addEventListener(eventName, listener)
    slot.listeners = entries
  }

  private loadTrack(slot: MusicSlot, track: MusicTrackDefinition, offset = track.startOffset): void {
    if (slot.track?.id === track.id && !slot.failed) {
      slot.seekOffset = offset
      this.applyPendingSeek(slot)
      return
    }
    slot.element.pause()
    this.detachListeners(slot)
    slot.generation += 1
    slot.failed = false
    slot.track = track
    slot.seekOffset = offset
    slot.element.loop = false
    slot.element.preload = 'auto'
    this.attachListeners(slot)
    slot.element.src = track.url
    try { slot.element.load() } catch (error) { this.handleSlotFailure(slot, error) }
    this.applyPendingSeek(slot)
    this.setSlotGain(slot, this.trackVolume(track))
  }

  private applyPendingSeek(slot: MusicSlot): void {
    if (!slot.track || slot.failed || slot.element.readyState < 1) return
    try { slot.element.currentTime = slot.seekOffset } catch { /* loadedmetadata will retry the requested offset. */ }
  }

  private startIntro(forceRestart = false): void {
    if ((this.introFailed || this.introFinished) && !forceRestart) return
    if (!this.ensureSlots()) return
    if (this.playbackState === 'intro' && this.activeSlot?.track?.id === MUSIC_CONFIG.intro.id && !forceRestart) return
    this.cancelFade()
    const current = this.activeSlot
    const from = current?.track && current.track.id !== MUSIC_CONFIG.intro.id ? current : null
    const slot = from ? this.otherSlot(from) : current ?? this.slots[0]!
    if (!from) this.stopSlot(this.otherSlot(slot))
    this.loadTrack(slot, MUSIC_CONFIG.intro, this.settings.introStartOffset)
    this.activeSlot = slot
    this.playbackState = 'intro'
    this.introFailed = false
    this.introFinished = false
    this.outroFailed = false
    this.returningFromEnding = false
    this.failedTracks.clear()
    if (from) this.beginFade(from, slot)
    else this.startFadeIn(slot, 'intro')
    const firstGalleryTrack = MUSIC_CONFIG.gallery[0]
    if (firstGalleryTrack && !from) this.prepareTrack(this.otherSlot(slot), firstGalleryTrack)
    this.publish()
  }

  private startGalleryEntry(): void {
    const from = this.activeSlot
    const next = MUSIC_CONFIG.gallery[0]
    if (!next) {
      if (from) this.stopSlot(from)
      this.activeSlot = null
      this.playbackState = 'silent'
      return
    }
    const to = from ? this.otherSlot(from) : this.slots[0]!
    this.cancelFade()
    this.failedTracks.clear()
    this.loadTrack(to, next, next.startOffset)
    if (from?.track) this.beginFade(from, to)
    else {
      if (from && from !== to) this.stopSlot(from)
      this.startFadeIn(to, 'gallery')
    }
    this.prepareNextGalleryTrack()
    this.publish()
  }

  private startNextGalleryTrack(immediate = false, fadeOutDurationOverride?: number): boolean {
    const current = this.activeSlot?.track
    if (!current || current.group !== 'gallery') return false
    const currentIndex = MUSIC_CONFIG.gallery.findIndex((track) => track.id === current.id)
    if (currentIndex < 0) return false
    const nextIndex = this.findAvailableGalleryIndex(currentIndex + 1)
    if (nextIndex < 0) {
      this.stopCurrentAsSilent()
      return false
    }
    const nextTrack = MUSIC_CONFIG.gallery[nextIndex]!
    const from = this.activeSlot!
    this.cancelFade()
    const to = this.otherSlot(from)
    if (to.track?.id !== nextTrack.id || to.failed) this.loadTrack(to, nextTrack, nextTrack.startOffset)
    this.activeSlot = to
    this.playbackState = 'gallery'
    this.beginFade(from, to, immediate ? 0 : fadeOutDurationOverride)
    this.prepareNextGalleryTrack()
    this.publish()
    return true
  }

  private startOutro(): void {
    if (this.outroFailed || this.playbackState === 'outro' || this.playbackState === 'ended') return
    if (!this.ensureSlots()) return
    const from = this.activeSlot
    const to = from ? this.otherSlot(from) : this.slots[0]!
    this.cancelFade()
    this.loadTrack(to, MUSIC_CONFIG.outro, this.settings.outroStartOffset)
    this.activeSlot = to
    this.playbackState = 'outro'
    if (from) this.beginFade(from, to)
    else this.startFadeIn(to, 'outro')
    this.stopSlot(this.otherSlot(to) === from ? null : this.otherSlot(to))
    this.publish()
  }

  private beginFade(
    from: MusicSlot,
    to: MusicSlot,
    fadeOutDurationOverride?: number,
  ): void {
    const fadeInDuration = this.settings.fadeInSeconds
    const fadeOutDuration = fadeOutDurationOverride ?? this.settings.fadeOutSeconds
    this.cancelSlotAutomation(from)
    this.cancelSlotAutomation(to)
    const now = this.audioTime(from)
    const outgoing = this.gainValue(from, this.trackVolume(from.track))
    const incoming = this.trackVolume(to.track)
    this.setAudioParam(from, outgoing, now)
    this.setAudioParam(to, 0, now)
    from.currentGain = outgoing
    to.currentGain = 0
    this.activeSlot = to
    this.playbackState = to.track?.group ?? 'silent'

    const transition: ActiveFade = {
      id: ++this.fadeSerial,
      from,
      to,
      timer: null,
      stage: 'fade-out',
      startedAt: now,
      duration: fadeOutDuration,
      fadeInDuration,
      silenceDuration: this.settings.silenceSeconds,
      fromGain: outgoing,
      toGain: incoming,
    }
    this.fade = transition

    if (from.failed || fadeOutDuration <= 0) {
      this.stopSlot(from)
      this.beginSilence(transition)
      return
    }

    try {
      from.channel?.gain.gain.setValueCurveAtTime(this.fadeCurve(outgoing, false), now, fadeOutDuration)
    } catch (error) {
      this.cancelSlotAutomation(from)
      this.setError(errorMessage(error, 'Could not schedule outgoing music fade'))
      this.stopSlot(from)
      this.beginSilence(transition)
      return
    }

    try {
      transition.timer = this.scheduler.setTimeout(() => this.beginSilence(transition), fadeOutDuration * 1000)
    } catch (error) {
      this.setError(errorMessage(error, 'Could not schedule music transition'))
      this.stopSlot(from)
      this.beginSilence(transition)
    }
  }

  private fadeCurve(gain: number, fadeIn: boolean): Float32Array {
    const points = 65
    const curve = new Float32Array(points)
    for (let index = 0; index < points; index += 1) {
      const progress = index / (points - 1)
      curve[index] = gain * (fadeIn ? Math.sin(progress * Math.PI / 2) : Math.cos(progress * Math.PI / 2))
    }
    return curve
  }

  private startFadeIn(slot: MusicSlot, nextState: MusicPlaybackState): void {
    const duration = this.settings.fadeInSeconds
    const now = this.audioTime(slot)
    this.setSlotGain(slot, 0)
    const transition: ActiveFade = {
      id: ++this.fadeSerial,
      from: null,
      to: slot,
      timer: null,
      stage: 'fade-in',
      startedAt: now,
      duration,
      fadeInDuration: duration,
      silenceDuration: 0,
      fromGain: 0,
      toGain: this.trackVolume(slot.track),
    }
    this.activeSlot = slot
    this.playbackState = nextState
    this.fade = transition
    this.beginFadeIn(transition)
  }

  private beginSilence(transition: ActiveFade): void {
    if (this.fade !== transition || this.disposed) return
    transition.timer = null
    if (transition.from) this.stopSlot(transition.from)
    this.cancelSlotAutomation(transition.to, 0)
    transition.stage = 'silence'
    transition.startedAt = this.scheduler.now()
    transition.duration = transition.silenceDuration
    if (transition.duration <= 0) {
      this.beginFadeIn(transition)
      return
    }
    try {
      transition.timer = this.scheduler.setTimeout(
        () => this.beginFadeIn(transition),
        transition.duration * 1000,
      )
    } catch (error) {
      this.setError(errorMessage(error, 'Could not schedule the pause between tracks'))
      this.beginFadeIn(transition)
    }
  }

  private beginFadeIn(transition: ActiveFade): void {
    if (this.fade !== transition || this.disposed) return
    transition.timer = null
    transition.stage = 'fade-in'
    transition.startedAt = this.audioTime(transition.to)
    transition.duration = transition.fadeInDuration
    this.cancelSlotAutomation(transition.to, 0)
    this.setAudioParam(transition.to, 0, transition.startedAt)

    if (transition.duration <= 0) {
      this.setSlotGain(transition.to, transition.toGain)
      this.playSlot(transition.to)
      this.finishFade(transition.id)
      return
    }

    try {
      transition.to.channel?.gain.gain.setValueCurveAtTime(
        this.fadeCurve(transition.toGain, true),
        transition.startedAt,
        transition.duration,
      )
    } catch (error) {
      this.cancelSlotAutomation(transition.to, 0)
      this.setError(errorMessage(error, 'Could not schedule incoming music fade'))
      this.setSlotGain(transition.to, transition.toGain)
      this.playSlot(transition.to)
      this.finishFade(transition.id)
      return
    }

    try {
      transition.timer = this.scheduler.setTimeout(
        () => this.finishFade(transition.id),
        transition.duration * 1000,
      )
    } catch (error) {
      this.setError(errorMessage(error, 'Could not finish music transition'))
      this.setSlotGain(transition.to, transition.toGain)
      this.finishFade(transition.id)
      return
    }
    this.playSlot(transition.to)
    this.publish()
  }

  private finishFade(id: number): void {
    const fade = this.fade
    if (!fade || fade.id !== id || this.disposed) return
    if (fade.timer !== null) this.scheduler.clearTimeout(fade.timer)
    this.fade = null
    this.setSlotGain(fade.to, this.trackVolume(fade.to.track))
    if (fade.from) this.stopSlot(fade.from)
    if (this.playbackState === 'gallery') this.prepareNextGalleryTrack()
    this.publish()
  }

  private cancelFade(): void {
    const fade = this.fade
    if (!fade) return
    if (fade.timer !== null) this.scheduler.clearTimeout(fade.timer)
    const clockSlot = fade.stage === 'fade-out' && fade.from ? fade.from : fade.to
    const now = this.audioTime(clockSlot)
    const progress = fade.duration > 0 ? Math.max(0, Math.min(1, (now - fade.startedAt) / fade.duration)) : 1
    const fromGain = fade.stage === 'fade-out' && fade.from ? fade.fromGain * Math.cos(progress * Math.PI / 2) : 0
    const toGain = fade.stage === 'fade-in' ? fade.toGain * Math.sin(progress * Math.PI / 2) : 0
    if (fade.from) this.cancelSlotAutomation(fade.from, fromGain)
    this.cancelSlotAutomation(fade.to, toGain)
    this.fade = null
    if (fade.to !== this.activeSlot) this.stopSlot(fade.to)
    if (fade.from && fade.from !== this.activeSlot) this.stopSlot(fade.from)
  }
  private prepareNextGalleryTrack(): void {
    if (this.fade) return
    const activeSlot = this.activeSlot
    const track = activeSlot?.track
    if (!track || track.group !== 'gallery' || this.playbackState !== 'gallery') return
    const index = MUSIC_CONFIG.gallery.findIndex((entry) => entry.id === track.id)
    const nextIndex = this.findAvailableGalleryIndex(index + 1)
    const spare = this.otherSlot(activeSlot)
    if (nextIndex < 0) {
      this.stopSlot(spare)
      return
    }
    const next = MUSIC_CONFIG.gallery[nextIndex]!
    if (spare.track?.id !== next.id || spare.failed) this.prepareTrack(spare, next)
  }

  private prepareTrack(slot: MusicSlot | null, track: MusicTrackDefinition): void {
    if (!slot) return
    if (slot.track?.id !== track.id || slot.failed) this.loadTrack(slot, track, track.startOffset)
    this.setSlotGain(slot, 0)
  }

  private findAvailableGalleryIndex(startIndex: number): number {
    for (let step = 0; step < MUSIC_CONFIG.gallery.length; step += 1) {
      const index = (startIndex + step) % MUSIC_CONFIG.gallery.length
      if (!this.failedTracks.has(MUSIC_CONFIG.gallery[index]!.id)) return index
    }
    return -1
  }

  private onTimeUpdate(slot: MusicSlot): void {
    if (this.disposed || slot !== this.activeSlot || this.paused || !slot.track) return
    if (this.fade) {
      this.publish()
      return
    }
    if (slot.track.group === 'gallery') {
      const duration = slot.element.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        this.publish()
        return
      }
      const index = MUSIC_CONFIG.gallery.findIndex((track) => track.id === slot.track?.id)
      const nextIndex = this.findAvailableGalleryIndex(index + 1)
      if (nextIndex >= 0) {
        const remaining = Math.max(0, duration - slot.element.currentTime)
        if (remaining <= this.settings.fadeOutSeconds + this.settings.silenceSeconds) {
          this.startNextGalleryTrack(false, Math.min(this.settings.fadeOutSeconds, remaining))
        }
      }
    }
    this.publish()
  }

  private onEnded(slot: MusicSlot): void {
    if (this.disposed || slot !== this.activeSlot || !slot.track) return
    if (slot.track.group === 'intro') {
      if (this.fade?.to === slot) this.cancelFade()
      this.stopSlot(slot)
      this.activeSlot = null
      this.playbackState = 'silent'
      this.introFinished = true
    } else if (slot.track.group === 'gallery') {
      this.startNextGalleryTrack(true)
    } else {
      slot.element.pause()
      this.playbackState = 'ended'
      this.stopSlot(this.otherSlot(slot))
    }
    this.publish()
  }

  private onMediaError(slot: MusicSlot): void {
    const mediaError = slot.element.error
    const detail = mediaError?.message || (mediaError ? `код ${mediaError.code}` : 'файл недоступен')
    this.handleSlotFailure(slot, new Error(`Не удалось воспроизвести ${slot.track?.title ?? 'музыку'}: ${detail}`))
  }

  private handleSlotFailure(slot: MusicSlot, error: unknown): void {
    if (!slot.track) return
    const failedTrack = slot.track
    if (this.fade?.from === slot && this.fade.to !== slot) {
      this.setError(errorMessage(error, `Не удалось воспроизвести ${failedTrack.title}`))
      this.stopSlot(slot)
      this.publish()
      return
    }
    if (this.fade?.to === slot) this.cancelFade()
    slot.failed = true
    this.failedTracks.add(failedTrack.id)
    const message = errorMessage(error, `Не удалось воспроизвести ${failedTrack.title}`)
    this.setError(message)
    if (slot === this.activeSlot) {
      if (failedTrack.group === 'gallery') {
        const currentIndex = MUSIC_CONFIG.gallery.findIndex((track) => track.id === failedTrack.id)
        const nextIndex = this.findAvailableGalleryIndex(currentIndex + 1)
        if (nextIndex >= 0) {
          const replacement = MUSIC_CONFIG.gallery[nextIndex]!
          const to = this.otherSlot(slot)
          this.loadTrack(to, replacement, replacement.startOffset)
          this.playbackState = 'gallery'
          this.beginFade(slot, to, 0)
          this.prepareNextGalleryTrack()
        } else this.stopCurrentAsSilent()
      } else {
        if (failedTrack.group === 'intro') this.introFailed = true
        if (failedTrack.group === 'outro') this.outroFailed = true
        this.stopSlot(slot)
        this.activeSlot = null
        this.playbackState = 'silent'
      }
    } else if (this.playbackState === 'gallery') {
      this.prepareNextGalleryTrack()
    }
    this.publish()
  }

  private stopCurrentAsSilent(): void {
    this.cancelFade()
    this.stopSlot(this.activeSlot)
    this.activeSlot = null
    this.playbackState = 'silent'
  }

  private playSlot(slot: MusicSlot): void {
    if (this.paused || !this.settings.enabled || !slot.track || slot.failed) return
    const generation = slot.generation
    try {
      const result = slot.element.play()
      void Promise.resolve(result).catch((error: unknown) => {
        if (!this.disposed && slot.generation === generation
          && (slot === this.activeSlot || this.fade?.from === slot || this.fade?.to === slot)) this.handleSlotFailure(slot, error)
      })
    } catch (error) {
      this.handleSlotFailure(slot, error)
    }
  }

  private stopSlot(slot: MusicSlot | null): void {
    if (!slot) return
    this.detachListeners(slot)
    slot.generation += 1
    slot.element.pause()
    try { slot.element.currentTime = 0 } catch { /* Metadata may not be ready. */ }
    slot.track = null
    slot.failed = false
    slot.seekOffset = 0
    slot.element.removeAttribute('src')
    try { slot.element.load() } catch { /* Releasing an optional media source must not interrupt the film. */ }
    this.setSlotGain(slot, 0)
  }

  private detachListeners(slot: MusicSlot): void {
    for (const [eventName, listener] of slot.listeners) slot.element.removeEventListener(eventName, listener)
    slot.listeners = []
  }

  private otherSlot(slot: MusicSlot): MusicSlot
  private otherSlot(slot: null): MusicSlot | null
  private otherSlot(slot: MusicSlot | null): MusicSlot | null {
    if (!slot) return this.slots[0] ?? null
    const other = this.slots.find((candidate) => candidate !== slot)
    if (!other) throw new Error('MusicDirector requires two media slots')
    return other
  }

  private trackVolume(track: MusicTrackDefinition | null): number {
    if (!track) return 0
    const groupGain = MUSIC_CONFIG.groupGains[track.group] * this.settings[`${track.group}Gain`]
    return track.gain * groupGain
  }

  private upcomingTrack(track: MusicTrackDefinition | null): MusicTrackDefinition | null {
    if (!track || track.group === 'outro') return null
    const currentIndex = track.group === 'intro'
      ? -1
      : MUSIC_CONFIG.gallery.findIndex((candidate) => candidate.id === track.id)
    const nextIndex = this.findAvailableGalleryIndex(currentIndex + 1)
    return nextIndex >= 0 ? MUSIC_CONFIG.gallery[nextIndex] ?? null : null
  }

  private setSlotGain(slot: MusicSlot, value: number): void {
    const parameter = slot.channel?.gain.gain
    const target = Math.max(0, value)
    if (!parameter) {
      slot.currentGain = target
      return
    }
    const now = this.audioTime(slot)
    this.cancelSlotAutomation(slot)
    try {
      parameter.setValueAtTime(target, now)
    } catch {
      parameter.value = target
    }
    slot.currentGain = target
  }

  private setAudioParam(slot: MusicSlot, value: number, now: number): void {
    const parameter = slot.channel?.gain.gain
    const boundedValue = Math.max(0, value)
    if (!parameter) {
      slot.currentGain = boundedValue
      return
    }
    try { parameter.setValueAtTime(boundedValue, now) } catch { parameter.value = boundedValue }
    slot.currentGain = boundedValue
  }

  private gainValue(slot: MusicSlot, fallback: number): number {
    return Number.isFinite(slot.currentGain) ? Math.max(0, slot.currentGain) : fallback
  }

  private audioTime(slot: MusicSlot): number {
    const value = slot.channel?.gain.context.currentTime
    return typeof value === 'number' && Number.isFinite(value) ? value : this.scheduler.now()
  }

  private cancelSlotAutomation(slot: MusicSlot, holdValue = this.gainValue(slot, 0)): void {
    const parameter = slot.channel?.gain.gain
    if (!parameter) {
      slot.currentGain = holdValue
      return
    }
    const now = this.audioTime(slot)
    const hold = (parameter as AudioParam & { cancelAndHoldAtTime?: (time: number) => void }).cancelAndHoldAtTime
    if (hold) {
      try { hold.call(parameter, now); slot.currentGain = holdValue; return } catch { /* Use the older AudioParam cancellation API below. */ }
    }
    try {
      parameter.cancelScheduledValues(now)
      parameter.setValueAtTime(holdValue, now)
    } catch { parameter.value = holdValue }
    slot.currentGain = holdValue
  }

  private setError(error: string): void {
    this.snapshot = { ...this.snapshot, error }
  }

  private publish(): void {
    if (this.disposed) return
    const current = this.activeSlot
    const element = current?.element
    const currentTrack = current?.track ?? null
    this.snapshot = {
      state: this.playbackState,
      currentTrack,
      nextTrack: this.upcomingTrack(currentTrack),
      currentTime: element && Number.isFinite(element.currentTime) ? element.currentTime : 0,
      duration: element && Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null,
      enabled: this.settings.enabled,
      paused: this.paused,
      error: this.snapshot.error,
    }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}
