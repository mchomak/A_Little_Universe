import * as THREE from 'three'

const BASE = '/__iris-assets/vasilisa/'
const NAMES = ['iris_cinematic_rgba.png', 'iris_authentic_rgba.png', 'iris_confidence.png', 'iris_particles.bin'] as const
const LAYOUT = ['x', 'y', 'z', 'r_linear', 'g_linear', 'b_linear', 'size']
type Manifest = { schemaVersion: number; sourceRun: string; textureSize: [number, number]; textureColorSpace: string; confidenceColorSpace: string; pupilRatio: number; particles: { count: number; format: string; strideBytes: number; layout: string[]; coordinates: string; colorSpace: string }; files: Record<string, string> }
export type IrisAssets = { cinematic: THREE.Texture; authentic: THREE.Texture; confidence: THREE.Texture; particles: Float32Array; count: number; pupilRatio: number; dispose(): void }

export function validateIrisManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid iris asset manifest')
  const m = value as Manifest
  if (m.schemaVersion !== 1 || m.sourceRun !== 'run_017_requirements_env' || !Array.isArray(m.textureSize) || m.textureSize.length !== 2 || !m.textureSize.every(n => Number.isInteger(n) && n > 0 && n <= 8192) || m.textureColorSpace !== 'sRGB-unpremultiplied-alpha' || m.confidenceColorSpace !== 'linear-data' || !Number.isFinite(m.pupilRatio) || m.pupilRatio <= 0 || m.pupilRatio >= 1 || !m.particles || !Number.isInteger(m.particles.count) || m.particles.count < 1 || m.particles.count > 2_000_000 || m.particles.format !== 'float32-le' || m.particles.strideBytes !== 28 || !Array.isArray(m.particles.layout) || JSON.stringify(m.particles.layout) !== JSON.stringify(LAYOUT) || m.particles.colorSpace !== 'linear-sRGB' || m.particles.coordinates !== 'iris radius 1; +x right, +y up, +z forward' || !m.files || NAMES.some(name => !/^[a-f0-9]{64}$/.test(m.files[name] ?? ''))) throw new Error('Incompatible iris asset manifest; republish run_017 assets')
  return m
}
async function getFile(name: string, hash: string): Promise<ArrayBuffer> {
  const response = await fetch(BASE + name)
  if (!response.ok) throw new Error(`Iris asset missing: ${name} (HTTP ${response.status})`)
  const bytes = await response.arrayBuffer()
  if (!globalThis.crypto?.subtle) throw new Error('Asset verification requires localhost or HTTPS')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (actual !== hash) throw new Error(`Iris asset checksum mismatch: ${name}`)
  return bytes
}
async function textureFrom(bytes: ArrayBuffer, size: [number, number], color: boolean): Promise<THREE.Texture> {
  const view = new DataView(bytes)
  if (bytes.byteLength < 24 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(16) !== size[0] || view.getUint32(20) !== size[1]) throw new Error('Iris PNG dimensions or signature are invalid')
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to decode iris texture')); image.src = url })
    const texture = new THREE.Texture(image)
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.needsUpdate = true
    return texture
  } finally { URL.revokeObjectURL(url) }
}
/** Owns textures; callers dispose on leaving the lab. */
export async function loadIrisAssets(): Promise<IrisAssets> {
  const response = await fetch(BASE + 'manifest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('run_017 assets are unavailable. Run python frontend/scripts/publish-iris-assets.py and reload.')
  const manifest = validateIrisManifest(await response.json())
  const files = await Promise.all(NAMES.map(name => getFile(name, manifest.files[name]!)))
  const binary = files[3]!
  if (binary.byteLength !== manifest.particles.count * 28) throw new Error('Iris particle buffer length does not match manifest')
  const data = new Float32Array(manifest.particles.count * 7)
  const view = new DataView(binary)
  for (let i = 0; i < data.length; i++) { const value = view.getFloat32(i * 4, true); if (!Number.isFinite(value)) throw new Error('Iris particle buffer contains non-finite values'); data[i] = value }
  const textures: THREE.Texture[] = []
  try {
    for (let i = 0; i < 3; i++) textures.push(await textureFrom(files[i]!, manifest.textureSize, i !== 2))
    return { cinematic: textures[0]!, authentic: textures[1]!, confidence: textures[2]!, particles: data, count: manifest.particles.count, pupilRatio: manifest.pupilRatio, dispose: () => textures.forEach(texture => texture.dispose()) }
  } catch (error) { textures.forEach(texture => texture.dispose()); throw error }
}

