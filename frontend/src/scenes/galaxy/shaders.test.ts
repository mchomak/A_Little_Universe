import { expect, it } from 'vitest'
import { applyGalaxyFrameMaterials, createCoreMaterial, createFogMaterial, createGasMaterial, createStarMaterial, createSunMaterial } from './shaders'

it('keeps every shader smoothstep edge ascending for GLSL portability', () => {
  const materials = [createStarMaterial(), createSunMaterial(), createGasMaterial(), createFogMaterial()]
  try {
    const shaderSources = materials.flatMap(({ material }) => [material.vertexShader, material.fragmentShader])
    const calls = shaderSources.flatMap((source) => Array.from(source.matchAll(/smoothstep\(\s*((?:\d+\.?\d*|\.\d+))\s*,\s*((?:\d+\.?\d*|\.\d+))/g)))
    expect(calls.filter(([, first, second]) => Number(first) > Number(second))).toEqual([])
  } finally {
    materials.forEach(({ material }) => material.dispose())
  }
})

it('uses original rigid GPU rotation, per-star twinkle and perspective point sizing', () => {
  const disk = createStarMaterial()
  const suns = createSunMaterial()
  try {
    for (const { material } of [disk, suns]) {
      expect(material.vertexShader).toMatch(/p\.xy\s*=\s*mat2\(c,\s*-s,\s*s,\s*c\)\s*\*\s*p\.xy/)
      expect(material.vertexShader).toMatch(/uRotationSpeed\s*\*\s*uRotTime/)
      expect(material.vertexShader).toMatch(/aSize\s*\*\s*uSize\s*.*uPixelRatio/)
      expect(material.vertexShader).not.toContain('uDifferential')
    }
    expect(disk.material.vertexShader).toContain('uniform float uTwinkleSpeed;')
    expect(disk.material.vertexShader).toContain('uTime * 1.6 * uTwinkleSpeed')
    expect(suns.material.vertexShader).toContain('uniform float uTwinkleSpeed;')
    expect(suns.material.vertexShader).toContain('(0.5 + aSeed) * uTwinkleSpeed')
    expect(disk.material.fragmentShader).toContain('vGlow')
    expect(suns.material.fragmentShader).toContain('vPulse')
  } finally {
    disk.material.dispose(); suns.material.dispose()
  }
})

it('uses an increasing-edge soft halo and a local ACES shoulder before sRGB output', () => {
  const { material } = createStarMaterial()
  try {
    expect(material.fragmentShader).toMatch(/1\.0\s*-\s*smoothstep\(0\.0,\s*1\.0,\s*d\)/)
    expect(material.fragmentShader).toContain('localAces(color * intensity)')
    expect(material.fragmentShader).toContain('#include <colorspace_fragment>')
  } finally {
    material.dispose()
  }
})

it('gives the dense core a restrained pearl-to-gold halo with no visible quad edge', () => {
  const { material } = createCoreMaterial()
  try {
    expect(material.fragmentShader).toMatch(/edgeFade\s*=\s*1\.0\s*-\s*smoothstep\(0\.82,\s*1\.0,\s*r\)/)
    expect(material.fragmentShader).toMatch(/halo\s*=\s*exp\(-r\s*\*\s*r\s*\*\s*4\.2\)/)
    expect(material.fragmentShader).toContain('vec3(1.0,0.97,0.9)')
    expect(material.fragmentShader).toMatch(/glow\s*\*\s*\.2/)
    expect(material.fragmentShader).toContain('#include <colorspace_fragment>')
  } finally {
    material.dispose()
  }
})

it('softens only the dense stellar bulge before LDR compositing', () => {
  const { material } = createStarMaterial()
  try {
    expect(material.vertexShader).toContain('attribute float aRegion;')
    expect(material.vertexShader).toContain('vCore = aRegion;')
    expect(material.fragmentShader).toContain('mix(1.0, 0.14, vCore)')
    expect(material.fragmentShader).toContain('mix(vColor, vec3(1.0, 0.96, 0.88), vCore * 0.5)')
  } finally {
    material.dispose()
  }
})

it('keeps the gas arm shader circular, noisy and phase-locked to star rotation', () => {
  const gas = createGasMaterial()
  const disk = createStarMaterial()
  try {
    expect(gas.material.fragmentShader).toContain('if (radius > 1.0) discard')
    expect(gas.material.fragmentShader).toMatch(/for\s*\(int octave\s*=\s*0;\s*octave\s*<\s*3/)
    expect(gas.material.fragmentShader).toMatch(/float rotation\s*=\s*uRotationSpeed\s*\*\s*uMotionTime/)
    expect(gas.material.fragmentShader).toMatch(/theta\s*-\s*uSpin\s*\*\s*radius\s*\+\s*rotation/)
    expect(disk.material.vertexShader).toMatch(/uRotationSpeed\s*\*\s*uRotTime/)
  } finally {
    gas.material.dispose(); disk.material.dispose()
  }
})

it('keeps the gas arm phase moving with points in the same direction', () => {
  const gas = createGasMaterial()
  const disk = createStarMaterial()
  try {
    const initialAngle = Math.PI / 6
    const phase = Math.PI / 3
    const starRotation = disk.material.vertexShader.match(/p\.xy\s*=\s*mat2\(c,\s*(-?)s,\s*s,\s*c\)\s*\*\s*p\.xy/)
    const gasRotation = gas.material.fragmentShader.match(/theta\s*-\s*uSpin\s*\*\s*radius\s*([+-])\s*rotation/)
    expect(starRotation?.[1]).toBe('-')
    expect(gasRotation?.[1]).toBe('+')
    const pointAngle = initialAngle + (starRotation?.[1] === '-' ? -phase : phase)
    // The arm ridge solves theta - spin*r + rotation = branch, hence it advances opposite the rotation term.
    const gasAngle = initialAngle + (gasRotation?.[1] === '+' ? -phase : phase)
    expect(gasAngle).toBeCloseTo(pointAngle, 10)
  } finally {
    gas.material.dispose(); disk.material.dispose()
  }
})

it('sets stars and gas from the same deterministic scene phase across the shared clock', () => {
  const materials = {
    disk: createStarMaterial(), bright: createSunMaterial(), gas: createGasMaterial(), core: createCoreMaterial(), fog: [],
  }
  try {
    applyGalaxyFrameMaterials(materials, {
      motionTime: 12, phaseTime: 19, reveal: 1, firstStars: 1, twinkleSpeed: 0.37,
      diskBrightness: 1, brightBrightness: 1, nebulaBrightness: 0.69, sceneLight: 0.76, gasReveal: 1, fogOpacity: 0,
      coreReveal: 1, coreBrightness: 1, coreGlow: 1,
    })
    expect(materials.disk.uniforms.uRotTime?.value).toBe(12)
    expect(materials.bright.uniforms.uRotTime?.value).toBe(12)
    expect(materials.gas.uniforms.uMotionTime?.value).toBe(12)
    expect(materials.gas.uniforms.uTime?.value).toBe(19)
    expect(materials.disk.uniforms.uTwinkleSpeed?.value).toBe(0.37)
    expect(materials.bright.uniforms.uTwinkleSpeed?.value).toBe(0.37)
    expect(materials.gas.uniforms.uExposure?.value).toBeCloseTo(0.69 * 0.76, 10)
  } finally {
    materials.disk.material.dispose(); materials.bright.material.dispose(); materials.gas.material.dispose(); materials.core.material.dispose()
  }
})
