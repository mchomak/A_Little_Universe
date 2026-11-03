import { DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, type ParticleProfiles, type PortraitStructureSettings } from './particleProfiles'
import { sampleHybrid, type Stroke } from './hybridPortrait'
import { type StarPortraitSamplingSettings, type StarPortraitSource } from '../scenes/lily/starPortraitTargets'

type WorkerRequest =
  | { kind: 'initialize'; width: number; height: number; photoRgba: ArrayBuffer; matteRgba: ArrayBuffer }
  | { kind: 'sample'; id: number; importanceMask: ArrayBuffer; suppressionMask: ArrayBuffer; strokes: Stroke[]; profiles: ParticleProfiles; structure: PortraitStructureSettings; settings: StarPortraitSamplingSettings }

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
    const points = sampleHybrid(source, request.settings, new Uint8Array(request.importanceMask), new Uint8Array(request.suppressionMask), request.strokes, request.profiles, request.structure ?? DEFAULT_PORTRAIT_STRUCTURE_SETTINGS)
    self.postMessage({ kind: 'result', id: request.id, points })
  } catch (error) {
    self.postMessage({ kind: 'failure', id: request.id, error: error instanceof Error ? error.message : 'Не удалось пересчитать портрет.' })
  }
})
