import type { LilyVisiblePortraitGeometryOptions } from './dissolve'
import type { LilySurfaceSource } from './particleSource'
import type { LilyPortraitCameraWorkerSettings } from './portraitIntegration'
import type { ParticlePortraitSettings } from '../../particle-portrait-lab/config'
import type { StarPortraitPoint } from './starPortraitTargets'

export interface LilyGeometryAttributePayload {
  array: Float32Array
  itemSize: number
}

export interface LilyGeometryWorkerSuccess {
  ok: true
  attributes: Record<string, LilyGeometryAttributePayload>
}

export interface LilyGeometryWorkerFailure {
  ok: false
  message: string
}

export type LilyGeometryWorkerResponse = LilyGeometryWorkerSuccess | LilyGeometryWorkerFailure

export type LilyGeometryWorkerPortraitOptions = Omit<LilyVisiblePortraitGeometryOptions, 'cameraBasisAtTime' | 'targets' | 'targetPositions'> & {
  width: number
  height: number
  appearanceSettings: Pick<ParticlePortraitSettings, 'scale' | 'offsetX' | 'offsetY'>
}

export interface LilyGeometryWorkerPayload {
  count: number
  source: Pick<LilySurfaceSource, 'center' | 'radius' | 'minY' | 'maxY'> & {
    positions: Float32Array
    parts: Float32Array
  }
  portrait: LilyGeometryWorkerPortraitOptions & {
    targetValues: Float32Array
    targetTypes: Uint8Array
  }
  cameraSettings: LilyPortraitCameraWorkerSettings
}

export interface LilySerializedPortraitTargets {
  values: Float32Array
  types: Uint8Array
}

export interface LilySampledParticleSource extends Pick<LilySurfaceSource, 'center' | 'radius' | 'minY' | 'maxY'> {
  positions: Float32Array
  parts: Float32Array
}

export interface LilyGeometryWorkerLike {
  onmessage: ((event: MessageEvent<LilyGeometryWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: LilyGeometryWorkerPayload, transfer?: Transferable[]): void
  terminate(): void
}

export interface LilyGeometryWorkerRequest {
  promise: Promise<LilyGeometryWorkerSuccess>
  cancel(): void
}

const PORTRAIT_TARGET_FLOATS = 11
const PORTRAIT_TARGET_TYPE_CODE: Record<NonNullable<StarPortraitPoint['type']>, number> = {
  fill: 0,
  contour: 1,
  flow: 2,
  support: 3,
}

/** Pack authored portrait points so postMessage transfers their buffers instead of cloning 32k objects. */
export async function serializeLilyPortraitTargets(
  targets: readonly StarPortraitPoint[],
  yieldToMain: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
  isCancelled: () => boolean = () => false,
): Promise<LilySerializedPortraitTargets> {
  const values = new Float32Array(targets.length * PORTRAIT_TARGET_FLOATS)
  const types = new Uint8Array(targets.length)
  const chunkSize = 2048
  for (let start = 0; start < targets.length; start += chunkSize) {
    if (isCancelled()) throw abortError()
    const end = Math.min(targets.length, start + chunkSize)
    for (let index = start; index < end; index += 1) {
      const target = targets[index]!
      const offset = index * PORTRAIT_TARGET_FLOATS
      values[offset] = target.u
      values[offset + 1] = target.v
      values[offset + 2] = target.tone
      values[offset + 3] = target.contrast
      values[offset + 4] = target.featureWeight
      values[offset + 5] = target.seed
      values[offset + 6] = target.photoColorLinear[0]
      values[offset + 7] = target.photoColorLinear[1]
      values[offset + 8] = target.photoColorLinear[2]
      values[offset + 9] = target.artSize ?? 1
      values[offset + 10] = target.artBrightness ?? 1
      types[index] = PORTRAIT_TARGET_TYPE_CODE[target.type ?? 'fill']
    }
    if (end < targets.length) await yieldToMain()
  }
  if (isCancelled()) throw abortError()
  return { values, types }
}

export async function sampleLilySurfaceForWorker(
  source: LilySurfaceSource,
  count: number,
  yieldToMain: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
  isCancelled: () => boolean = () => false,
): Promise<LilySampledParticleSource> {
  const positions = new Float32Array(count * 3)
  const parts = new Float32Array(count)
  const chunkSize = 2048
  for (let start = 0; start < count; start += chunkSize) {
    if (isCancelled()) throw abortError()
    const end = Math.min(count, start + chunkSize)
    for (let index = start; index < end; index += 1) {
      const sample = source.sampleSurface(index, count)
      positions.set(sample.position, index * 3)
      parts[index] = sample.part
    }
    if (end < count) await yieldToMain()
  }
  if (isCancelled()) throw abortError()
  return { center: source.center, radius: source.radius, minY: source.minY, maxY: source.maxY, positions, parts }
}

function abortError() {
  const error = new Error('Подготовка геометрии отменена')
  error.name = 'AbortError'
  return error
}

export function createLilyGeometryWorkerRequest(
  payload: LilyGeometryWorkerPayload,
  createWorker: () => LilyGeometryWorkerLike = () => new Worker(new URL('./lilyGeometry.worker.ts', import.meta.url), { type: 'module' }),
): LilyGeometryWorkerRequest {
  const worker = createWorker()
  let settled = false
  let rejectRequest: (error: Error) => void = () => undefined
  const cleanup = () => {
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
  }
  const promise = new Promise<LilyGeometryWorkerSuccess>((resolve, reject) => {
    rejectRequest = reject
    worker.onmessage = ({ data }) => {
      if (settled) return
      settled = true
      cleanup()
      if (data.ok) resolve(data)
      else reject(new Error(data.message))
    }
    worker.onerror = (event) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(event.message || 'Не удалось подготовить частицы сцены 04'))
    }
    try {
      worker.postMessage(payload, [
        payload.source.positions.buffer as ArrayBuffer,
        payload.source.parts.buffer as ArrayBuffer,
        payload.portrait.targetValues.buffer as ArrayBuffer,
        payload.portrait.targetTypes.buffer as ArrayBuffer,
      ])
    } catch (error) {
      settled = true
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })

  return {
    promise,
    cancel() {
      if (settled) return
      settled = true
      cleanup()
      rejectRequest(abortError())
    },
  }
}
