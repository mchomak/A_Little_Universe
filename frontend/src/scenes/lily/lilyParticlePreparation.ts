import metadata from '../../assets/scene04-portrait-approved-v2.json'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { APPROVED_PORTRAIT_SETTINGS, loadApprovedPortrait } from './approvedPortrait'
import { createProceduralLily } from './procedural/plant'
import { createLilyGeometryParticleSourceAsync, type LilySurfaceSource } from './particleSource'
import { getLilyParticleSourceSignature, createLilyParticleModelWrapper } from './lilyParticlePose'
import { toLilyPortraitCaptureSettings } from './portraitIntegration'
import {
  createLilyGeometryWorkerRequest,
  sampleLilySurfaceForWorker,
  serializeLilyPortraitTargets,
  type LilyGeometryWorkerPortraitOptions,
  type LilyGeometryWorkerRequest,
  type LilyGeometryWorkerSuccess,
  type LilyGeometryWorkerPayload,
} from './lilyGeometryWorkerClient'

type IdentitySettings = SceneComposerConfig['scenes']['identity']
type BloomSettings = SceneComposerConfig['scenes']['bloom']

// Preserve the original animation limit independently of the shorter scene hold.
export const LILY_PORTRAIT_ANIMATION_LIMIT_SECONDS = 34

export interface LilyParticlePreparationInput {
  config: SceneComposerConfig
  width: number
  height: number
  reducedMotion: boolean
}

export function getLilyFilmSurfaceDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { width: 1, height: 1 }
  const root = document.querySelector('.universe')
  const bounds = root?.getBoundingClientRect()
  const width = bounds?.width || window.innerWidth || 1
  const totalHeight = bounds?.height || window.innerHeight || 1
  return { width, height: Math.max(1, totalHeight) }
}

export function subscribeLilyFilmSurfaceDimensions(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('resize', listener)
  window.visualViewport?.addEventListener('resize', listener)
  const root = typeof document === 'undefined' ? null : document.querySelector('.universe')
  const observer = typeof ResizeObserver === 'undefined' || !root ? null : new ResizeObserver(listener)
  if (root) observer?.observe(root)
  return () => {
    window.removeEventListener('resize', listener)
    window.visualViewport?.removeEventListener('resize', listener)
    observer?.disconnect()
  }
}

export interface LilyParticleGeometrySetup {
  key: string
  seedKey: string
  count: number
  cameraSettings: LilyGeometryWorkerPayload['cameraSettings']
  portrait: LilyGeometryWorkerPortraitOptions
}

type LilyParticleGeometrySetupInput = LilyParticlePreparationInput & (
  | { bloomClipDuration: number; sourceSignature?: never }
  | { sourceSignature: string; bloomClipDuration?: never }
)

export type LilyParticlePreparationSnapshot =
  | { status: 'idle' }
  | { status: 'preparing'; key: string }
  | { status: 'ready'; key: string }
  | { status: 'error'; key: string; error: string }

export interface LilyPreparedSurface {
  source: LilySurfaceSource
  bloomClipDuration: number
}

export interface LilyParticlePreparationRecord {
  seedKey: string
  key?: string
  status: 'preparing' | 'ready' | 'error'
  source?: LilySurfaceSource
  bloomClipDuration?: number
  geometry?: LilyGeometryWorkerSuccess
  error?: string
}

export interface LilyParticlePreparationDependencies {
  loadPortrait(): ReturnType<typeof loadApprovedPortrait>
  captureSource(isCancelled: () => boolean, rotation?: number): Promise<LilyPreparedSurface>
  getSourceSignature?(bloomClipDuration: number): string
  createWorker(payload: LilyGeometryWorkerPayload): LilyGeometryWorkerRequest
}

const GEOMETRY_CACHE_VERSION = 'scene04-worker-geometry-v2'
const APPROVED_PORTRAIT_SOURCE = metadata as { binarySha256: string; source: { width: number; height: number } }

function asFiniteDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function getWorkerSettings(identity: IdentitySettings, bloom: BloomSettings) {
  const particleSettings = {
    particleBrightness: identity.particleBrightness,
    vortexRadius: identity.vortexRadius,
    vortexExpansion: identity.vortexExpansion,
    swirlSpeed: identity.swirlSpeed,
    swirlAcceleration: identity.swirlAcceleration,
    centerDissolveAt: identity.centerDissolveAt,
    vortexSpeedMultiplier: identity.vortexSpeedMultiplier,
    portraitSteering: identity.portraitSteering,
    portraitBraking: identity.portraitBraking,
    portraitSettledBrightness: identity.portraitSettledBrightness,
  }
  const cameraSettings: LilyGeometryWorkerPayload['cameraSettings'] = {
    bloomSettings: {
      cameraTargetX: bloom.cameraTargetX,
      cameraTargetY: bloom.cameraTargetY,
      cameraFinalDistance: bloom.cameraFinalDistance,
      cameraFinalHeight: bloom.cameraFinalHeight,
    },
    identitySettings: {
      cameraPullback: identity.cameraPullback,
      cameraRise: identity.cameraRise,
      cameraMoveDuration: identity.cameraMoveDuration,
    },
    aspect: 1,
    reducedMotion: false,
  }
  const portraitStart = identity.portraitStartProgress * identity.dissolveDuration
  const portraitDuration = Math.min(identity.portraitDuration, Math.max(2, LILY_PORTRAIT_ANIMATION_LIMIT_SECONDS - portraitStart))
  const portrait: LilyGeometryWorkerPortraitOptions = {
    width: APPROVED_PORTRAIT_SOURCE.source.width,
    height: APPROVED_PORTRAIT_SOURCE.source.height,
    appearanceSettings: {
      scale: APPROVED_PORTRAIT_SETTINGS.scale,
      offsetX: APPROVED_PORTRAIT_SETTINGS.offsetX,
      offsetY: APPROVED_PORTRAIT_SETTINGS.offsetY,
    },
    start: portraitStart,
    duration: portraitDuration,
    dissolveDuration: identity.dissolveDuration,
    edgeWidth: identity.edgeWidth,
    settings: particleSettings,
    capture: toLilyPortraitCaptureSettings(identity),
  }
  return { cameraSettings, portrait }
}

/** A key for the exact settings that the worker consumes, before the surface is captured. */
export function createLilyParticlePreparationSeedKey(input: LilyParticlePreparationInput) {
  const width = asFiniteDimension(input.width)
  const height = asFiniteDimension(input.height)
  const { identity, bloom } = input.config.scenes
  const settings = getWorkerSettings(identity, bloom)
  const cameraSettings = { ...settings.cameraSettings, aspect: width / height, reducedMotion: input.reducedMotion }
  return JSON.stringify([
    GEOMETRY_CACHE_VERSION,
    getLilyParticleSourceSignature(1, input.config.scenes.growth.lilyRotation),
    APPROVED_PORTRAIT_SOURCE.binarySha256,
    width,
    height,
    cameraSettings,
    identity.particleCount,
    settings.portrait,
  ])
}

/** One canonical setup is shared by prewarm, scene cache lookup, and fallback worker builds. */
export function createLilyParticleGeometrySetup(
  input: LilyParticleGeometrySetupInput,
): LilyParticleGeometrySetup {
  const width = asFiniteDimension(input.width)
  const height = asFiniteDimension(input.height)
  const { identity, bloom } = input.config.scenes
  const settings = getWorkerSettings(identity, bloom)
  const cameraSettings: LilyGeometryWorkerPayload['cameraSettings'] = {
    ...settings.cameraSettings,
    aspect: width / height,
    reducedMotion: input.reducedMotion,
  }
  const seedKey = createLilyParticlePreparationSeedKey(input)
  const sourceSignature = input.sourceSignature ?? getLilyParticleSourceSignature(input.bloomClipDuration, input.config.scenes.growth.lilyRotation)
  const key = JSON.stringify([seedKey, sourceSignature])
  return { key, seedKey, count: identity.particleCount, cameraSettings, portrait: settings.portrait }
}

function abortError() {
  const error = new Error('Подготовка геометрии отменена')
  error.name = 'AbortError'
  return error
}

export async function captureLilySurfaceForPreparation(isCancelled: () => boolean, rotation = 0): Promise<LilyPreparedSurface> {
  if (isCancelled()) throw abortError()
  const plant = createProceduralLily({ textures: false })
  const wrapper = createLilyParticleModelWrapper(plant.object, rotation)
  try {
    plant.setPose(1, 1)
    const captured = await createLilyGeometryParticleSourceAsync(plant.object, { isCancelled, chunkSize: 4096 })
    return {
      source: { ...captured, signature: getLilyParticleSourceSignature(1, rotation) },
      bloomClipDuration: 1,
    }
  } finally {
    wrapper.clear()
    plant.dispose()
  }
}

const defaultDependencies: LilyParticlePreparationDependencies = {
  loadPortrait: loadApprovedPortrait,
  captureSource: captureLilySurfaceForPreparation,
  createWorker: (payload) => createLilyGeometryWorkerRequest(payload),
}

interface ActivePreparation {
  record: LilyParticlePreparationRecord
  promise: Promise<LilyParticlePreparationRecord>
  cancelled: boolean
  worker?: LilyGeometryWorkerRequest
}

/** Owns one current request so stale worker results cannot replace the active geometry. */
export class LilyParticlePreparationManager {
  private active: ActivePreparation | null = null
  private capturedSurface: LilyPreparedSurface | null = null
  private snapshot: LilyParticlePreparationSnapshot = { status: 'idle' }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly dependencies: LilyParticlePreparationDependencies = defaultDependencies) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = () => this.snapshot

  getForKey(key: string): LilyParticlePreparationRecord | undefined {
    return this.active?.record.key === key ? this.active.record : undefined
  }

  prepare(input: LilyParticlePreparationInput): Promise<LilyParticlePreparationRecord> {
    const seedKey = createLilyParticlePreparationSeedKey(input)
    if (this.active?.record.seedKey === seedKey && this.isRecordSourceCurrent(this.active.record, input.config.scenes.growth.lilyRotation)) return this.active.promise
    const reusableSurface = this.getReusableSurface(input.config.scenes.growth.lilyRotation)
    this.cancelActive(false)

    const record: LilyParticlePreparationRecord = { seedKey, status: 'preparing' }
    const active: ActivePreparation = { record, cancelled: false, promise: Promise.resolve(record) }
    this.active = active
    this.publish({ status: 'preparing', key: seedKey })
    active.promise = this.run(active, input, reusableSurface)
    return active.promise
  }

  retry(input: LilyParticlePreparationInput): Promise<LilyParticlePreparationRecord> {
    if (this.active?.record.seedKey === createLilyParticlePreparationSeedKey(input)) this.cancelActive(false)
    return this.prepare(input)
  }

  cancel() {
    // StrictMode replays mounted effects after Bootstrap has already prepared
    // the geometry; keep completed work reusable across that cleanup cycle.
    if (this.active?.record.status === 'ready') return
    this.cancelActive(true)
  }

  private async run(active: ActivePreparation, input: LilyParticlePreparationInput, reusableSurface: LilyPreparedSurface | null) {
    const isCancelled = () => active.cancelled || this.active !== active
    try {
      const [portrait, captured] = await Promise.all([
        this.dependencies.loadPortrait(),
        reusableSurface ? Promise.resolve(reusableSurface) : this.dependencies.captureSource(isCancelled, input.config.scenes.growth.lilyRotation),
      ])
      if (isCancelled()) throw abortError()

      const setup = createLilyParticleGeometrySetup({ ...input, bloomClipDuration: captured.bloomClipDuration })
      const posedSource = { ...captured.source, signature: this.getSourceSignature(captured.bloomClipDuration, input.config.scenes.growth.lilyRotation) }
      this.capturedSurface = { source: posedSource, bloomClipDuration: captured.bloomClipDuration }
      active.record.key = setup.key
      active.record.bloomClipDuration = captured.bloomClipDuration
      active.record.source = posedSource
      this.publish({ status: 'preparing', key: setup.key })

      const [source, targets] = await Promise.all([
        sampleLilySurfaceForWorker(active.record.source, setup.count, undefined, isCancelled),
        serializeLilyPortraitTargets(portrait.points, undefined, isCancelled),
      ])
      if (isCancelled()) throw abortError()
      const payload: LilyGeometryWorkerPayload = {
        count: setup.count,
        source,
        portrait: { ...setup.portrait, targetValues: targets.values, targetTypes: targets.types },
        cameraSettings: setup.cameraSettings,
      }
      active.worker = this.dependencies.createWorker(payload)
      const geometry = await active.worker.promise
      if (isCancelled()) throw abortError()

      active.record.geometry = geometry
      active.record.status = 'ready'
      this.publish({ status: 'ready', key: setup.key })
      return active.record
    } catch (reason) {
      if (isCancelled()) throw reason instanceof Error ? reason : abortError()
      const error = reason instanceof Error ? reason : new Error(String(reason))
      active.cancelled = true
      active.worker?.cancel()
      active.record.status = 'error'
      active.record.error = error.message
      this.publish({ status: 'error', key: active.record.key ?? active.record.seedKey, error: error.message })
      throw error
    }
  }

  private getSourceSignature(bloomClipDuration: number, rotation = 0) {
    return this.dependencies.getSourceSignature?.(bloomClipDuration) ?? getLilyParticleSourceSignature(bloomClipDuration, rotation)
  }

  private isRecordSourceCurrent(record: LilyParticlePreparationRecord, rotation: number) {
    return !record.source || record.bloomClipDuration === undefined
      || record.source.signature === this.getSourceSignature(record.bloomClipDuration, rotation)
  }

  private getReusableSurface(rotation: number): LilyPreparedSurface | null {
    const captured = this.capturedSurface
    if (!captured) return null
    if (captured.source.signature !== this.getSourceSignature(captured.bloomClipDuration, rotation)) {
      this.capturedSurface = null
      return null
    }
    return captured
  }

  private cancelActive(resetSnapshot: boolean) {
    const active = this.active
    if (active) {
      active.cancelled = true
      active.worker?.cancel()
      if (this.active === active) this.active = null
    }
    if (resetSnapshot) this.publish({ status: 'idle' })
  }

  private publish(snapshot: LilyParticlePreparationSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

/** Wait for the latest requested preparation and return the same keyed record scene 04 consumes. */
export async function prepareLilyParticleGeometryForStart(
  manager: LilyParticlePreparationManager,
  getInput: () => LilyParticlePreparationInput,
  isCurrent: () => boolean,
): Promise<LilyParticlePreparationRecord> {
  while (isCurrent()) {
    const input = getInput()
    const seedKey = createLilyParticlePreparationSeedKey(input)
    const snapshot = manager.getSnapshot()
    const failedRecord = snapshot.status === 'error' ? manager.getForKey(snapshot.key) : undefined
    const hasMatchingFailure = snapshot.status === 'error'
      && (snapshot.key === seedKey || failedRecord?.seedKey === seedKey)

    try {
      const record = await (hasMatchingFailure ? manager.retry(input) : manager.prepare(input))
      if (!isCurrent()) throw abortError()
      if (record.status === 'ready' && createLilyParticlePreparationSeedKey(getInput()) === seedKey) return record
    } catch (reason) {
      if (!isCurrent()) throw reason
      if (createLilyParticlePreparationSeedKey(getInput()) !== seedKey) continue
      if (reason instanceof Error && reason.name === 'AbortError') {
        const current = manager.getSnapshot()
        const activeRecord = current.status === 'preparing' ? manager.getForKey(current.key) : undefined
        if (current.status === 'preparing' && (current.key === seedKey || activeRecord?.seedKey === seedKey)) continue
      }
      throw reason
    }
  }

  throw abortError()
}

export const lilyParticlePreparation = new LilyParticlePreparationManager()
