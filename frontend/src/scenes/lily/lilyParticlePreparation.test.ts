import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { createLilyParticleGeometrySetup, LilyParticlePreparationManager, prepareLilyParticleGeometryForStart, type LilyParticlePreparationDependencies } from './lilyParticlePreparation'
import type { LilySurfaceSource } from './particleSource'
import type { LilyGeometryWorkerRequest, LilyGeometryWorkerSuccess } from './lilyGeometryWorkerClient'

describe('lily particle preparation inputs', () => {
  it('changes the cache key when a worker camera or trajectory input changes', () => {
    const base = createLilyParticleGeometrySetup({
      config: DEFAULT_SCENE_COMPOSER_CONFIG,
      width: 1280,
      height: 636,
      reducedMotion: false,
      bloomClipDuration: 16,
    })
    const cameraConfig = {
      ...DEFAULT_SCENE_COMPOSER_CONFIG,
      scenes: {
        ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        bloom: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom, cameraTargetX: 0.4 },
      },
    }
    const trajectoryConfig = {
      ...DEFAULT_SCENE_COMPOSER_CONFIG,
      scenes: {
        ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, centerDissolveAt: 0.63 },
      },
    }

    expect(createLilyParticleGeometrySetup({ config: cameraConfig, width: 1280, height: 636, reducedMotion: false, bloomClipDuration: 16 }).key)
      .not.toBe(base.key)
    expect(createLilyParticleGeometrySetup({ config: trajectoryConfig, width: 1280, height: 636, reducedMotion: false, bloomClipDuration: 16 }).key)
      .not.toBe(base.key)
  })

  it('includes viewport, reduced-motion and Bloom endpoint inputs in the key', () => {
    const base = createLilyParticleGeometrySetup({ config: DEFAULT_SCENE_COMPOSER_CONFIG, width: 1280, height: 636, reducedMotion: false, bloomClipDuration: 16 })

    expect(createLilyParticleGeometrySetup({ config: DEFAULT_SCENE_COMPOSER_CONFIG, width: 1280, height: 637, reducedMotion: false, bloomClipDuration: 16 }).key).not.toBe(base.key)
    expect(createLilyParticleGeometrySetup({ config: DEFAULT_SCENE_COMPOSER_CONFIG, width: 1280, height: 636, reducedMotion: true, bloomClipDuration: 16 }).key).not.toBe(base.key)
    expect(createLilyParticleGeometrySetup({ config: DEFAULT_SCENE_COMPOSER_CONFIG, width: 1280, height: 636, reducedMotion: false, bloomClipDuration: 16.1 }).key).not.toBe(base.key)
  })

  it('deduplicates the same request and cancels an obsolete worker before accepting the current result', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const workers: Array<{ request: LilyGeometryWorkerRequest; cancelled: boolean; resolve(result: LilyGeometryWorkerSuccess): void }> = []
    const dependencies: LilyParticlePreparationDependencies = {
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource: async () => ({ source, bloomClipDuration: 16 }),
      createWorker: () => {
        let resolve!: (result: LilyGeometryWorkerSuccess) => void
        let reject!: (error: Error) => void
        let cancelled = false
        const promise = new Promise<LilyGeometryWorkerSuccess>((done, fail) => { resolve = done; reject = fail })
        const request = { promise, cancel: () => { cancelled = true; const error = new Error('cancelled'); error.name = 'AbortError'; reject(error) } }
        workers.push({ request, get cancelled() { return cancelled }, set cancelled(value: boolean) { cancelled = value }, resolve })
        return request
      },
    }
    const manager = new LilyParticlePreparationManager(dependencies)
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }
    const first = manager.prepare(input)
    expect(manager.prepare(input)).toBe(first)
    await vi.waitFor(() => expect(workers).toHaveLength(1))
    const stale = first.catch((reason: unknown) => reason)

    const nextInput = { ...input, width: 1281 }
    const current = manager.prepare(nextInput)
    await expect(stale).resolves.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(workers).toHaveLength(2))
    expect(workers[0]!.cancelled).toBe(true)

    const expected: LilyGeometryWorkerSuccess = { ok: true, attributes: {} }
    workers[1]!.resolve(expected)
    const record = await current
    const setup = createLilyParticleGeometrySetup({ ...nextInput, bloomClipDuration: 16 })
    expect(record.status).toBe('ready')
    expect(record.key).toBe(setup.key)
    expect(manager.getForKey(setup.key)?.geometry).toBe(expected)
  })

  it('keeps startup-prepared geometry ready when StrictMode cleanup cancels the mounted request', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const captureSource = vi.fn(async () => ({ source, bloomClipDuration: 16 }))
    const createWorker = vi.fn(() => ({ promise: Promise.resolve({ ok: true, attributes: {} }), cancel: vi.fn() }))
    const manager = new LilyParticlePreparationManager({
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource,
      createWorker,
    })
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    const startupRecord = await manager.prepare(input)
    await manager.prepare(input)
    manager.cancel()
    const mountedRecord = await manager.prepare(input)

    expect(manager.getSnapshot()).toMatchObject({ status: 'ready' })
    expect(mountedRecord).toBe(startupRecord)
    expect(captureSource).toHaveBeenCalledTimes(1)
    expect(createWorker).toHaveBeenCalledTimes(1)
  })

  it('ignores a cancelled worker that resolves after its replacement is ready', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const workers: Array<{
      resolve(result: LilyGeometryWorkerSuccess): void
      cancel: ReturnType<typeof vi.fn>
    }> = []
    const manager = new LilyParticlePreparationManager({
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource: async () => ({ source, bloomClipDuration: 16 }),
      createWorker: () => {
        let resolve!: (result: LilyGeometryWorkerSuccess) => void
        const promise = new Promise<LilyGeometryWorkerSuccess>((done) => { resolve = done })
        const cancel = vi.fn() // Simulate a worker that cannot stop its in-flight build.
        workers.push({ resolve, cancel })
        return { promise, cancel }
      },
    })
    const published: unknown[] = []
    manager.subscribe(() => published.push(manager.getSnapshot()))
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    const staleRequest = manager.prepare(input)
    const staleResult = staleRequest.catch((reason: unknown) => reason)
    await vi.waitFor(() => expect(workers).toHaveLength(1))

    const currentInput = { ...input, width: 1281 }
    const currentRequest = manager.prepare(currentInput)
    await vi.waitFor(() => expect(workers).toHaveLength(2))
    expect(workers[0]!.cancel).toHaveBeenCalledTimes(1)

    const currentGeometry: LilyGeometryWorkerSuccess = { ok: true, attributes: {} }
    workers[1]!.resolve(currentGeometry)
    const currentRecord = await currentRequest
    const currentSetup = createLilyParticleGeometrySetup({ ...currentInput, bloomClipDuration: 16 })
    const readySnapshot = manager.getSnapshot()
    const publishCount = published.length

    workers[0]!.resolve({ ok: true, attributes: { stale: { array: new Float32Array([1]), itemSize: 1 } } })
    await expect(staleResult).resolves.toMatchObject({ name: 'AbortError' })

    expect(currentRecord.geometry).toBe(currentGeometry)
    expect(manager.getSnapshot()).toBe(readySnapshot)
    expect(manager.getSnapshot()).toEqual({ status: 'ready', key: currentSetup.key })
    expect(manager.getForKey(currentSetup.key)?.geometry).toBe(currentGeometry)
    expect(published).toHaveLength(publishCount)
  })

  it('returns the prepared geometry under the full key scene 04 requests', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const expected: LilyGeometryWorkerSuccess = { ok: true, attributes: {} }
    const dependencies: LilyParticlePreparationDependencies = {
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource: async () => ({ source, bloomClipDuration: 16 }),
      createWorker: () => ({ promise: Promise.resolve(expected), cancel: vi.fn() }),
    }
    const manager = new LilyParticlePreparationManager(dependencies)
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    const prepared = await prepareLilyParticleGeometryForStart(manager, () => input, () => true)
    const sceneSetup = createLilyParticleGeometrySetup({ ...input, bloomClipDuration: 16 })

    expect(prepared.status).toBe('ready')
    expect(prepared.key).toBe(sceneSetup.key)
    expect(manager.getForKey(sceneSetup.key)).toBe(prepared)
    expect(manager.getForKey(sceneSetup.key)?.geometry).toBe(expected)
  })

  it('reuses the captured Bloom surface when particle settings change', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const captureSource = vi.fn(async () => ({ source, bloomClipDuration: 16 }))
    const workerPayloads: Parameters<LilyParticlePreparationDependencies['createWorker']>[0][] = []
    const dependencies: LilyParticlePreparationDependencies = {
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource,
      createWorker: (payload) => {
        workerPayloads.push(payload)
        return { promise: Promise.resolve({ ok: true, attributes: {} }), cancel: vi.fn() }
      },
    }
    const manager = new LilyParticlePreparationManager(dependencies)
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    const initial = await manager.prepare(input)
    const changedInput = {
      ...input,
      config: { ...input.config, scenes: { ...input.config.scenes,
        identity: { ...input.config.scenes.identity, dissolveDuration: 11 } } },
    }
    const recalculated = await manager.prepare(changedInput)

    expect(captureSource).toHaveBeenCalledTimes(1)
    expect(workerPayloads).toHaveLength(2)
    expect(workerPayloads[1]!.portrait.dissolveDuration).toBe(11)
    expect(recalculated.source?.sampleSurface).toBe(initial.source?.sampleSurface)
    expect(recalculated.status).toBe('ready')
  })

  it('recaptures when the source pose signature changes', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    let poseRevision = 'bloom-pose-v1'
    const captureSource = vi.fn(async () => ({ source, bloomClipDuration: 16 }))
    const manager = new LilyParticlePreparationManager({
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource,
      getSourceSignature: (duration) => `${poseRevision}:${duration}`,
      createWorker: () => ({ promise: Promise.resolve({ ok: true, attributes: {} }), cancel: vi.fn() }),
    })
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    const initial = await manager.prepare(input)
    poseRevision = 'bloom-pose-v2'
    const recaptured = await manager.prepare(input)

    expect(initial.key).toBe(recaptured.key)
    expect(captureSource).toHaveBeenCalledTimes(2)
    expect(recaptured.source?.signature).toBe('bloom-pose-v2:16')
    expect(recaptured.status).toBe('ready')
  })

  it('retries a failed preparation on the next start attempt', async () => {
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -1, maxY: 1,
      sampleSurface: () => ({ position: [0, 0, 0], part: 0 }),
      sample: () => [0, 0, 0],
    }
    const expected: LilyGeometryWorkerSuccess = { ok: true, attributes: {} }
    let attempts = 0
    const dependencies: LilyParticlePreparationDependencies = {
      loadPortrait: async () => ({ width: 1, height: 1, points: [] }),
      captureSource: async () => ({ source, bloomClipDuration: 16 }),
      createWorker: () => {
        attempts += 1
        return {
          promise: attempts === 1 ? Promise.reject(new Error('Worker unavailable')) : Promise.resolve(expected),
          cancel: vi.fn(),
        }
      },
    }
    const manager = new LilyParticlePreparationManager(dependencies)
    const input = {
      config: { ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
        identity: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity, particleCount: 2 } } },
      width: 1280, height: 636, reducedMotion: false,
    }

    await expect(prepareLilyParticleGeometryForStart(manager, () => input, () => true))
      .rejects.toThrow('Worker unavailable')
    const retried = await prepareLilyParticleGeometryForStart(manager, () => input, () => true)

    expect(attempts).toBe(2)
    expect(retried.status).toBe('ready')
    expect(retried.geometry).toBe(expected)
  })
})
