import { describe, expect, it } from 'vitest'
import { validateIrisManifest } from './assets'
const valid = () => ({ schemaVersion: 1, sourceRun: 'run_017_requirements_env', textureSize: [1024, 1024], textureColorSpace: 'sRGB-unpremultiplied-alpha', confidenceColorSpace: 'linear-data', pupilRatio: 0.175, particles: { count: 80000, format: 'float32-le', strideBytes: 28, layout: ['x', 'y', 'z', 'r_linear', 'g_linear', 'b_linear', 'size'], coordinates: 'iris radius 1; +x right, +y up, +z forward', colorSpace: 'linear-sRGB' }, files: Object.fromEntries(['iris_cinematic_rgba.png', 'iris_authentic_rgba.png', 'iris_confidence.png', 'iris_particles.bin'].map(name => [name, 'a'.repeat(64)])) })
describe('iris asset contract', () => {
  it('accepts the declared run format', () => expect(validateIrisManifest(valid()).particles.count).toBe(80000))
  it('rejects incompatible layout and missing checksums', () => { const manifest = valid(); manifest.particles.layout = ['x', 'y', 'z']; expect(() => validateIrisManifest(manifest)).toThrow('Incompatible'); expect(() => validateIrisManifest({ ...valid(), files: {} })).toThrow('Incompatible') })
})
