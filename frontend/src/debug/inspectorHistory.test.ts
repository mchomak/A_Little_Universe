import { describe, expect, it } from 'vitest'
import { createInspectorHistory } from './inspectorHistory'

describe('inspector history', () => {
  it('keeps independent scene histories and includes resets', () => {
    const h = createInspectorHistory()
    h.record('prologue', { size: 48 }, { size: 61 })
    h.record('preparation', { spacing: 24 }, { spacing: 32 })
    h.record('prologue', { size: 61 }, { size: 48 })
    expect(h.undo('prologue')).toEqual({ size: 61 })
    expect(h.undo('prologue')).toEqual({ size: 48 })
    expect(h.redo('prologue')).toEqual({ size: 61 })
    expect(h.undo('preparation')).toEqual({ spacing: 24 })
  })
  it('clears redo after a new edit and establishes a boundary on import', () => {
    const h = createInspectorHistory()
    h.record('prologue', { size: 48 }, { size: 61 })
    h.undo('prologue')
    h.record('prologue', { size: 48 }, { size: 55 })
    expect(h.canRedo('prologue')).toBe(false)
    h.clear()
    expect(h.canUndo('prologue')).toBe(false)
  })
  it('ignores unchanged updates', () => {
    const h = createInspectorHistory()
    h.record('global', { speed: 1 }, { speed: 1 })
    expect(h.canUndo('global')).toBe(false)
  })
  it('returns only edited fields so unrelated playback changes survive undo', () => {
    const h = createInspectorHistory()
    h.record('global', { quality: 'standard', speed: 1 }, { quality: 'low', speed: 1 })
    const current = { quality: 'low', speed: 0.5 }
    expect({ ...current, ...h.undo('global') }).toEqual({ quality: 'standard', speed: 0.5 })
  })
})
