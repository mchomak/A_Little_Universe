import { buildLilyGeometryFromWorkerPayload } from './lilyGeometryWorkerCore'
import type { LilyGeometryWorkerPayload, LilyGeometryWorkerResponse } from './lilyGeometryWorkerClient'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<LilyGeometryWorkerPayload>) => void) | null
  postMessage(message: LilyGeometryWorkerResponse, transfer?: Transferable[]): void
}

workerScope.onmessage = ({ data }) => {
  try {
    const geometry = buildLilyGeometryFromWorkerPayload(data)
    const attributes: Record<string, { array: Float32Array; itemSize: number }> = {}
    const transfer: Transferable[] = []
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const array = attribute.array as Float32Array
      attributes[name] = { array, itemSize: attribute.itemSize }
      transfer.push(array.buffer)
    }
    geometry.dispose()
    workerScope.postMessage({ ok: true, attributes }, transfer)
  } catch (error) {
    workerScope.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}
