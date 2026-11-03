import { describe, expect, it } from 'vitest'
import { particleFragment, particleVertex } from './seedShaders'

describe('seed meteor trail shader', () => {
  it('uses the scene fall timing and the same accelerated path as the seed', () => {
    expect(particleVertex).toContain('uniform float seedFallAcceleration;')
    expect(particleVertex).toContain('uniform float seedFallHeight;')
    expect(particleVertex).toContain('seedFallProgress(fallProgress, seedFallAcceleration)')
    expect(particleVertex).toContain('seedFallProgress(emission, seedFallAcceleration)')
    expect(particleVertex).toContain('return pow(t, a);')
  })

  it('emits deterministic fragments during the fall and sends them upward and outward', () => {
    expect(particleVertex).toContain('float emissionTime = fallRange.x + emission * fallDuration;')
    expect(particleVertex).toContain('float emission = mix(0.04, 0.98, clamp(r, 0.0, 1.0));')
    expect(particleVertex).toContain('float ageSeconds = time - emissionTime;')
    expect(particleVertex).toContain('emissionY + age * seedTrailLiftSpeed * (0.72 + s * 0.56)')
    expect(particleVertex).toContain('cos(direction) * spread')
    expect(particleVertex).toContain('sin(direction) * spread')
    expect(particleVertex).toContain('* (1.0 - reduced)')
  })

  it('exposes spread and lifetime controls and fades old fragments', () => {
    expect(particleVertex).toContain('uniform float seedTrailSpread;')
    expect(particleVertex).toContain('uniform float seedTrailLifetime;')
    expect(particleVertex).toContain('uniform float seedTrailLiftSpeed;')
    expect(particleVertex).toContain('float lifetime = max(0.12, seedTrailLifetime);')
    expect(particleVertex).toContain('(1.0 - smoothstep(0.76, 1.0, ageProgress))')
  })

  it('keeps fragments readable and lets them dissolve in size and brightness', () => {
    expect(particleVertex).toContain('float pointScale = mode >= 0.5 && mode < 1.5')
    expect(particleVertex).toContain('(6.0 + s * 9.0) * (1.0 - trailAgeProgress * 0.32)')
    expect(particleVertex).toContain('* (1.0 - reduced) * 1.4')
    expect(particleFragment).toContain('if (vTrailAge >= 0.0)')
    expect(particleFragment).toContain('meteorHalo = mix(1.0, 1.12, 1.0 - vTrailAge)')
  })

  it('keeps formation particles and makes impact fragments burst from the seed at contact', () => {
    expect(particleVertex).toContain('if (mode < 0.5)')
    expect(particleVertex).toContain('} else if (mode < 1.5) {')
    expect(particleVertex).toContain('uniform float impactOriginY;')
    expect(particleVertex).toContain('float impactAge = time - fallRange.y;')
    expect(particleVertex).toContain('float expansion = 1.0 - pow(1.0 - progress, 3.0);')
    expect(particleVertex).toContain('impactOriginY + lift - gravity')
    expect(particleVertex).toContain('mode >= 1.5')
    expect(particleVertex).toContain('(6.0 + s * 9.0) * (1.0 - burstAgeProgress * 0.24)')
    expect(particleFragment).toContain('float light = exp(-r * r * 5.0) * 0.48 + exp(-r * r * 40.0) * 0.65;')
  })
})
