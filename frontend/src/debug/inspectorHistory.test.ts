import { describe, expect, it } from 'vitest'
import { createInspectorHistory } from './inspectorHistory'

describe('inspector history', () => {
  it('keeps independent scene histories and includes resets', () => {
    const h = createInspectorHistory()
    h.record('prologue', { size: 48 }, { size: 61 })
    h.record('growth', { spacing: 24 }, { spacing: 32 })
    h.record('prologue', { size: 61 }, { size: 48 })
    expect(h.undo('prologue')).toEqual({ size: 61 })
    expect(h.undo('prologue')).toEqual({ size: 48 })
    expect(h.redo('prologue')).toEqual({ size: 61 })
    expect(h.undo('growth')).toEqual({ spacing: 24 })
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
  it('keeps gallery history isolated and field-level for live art edits', () => {
    const h = createInspectorHistory()
    h.record('gallery', { moonBrightness: 0.8, threadOpacity: 0.38 }, { moonBrightness: 1.2, threadOpacity: 0.38 })
    h.record('prologue', { fontSize: 48 }, { fontSize: 64 })

    const galleryWithExternalEdit = { moonBrightness: 1.2, threadOpacity: 0.6 }
    expect({ ...galleryWithExternalEdit, ...h.undo('gallery') }).toEqual({ moonBrightness: 0.8, threadOpacity: 0.6 })
    expect(h.undo('prologue')).toEqual({ fontSize: 48 })
    expect(h.redo('gallery')).toEqual({ moonBrightness: 1.2 })
  })
})
