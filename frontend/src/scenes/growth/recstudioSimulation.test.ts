import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getMorphInfluence, getReplayPlan, replaySimulationSteps, requiresSimulationReset } from './recstudioSimulation'

it('continues forward simulation incrementally and restores a deterministic checkpoint on backward seek', () => {
  expect(getReplayPlan(45, 63, [0, 15, 30, 45])).toEqual({ restoreStep: null, targetStep: 63 })
  expect(getReplayPlan(63, 32, [0, 15, 30, 45, 60])).toEqual({ restoreStep: 30, targetStep: 32 })
  expect(getReplayPlan(90, 0, [0, 15, 30, 45, 60, 75, 90])).toEqual({ restoreStep: 0, targetStep: 0 })
})

it('replays at the current film time after physics edits but preserves visual-only changes', () => {
  const initial = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth
  expect(requiresSimulationReset(initial, { ...initial, noiseStrength: initial.noiseStrength + 0.1 })).toBe(true)
  expect(requiresSimulationReset(initial, { ...initial, cloudRadius: initial.cloudRadius + 0.1 })).toBe(true)
  expect(requiresSimulationReset(initial, { ...initial, particleSize: initial.particleSize + 0.1 })).toBe(false)
  expect(requiresSimulationReset(initial, { ...initial, pearlColor: '#FFEEEE' })).toBe(false)
})

it('copies the nearest prior GPU checkpoint and replays forward in fixed-step order', () => {
  const operations: string[] = []
  const finalStep = replaySimulationSteps(63, 32, [0, 15, 30, 45, 60], {
    restore: step => operations.push(`copy checkpoint ${step}`),
    step: step => operations.push(`step ${step}`),
    checkpoint: step => operations.push(`save checkpoint ${step}`),
  })
  expect(finalStep).toBe(32)
  expect(operations).toEqual(['copy checkpoint 30', 'step 31', 'step 32'])
})

it('replays a reset state incrementally and only snapshots fixed checkpoint boundaries', () => {
  const operations: string[] = []
  const finalStep = replaySimulationSteps(0, 32, [0], {
    restore: step => operations.push(`copy checkpoint ${step}`),
    step: step => operations.push(`step ${step}`),
    checkpoint: step => operations.push(`save checkpoint ${step}`),
  })
  expect(finalStep).toBe(32)
  expect(operations[0]).toBe('step 1')
  expect(operations).toContain('save checkpoint 15')
  expect(operations).toContain('save checkpoint 30')
})

it('keeps early movement free and eases into full attraction near the end of formation', () => {
  const ramp = 2.816
  expect(getMorphInfluence(0, ramp)).toBe(0)
  expect(getMorphInfluence(1, ramp)).toBeLessThan(0.1)
  expect(getMorphInfluence(2, ramp)).toBeGreaterThan(0.35)
  expect(getMorphInfluence(2, ramp)).toBeLessThan(0.55)
  expect(getMorphInfluence(ramp, ramp)).toBe(1)
  expect(getMorphInfluence(4, ramp)).toBe(1)
})
