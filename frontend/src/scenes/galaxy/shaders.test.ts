import { expect, it } from 'vitest'
import { createBackgroundGasMaterial, createFogMaterial, createGasMaterial, createStarMaterial } from './shaders'

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
