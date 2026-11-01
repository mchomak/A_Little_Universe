import { sampleStarPortraitTargets, type StarPortraitSamplingSettings, type StarPortraitSource } from '../scenes/lily/starPortraitTargets'

type WorkerRequest =
  | { kind: 'initialize'; width: number; height: number; photoRgba: ArrayBuffer; matteRgba: ArrayBuffer }
  | { kind: 'sample'; id: number; importanceMask: ArrayBuffer; settings: StarPortraitSamplingSettings }

let source: StarPortraitSource | null = null

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.kind === 'initialize') {
    source = {
      width: request.width,
      height: request.height,
      photoRgba: new Uint8ClampedArray(request.photoRgba),
      matteRgba: new Uint8ClampedArray(request.matteRgba),
    }
    self.postMessage({ kind: 'ready' })
    return
  }

  if (!source) {
    self.postMessage({ kind: 'failure', id: request.id, error: 'Источник портрета ещё не готов.' })
    return
  }

  try {
    const points = sampleStarPortraitTargets({ ...source, importanceMask: new Uint8Array(request.importanceMask) }, request.settings)
    self.postMessage({ kind: 'result', id: request.id, points })
  } catch (error) {
    self.postMessage({ kind: 'failure', id: request.id, error: error instanceof Error ? error.message : 'Не удалось пересчитать портрет.' })
  }
})
