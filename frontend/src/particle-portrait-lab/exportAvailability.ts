export type ExportSampleStatus = 'loading' | 'ready' | 'error'

export interface PointExportAvailabilityInput {
  status: ExportSampleStatus
  revision: number
  completedRevision: number
  drawing: boolean
}

export function canExportPoints(input: PointExportAvailabilityInput) {
  return input.status === 'ready'
    && input.revision === input.completedRevision
    && input.completedRevision >= 0
    && !input.drawing
}

export interface PreviewExportAvailabilityInput extends PointExportAvailabilityInput {
  canvasVisible: boolean
  previewRevision: number
  renderedRevision: number
}

export function canExportPreview(input: PreviewExportAvailabilityInput) {
  return canExportPoints(input)
    && input.canvasVisible
    && input.previewRevision === input.renderedRevision
    && input.renderedRevision >= 0
}
