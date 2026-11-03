import { describe, expect, it } from 'vitest'
import { canExportPoints, canExportPreview } from './exportAvailability'

describe('particle portrait export availability', () => {
  it('blocks point exports immediately when a newer sample revision is pending', () => {
    expect(canExportPoints({ status: 'ready', revision: 4, completedRevision: 4, drawing: false })).toBe(true)
    expect(canExportPoints({ status: 'ready', revision: 5, completedRevision: 4, drawing: false })).toBe(false)
    expect(canExportPoints({ status: 'ready', revision: 4, completedRevision: 4, drawing: true })).toBe(false)
  })

  it('blocks preview exports when the canvas is hidden or has not rendered the current revision', () => {
    const current = {
      status: 'ready' as const,
      revision: 3,
      completedRevision: 3,
      drawing: false,
      canvasVisible: true,
      previewRevision: 8,
      renderedRevision: 8,
    }
    expect(canExportPreview(current)).toBe(true)
    expect(canExportPreview({ ...current, canvasVisible: false })).toBe(false)
    expect(canExportPreview({ ...current, previewRevision: 9 })).toBe(false)
    expect(canExportPreview({ ...current, renderedRevision: 7 })).toBe(false)
    expect(canExportPreview({ ...current, revision: 4, completedRevision: 3 })).toBe(false)
  })
})
