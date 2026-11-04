import { describe, expect, it } from 'vitest'
import { resolveIrisPhotoSource, validateIrisManifest } from './assets'
const valid = () => ({ schemaVersion: 1, sourceRun: 'run_017_requirements_env', textureSize: [1024, 1024], textureColorSpace: 'sRGB-unpremultiplied-alpha', confidenceColorSpace: 'linear-data', pupilRatio: 0.175, particles: { count: 80000, format: 'float32-le', strideBytes: 28, layout: ['x', 'y', 'z', 'r_linear', 'g_linear', 'b_linear', 'size'], coordinates: 'iris radius 1; +x right, +y up, +z forward', colorSpace: 'linear-sRGB' }, files: Object.fromEntries(['iris_cinematic_rgba.png', 'iris_authentic_rgba.png', 'iris_confidence.png', 'iris_particles.bin'].map(name => [name, 'a'.repeat(64)])) })
describe('iris asset contract', () => {
  it('accepts the declared run format', () => expect(validateIrisManifest(valid()).particles.count).toBe(80000))
  it('rejects incompatible layout and missing checksums', () => { const manifest = valid(); manifest.particles.layout = ['x', 'y', 'z']; expect(() => validateIrisManifest(manifest)).toThrow('Incompatible'); expect(() => validateIrisManifest({ ...valid(), files: {} })).toThrow('Incompatible') })
  it('uses the reconstructed run_017 iris only for its dedicated view and preserves existing photo fallbacks', () => {
    expect(resolveIrisPhotoSource('Run 017 Blue Fibers', 'blob:personal-photo', true)).toBe('/__iris-assets/vasilisa/iris_cinematic_rgba.png')
    expect(resolveIrisPhotoSource('Blue Particle Eye', 'blob:personal-photo', true)).toBe('blob:personal-photo')
    expect(resolveIrisPhotoSource('Cinematic Fiber Iris', null, true)).toBe('/__iris-assets/source-eye.png')
    expect(resolveIrisPhotoSource('Cinematic Fiber Iris', null, false)).toBeNull()
  })
})
