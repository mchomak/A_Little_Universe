import { describe, expect, it } from 'vitest'
import { createLilyGeometryWorkerRequest, sampleLilySurfaceForWorker, serializeLilyPortraitTargets, type LilyGeometryWorkerLike, type LilyGeometryWorkerPayload, type LilyGeometryWorkerResponse } from './lilyGeometryWorkerClient'

class FakeWorker implements LilyGeometryWorkerLike {
  onmessage: ((event: MessageEvent<LilyGeometryWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: LilyGeometryWorkerPayload | undefined
  transfer: Transferable[] | undefined
  terminated = false
  postMessage(message: LilyGeometryWorkerPayload, transfer?: Transferable[]) { this.posted = message; this.transfer = transfer }
  terminate() { this.terminated = true }
  send(data: LilyGeometryWorkerResponse) { this.onmessage?.({ data } as MessageEvent<LilyGeometryWorkerResponse>) }
}

const payload: LilyGeometryWorkerPayload = {
  count: 1,
  source: { center: [0, 0, 0], radius: 1, minY: -1, maxY: 1, positions: new Float32Array(3), parts: new Float32Array(1) },
  portrait: { targetValues: new Float32Array(0), targetTypes: new Uint8Array(0), width: 1, height: 1,
    appearanceSettings: { scale: 1, offsetX: 0, offsetY: 0 }, start: 0, duration: 1, dissolveDuration: 1, edgeWidth: 0.03,
    settings: { particleBrightness: 1, vortexRadius: 1, vortexExpansion: 1, swirlSpeed: 1, swirlAcceleration: 0, centerDissolveAt: 0.5 },
    capture: { portraitStartProgress: 0.3, portraitFraction: 0.2, portraitMinTurns: 1, portraitMaxTurns: 2, portraitSteering: 1, portraitBraking: 1, portraitSettledBrightness: 1, vortexSpeedMultiplier: 1 } },
  cameraSettings: { bloomSettings: { cameraTargetX: 0, cameraTargetY: 0, cameraFinalDistance: 5, cameraFinalHeight: 0 },
    identitySettings: { cameraPullback: 1, cameraRise: 1, cameraMoveDuration: 12 }, aspect: 1, reducedMotion: false },
}

describe('Lily geometry worker client', () => {
  it('packs portrait targets into transferable typed arrays without changing their authored fields', async () => {
    const targets = [
      { u: 0.1, v: 0.2, tone: 0.3, contrast: 0.4, featureWeight: 0.5, seed: 0.6, photoColorLinear: [0.7, 0.8, 0.9] as const, artSize: 1.1, artBrightness: 1.2, type: 'contour' as const },
      { u: 0.2, v: 0.3, tone: 0.4, contrast: 0.5, featureWeight: 0.6, seed: 0.7, photoColorLinear: [0.8, 0.9, 1] as const, artSize: 1.3, artBrightness: 1.4, type: 'support' as const },
    ]
    let yields = 0
    const packed = await serializeLilyPortraitTargets(targets, async () => { yields += 1 })

    expect(yields).toBe(0)
    expect(packed.values).toEqual(Float32Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.3, 1.4]))
    expect(Array.from(packed.types)).toEqual([1, 3])
  })

  it('yields and stops packing portrait targets after cancellation', async () => {
    let cancelled = false
    let packedTargets = 0
    const point = { get u() { packedTargets += 1; return 0 }, v: 0, tone: 0, contrast: 0, featureWeight: 0, seed: 0,
      photoColorLinear: [0, 0, 0] as const, type: 'fill' as const }
    const targets = Array.from({ length: 5000 }, () => point)
    const pending = serializeLilyPortraitTargets(targets, async () => { cancelled = true }, () => cancelled)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(packedTargets).toBe(2048)
  })

  it('yields between particle sampling chunks and preserves deterministic source samples', async () => {
    let yields = 0
    const sampled = await sampleLilySurfaceForWorker({ center: [1, 2, 3], radius: 4, minY: 0, maxY: 5,
      sampleSurface: (index) => ({ position: [index, index + 1, index + 2], part: index % 3 }), sample: () => [0, 0, 0] },
    5000, async () => { yields += 1 })

    expect(yields).toBe(2)
    expect(Array.from(sampled.positions.slice(6141, 6144))).toEqual([2047, 2048, 2049])
    expect(sampled.parts[4999]).toBe(4999 % 3)
    expect(sampled.center).toEqual([1, 2, 3])
  })

  it('stops sampling after cancellation at a yield boundary', async () => {
    let cancelled = false
    let samples = 0
    const pending = sampleLilySurfaceForWorker({ center: [0, 0, 0], radius: 1, minY: 0, maxY: 1,
      sampleSurface: (index) => { samples += 1; return { position: [index, 0, 0], part: 0 } }, sample: () => [0, 0, 0] },
    10000, async () => { cancelled = true }, () => cancelled)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(samples).toBe(2048)
  })

  it('terminates the worker after a result and transfers the sampled buffers', async () => {
    const worker = new FakeWorker()
    const request = createLilyGeometryWorkerRequest(payload, () => worker)
    const result = { ok: true as const, attributes: { position: { array: new Float32Array([1, 2, 3]), itemSize: 3 } } }
    worker.send(result)

    await expect(request.promise).resolves.toBe(result)
    expect(worker.terminated).toBe(true)
    expect(worker.transfer).toHaveLength(4)
    expect(worker.posted).toBe(payload)
  })

  it('terminates and ignores stale worker results after cancellation', async () => {
    const worker = new FakeWorker()
    const request = createLilyGeometryWorkerRequest(payload, () => worker)
    request.cancel()

    await expect(request.promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminated).toBe(true)
    expect(() => worker.send({ ok: true, attributes: {} })).not.toThrow()
  })

  it('surfaces worker failures and releases the worker', async () => {
    const worker = new FakeWorker()
    const request = createLilyGeometryWorkerRequest(payload, () => worker)
    worker.onerror?.({ message: 'worker failed' } as ErrorEvent)

    await expect(request.promise).rejects.toThrow('worker failed')
    expect(worker.terminated).toBe(true)
  })

  it('surfaces an unavailable Worker constructor to the scene failure handler', () => {
    expect(() => createLilyGeometryWorkerRequest(payload, () => { throw new Error('Worker is unavailable') }))
      .toThrow('Worker is unavailable')
  })
})
