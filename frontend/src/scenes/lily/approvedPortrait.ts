import portraitDataUrl from '../../assets/scene04-portrait-approved-v2.bin?url'
import metadata from '../../assets/scene04-portrait-approved-v2.json'
import { parseParticlePortraitSettings } from '../../particle-portrait-lab/config'
import type { StarPortraitPoint } from './starPortraitTargets'
import type { FilmRuntime } from '../../engine/runtime'

// Compact, little-endian float32 copy of the fields used by the runtime. The
// source hash and exact generator settings remain alongside the asset.
const HEADER_BYTES = 20
const RECORD_FLOATS = 12
const KINDS = ['fill', 'contour', 'flow', 'support'] as const

export const APPROVED_PORTRAIT_SETTINGS = parseParticlePortraitSettings(metadata.settings)

/** Extend only portrait appearance; the vortex shader and trajectory seed stay intact. */
export function applyApprovedPortraitAppearance(material: { vertexShader: string; fragmentShader: string }) {
  material.vertexShader = material.vertexShader.replace('attribute float aPart;', 'attribute float aArtSize; attribute float aArtBrightness; varying float vArtBrightness; attribute float aPart;')
    .replace('vSeed = aSeed; vPart = aPart;', 'vSeed = mix(aSeed, aPortraitSeedData.x, portraitMix); vPart = aPart;')
    .replace('pow(aSeed, 8.0)', 'pow(mix(aSeed, aPortraitSeedData.x, portraitMix), 8.0)')
    .replace('gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize);', 'vArtBrightness = mix(1.0, aArtBrightness, portraitMix); gl_PointSize = clamp(pointSize * mix(1.0, aArtSize, portraitMix), pointMinSize, pointMaxSize);')
  material.fragmentShader = material.fragmentShader.replace('uniform vec3 uPearl;', 'varying float vArtBrightness; uniform vec3 uPearl;')
    .replace('if (glow < 0.004) discard;', 'glow *= vArtBrightness; if (glow < 0.004) discard;')
}

export function decodeApprovedPortrait(buffer: ArrayBuffer): { width: number; height: number; points: StarPortraitPoint[] } {
  if (buffer.byteLength < HEADER_BYTES) throw new Error('Approved portrait asset is truncated')
  const data = new DataView(buffer)
  if (data.getUint32(0, false) !== 0x414c5550 || data.getUint32(4, true) !== 1) throw new Error('Unsupported approved portrait asset')
  const count = data.getUint32(8, true), width = data.getUint32(12, true), height = data.getUint32(16, true)
  if (count !== metadata.count || width !== metadata.source.width || height !== metadata.source.height
    || buffer.byteLength !== HEADER_BYTES + count * RECORD_FLOATS * 4) throw new Error('Approved portrait asset dimensions are invalid')
  const points = Array.from({ length: count }, (_, index): StarPortraitPoint => {
    const offset = HEADER_BYTES + index * RECORD_FLOATS * 4
    const values = Array.from({ length: RECORD_FLOATS }, (_unused, i) => data.getFloat32(offset + i * 4, true))
    if (values.some((value) => !Number.isFinite(value)) || values[0]! < 0 || values[0]! > 1 || values[1]! < 0 || values[1]! > 1
      || !Number.isInteger(values[11]) || !KINDS[values[11]!]) throw new Error('Approved portrait point is invalid')
    return { u: values[0]!, v: values[1]!, tone: values[2]!, contrast: values[3]!, featureWeight: values[4]!, seed: values[5]!,
      photoColorLinear: [values[6]!, values[7]!, values[8]!], artSize: values[9]!, artBrightness: values[10]!, type: KINDS[values[11]!]! }
  })
  return { width, height, points }
}

let pendingPortrait: Promise<ReturnType<typeof decodeApprovedPortrait>> | undefined
export function loadApprovedPortrait() {
  if (!pendingPortrait) pendingPortrait = fetch(portraitDataUrl).then((response) => {
    if (!response.ok) throw new Error(`Approved portrait asset returned HTTP ${response.status}`)
    return response.arrayBuffer()
  }).then(decodeApprovedPortrait).catch((error: unknown) => { pendingPortrait = undefined; throw error })
  return pendingPortrait
}

/** Keep the scene clock held until the caller has committed ready geometry. */
export function createApprovedPortraitGate(
  runtime: Pick<FilmRuntime, 'hold'>,
  onReady: (portrait: Awaited<ReturnType<typeof loadApprovedPortrait>>) => void,
  onError: (error: unknown) => void,
  load = loadApprovedPortrait,
) {
  const release = runtime.hold()
  let active = true, sequence = 0
  return {
    load() {
      const request = ++sequence
      void load().then((portrait) => { if (active && request === sequence) onReady(portrait) })
        .catch((error: unknown) => { if (active && request === sequence) onError(error) })
    },
    committed() { if (active) release() },
    dispose() { active = false; sequence++; release() },
  }
}
