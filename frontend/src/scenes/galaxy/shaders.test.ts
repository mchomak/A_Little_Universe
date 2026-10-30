import { expect, it } from 'vitest'
import { applyGalaxyFrameMaterials, createBackgroundGasMaterial, createCoreMaterial, createFogMaterial, createGasMaterial, createStarMaterial } from './shaders'

it('uses ascending smoothstep edges in every galaxy shader', () => {
  const materials = [createStarMaterial(), createGasMaterial(), createFogMaterial(), createBackgroundGasMaterial()]
  try {
    const shaderSources = materials.flatMap(({ material }) => [material.vertexShader, material.fragmentShader])
    const calls = shaderSources.flatMap((source) => Array.from(source.matchAll(/smoothstep\(\s*((?:\d+\.?\d*|\.\d+))\s*,\s*((?:\d+\.?\d*|\.\d+))/g)))
    const descendingEdges = calls.filter(([, first, second]) => Number(first) > Number(second))

    expect(descendingEdges).toEqual([])
  } finally {
    materials.forEach(({ material }) => material.dispose())
  }
})

it('declares the gas animation speed in the fragment shader where it is sampled', () => {
  const { material } = createGasMaterial()
  try {
    expect(material.fragmentShader).toMatch(/uniform\s+float\s+uSpeed\s*;/)
    expect(material.fragmentShader).toMatch(/uTime\s*\*\s*uSpeed/)
  } finally {
    material.dispose()
  }
})

it('aligns gas arms with the configured star-arm count and winding', () => {
  const { material, uniforms } = createGasMaterial()
  try {
    expect(uniforms.uArms?.value).toBe(4)
    expect(uniforms.uSpin?.value).toBe(1.2)
    expect(material.fragmentShader).toMatch(/angle\s*\*\s*uArms\s*-\s*radius\s*\*\s*uSpin\s*\*\s*uArms\s*\*\s*1\.225/)
  } finally {
    material.dispose()
  }
})

it('widens the luminous gas arm band through the shared arm-width control', () => {
  const { material, uniforms } = createGasMaterial()
  try {
    expect(uniforms.uArmWidth?.value).toBe(0.5)
    expect(material.fragmentShader).toMatch(/uniform\s+float\s+uArmWidth\s*;/)
    expect(material.fragmentShader).toMatch(/float armSignal\s*=\s*pow\(max\(spiral,\s*0\.0\),\s*mix\(1\.18,\s*0\.58,\s*clamp\(uArmWidth\s*\/\s*1\.1,\s*0\.0,\s*1\.0\)\)\)/)
    expect(material.fragmentShader).toMatch(/armDust\s*=\s*smoothstep\(0\.27,\s*0\.82,\s*clouds\s*\*\s*0\.3\s*\+\s*armSignal\s*\*\s*0\.88\)/)
  } finally {
    material.dispose()
  }
})

it('adds sparse seed-driven warm and cool color accents to stars', () => {
  const { material } = createStarMaterial()
  try {
    expect(material.fragmentShader).toMatch(/uniform\s+vec3\s+uCoreColor\s*;/)
    expect(material.fragmentShader).toMatch(/uniform\s+vec3\s+uInnerColor\s*;/)
    expect(material.fragmentShader).toMatch(/float warmAccent\s*=\s*smoothstep\(0\.9,\s*0\.995,\s*vSeed\)\s*\*\s*0\.42/)
    expect(material.fragmentShader).toMatch(/float coolAccent\s*=\s*smoothstep\(0\.94,\s*0\.995,\s*fract\(vSeed\s*\*\s*7\.13\)\)\s*\*\s*0\.3/)
    expect(material.fragmentShader).toMatch(/tint\s*=\s*mix\(vColor,\s*uCoreColor,\s*warmAccent\)/)
    expect(material.fragmentShader).toMatch(/tint\s*=\s*mix\(tint,\s*uInnerColor,\s*coolAccent\)/)
  } finally {
    material.dispose()
  }
})

it('animates gas rotation from the same shared motion phase as stars', () => {
  const materials = {
    disk: createStarMaterial(), bright: createStarMaterial(), background: createStarMaterial(),
    backgroundGas: createBackgroundGasMaterial(), gas: createGasMaterial(), core: createCoreMaterial(), fog: [],
  }
  try {
    applyGalaxyFrameMaterials(materials, {
      motionTime: 12, phaseTime: 19, reveal: 1, firstStars: 1,
      diskBrightness: 1, brightBrightness: 1, backgroundBrightness: 1, gasBrightness: 1,
      gasReveal: 1, backgroundGasBrightness: 1, coreReveal: 1, light: 1, fogOpacity: 0,
    })
    expect(materials.disk.uniforms.uTime?.value).toBe(12)
    expect(materials.gas.uniforms.uMotionTime?.value).toBe(12)
    expect(materials.gas.uniforms.uTime?.value).toBe(19)
    expect(materials.gas.material.vertexShader).not.toContain('uSpeed')
    expect(materials.gas.material.fragmentShader).toMatch(/uniform\s+float\s+uRotationSpeed/)
    expect(materials.gas.material.fragmentShader).toMatch(/uMotionTime\s*\*\s*uRotationSpeed/)
    expect(materials.gas.material.fragmentShader).toMatch(/uTime\s*\*\s*uSpeed/)
  } finally {
    materials.disk.material.dispose(); materials.bright.material.dispose(); materials.background.material.dispose()
    materials.backgroundGas.material.dispose(); materials.gas.material.dispose(); materials.core.material.dispose()
  }
})

it('advances the gas arm angle in the same direction as point rotation at a fixed phase', () => {
  const { material } = createGasMaterial()
  try {
    const phaseExpression = material.fragmentShader.match(/float angle\s*=\s*atan\(p\.y,\s*p\.x\)\s*([+-])\s*uMotionTime\s*\*\s*uRotationSpeed\s*\*\s*differential/)
    expect(phaseExpression?.[1]).toBe('+')

    const initialAngle = Math.PI / 6
    const motionPhase = Math.PI / 3
    const gasAngle = initialAngle + (phaseExpression?.[1] === '+' ? motionPhase : -motionPhase)
    expect(gasAngle).toBeCloseTo(Math.PI / 2, 10)
    expect(Math.cos(gasAngle)).toBeCloseTo(Math.cos(initialAngle + motionPhase), 10)
  } finally {
    material.dispose()
  }
})

it('does not premultiply point colour before additive blending', () => {
  const { material } = createStarMaterial()
  try {
    expect(material.fragmentShader).toMatch(/vec4\(tint\s*\*\s*uBrightness\s*\*\s*uExposure\s*,\s*alpha\)/)
    expect(material.fragmentShader).not.toMatch(/tint\s*\*\s*alpha/)
  } finally {
    material.dispose()
  }
})

it('fades background gas all the way to zero at the edge of its plane', () => {
  const { material } = createBackgroundGasMaterial()
  try {
    expect(material.fragmentShader).toMatch(/veil\s*=\s*1\.0\s*-\s*smoothstep\(\.4,\s*\.96,\s*length\(p\s*\*\s*vec2\(\.93,\s*1\.0\)\)\)/)
  } finally {
    material.dispose()
  }
})

it('fades foreground fog before the rectangular quad edges', () => {
  const { material } = createFogMaterial()
  try {
    expect(material.fragmentShader).toMatch(/boundary\s*=\s*1\.0\s*-\s*smoothstep\(\.4,\s*\.86,\s*edge/)
  } finally {
    material.dispose()
  }
})

it('fades the core glow to transparent at its circular edge and keeps additive RGB unpremultiplied', () => {
  const { material } = createCoreMaterial()
  try {
    expect(material.fragmentShader).toMatch(/edgeFade\s*=\s*1\.0\s*-\s*smoothstep\(\.82,\s*1\.0,\s*r\)/)
    expect(material.fragmentShader).toMatch(/gl_FragColor\s*=\s*vec4\(c,\s*a\)/)
    expect(material.fragmentShader).not.toMatch(/vec4\(c\s*\*\s*a/)
  } finally {
    material.dispose()
  }
})
