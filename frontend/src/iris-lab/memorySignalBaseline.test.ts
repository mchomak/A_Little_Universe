import { describe, expect, it } from 'vitest'
import { memorySignalBaselineDefaults, memorySignalBaselineDimensions, memorySignalBaselineFragmentShader, memorySignalBaselineVertexShader, processMemorySignalBaselinePixels } from './memorySignalBaseline'

describe('Memory Signal baseline', () => {
  it('uses the reference downsample dimensions and exact comparison values', () => {
    expect(memorySignalBaselineDimensions(1000, 600)).toEqual({ width: 300, height: 180 })
    expect(memorySignalBaselineDimensions(240, 120)).toEqual({ width: 240, height: 120 })
    expect(memorySignalBaselineDefaults).toEqual({ bloomStrength: 0.82, bloomRadius: 0.082, bloomThreshold: 0.103, particleSize: 0.8448, zRelief: 52.6, noiseStrength: 1.805 })
  })

  it('matches reference alpha/luma filters, XY scale, edge neighborhood and camera fit', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255, 20, 20, 20, 255,
      255, 255, 255, 20, 255, 255, 255, 0,
    ])
    const sample = processMemorySignalBaselinePixels(rgba, 2, 2, () => 0.25)
    expect(sample.count).toBe(2)
    expect(Array.from(sample.positions)).toEqual([-1.5, 1.5, 0, 0, 1.5, 0])
    expect(Array.from(sample.colors.slice(0, 3))).toEqual([1, 1, 1])
    for (const channel of sample.colors.slice(3)) expect(channel).toBeCloseTo(20 / 255)
    expect(sample.brightness[0]).toBe(1)
    expect(sample.brightness[1]).toBeCloseTo(20 / 255)
    expect(Array.from(sample.random)).toEqual([0.25, 0.25])
    const sourceNeighborhoodEdge = (1 - (2 + 20 / 255) / 49) ** 1.5
    expect(sample.edgeFactor[0]).toBeCloseTo(sourceNeighborhoodEdge)
    expect(sample.edgeFactor[1]).toBeCloseTo(Math.min(1, sourceNeighborhoodEdge + 0.2))
    expect(sample.fitDistance).toBeCloseTo(1.8)
  })

  it('retains the original simplex/curl, relief, tearing, point attenuation and fragment equations', () => {
    expect(memorySignalBaselineVertexShader).toContain('float zReliefValue = brightness * uZRelief;')
    expect(memorySignalBaselineVertexShader).toContain('vec3 cnoise = curlNoise(pos * 0.005 + vec3(0.0, uTime * 0.1, uTime * 0.05));')
    expect(memorySignalBaselineVertexShader).toContain('float noisePower = mix(2.0, 100.0, smoothstep(0.0, 1.0, edgeFactor));')
    expect(memorySignalBaselineVertexShader).toContain('pos += cnoise * tearForce * 150.0;')
    expect(memorySignalBaselineVertexShader).toContain('gl_PointSize = pSize * (300.0 / -mvPosition.z);')
    expect(memorySignalBaselineFragmentShader).toContain('float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;')
    expect(memorySignalBaselineFragmentShader).toContain('finalColor += vec3(0.1, 0.3, 0.5) * vEdge;')
  })
})
