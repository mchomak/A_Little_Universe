import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTICLE_PORTRAIT_SETTINGS } from './config'
import { DEFAULT_PARTICLE_PROFILES, DEFAULT_PORTRAIT_STRUCTURE_SETTINGS } from './particleProfiles'
import { DEFAULT_PORTRAIT_EDITOR_SETTINGS, parsePortraitProject, serializePortraitProject } from './projectFormat'
import type { Stroke } from './hybridPortrait'

const stroke: Stroke = { id: 'face-line', kind: 'contour', points: [{ x: 1, y: 1 }, { x: 3, y: 2 }], spacing: 5, width: 0, jitter: 1, brightness: 1.2, smooth: 0.5, size: 1 }
const project = {
  width: 4, height: 3,
  settings: { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, seed: 123 },
  density: new Uint8Array([0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 255]),
  suppression: new Uint8Array([255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  strokes: [stroke],
  profiles: { ...DEFAULT_PARTICLE_PROFILES, contour: { density: 0.8, size: 1.2, brightness: 1.1, jitter: 0.4 } },
  structure: { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, fillSuppression: 0.5, supportMix: 0.3 },
  editor: { maskOpacity: 0.6, brushSize: 3, brushSoftness: 0.2, brushIntensity: 0.7, brushValue: 64, strokeSpacing: 6, strokeWidth: 12, strokeJitter: 3, strokeBrightness: 1.4, strokeSmooth: 0.7, strokeSize: 1.3 },
}

describe('portrait project format', () => {
  it('round trips masks, strokes, generator profiles, portrait structure, and brush settings', () => {
    const restored = parsePortraitProject(JSON.parse(serializePortraitProject(project)), project.width, project.height)
    expect(restored).toEqual(project)
  })

  it('loads earlier project versions with default editor settings', () => {
    const current = JSON.parse(serializePortraitProject(project)) as Record<string, unknown>
    delete current.editor
    current.version = 3
    const restored = parsePortraitProject(current, project.width, project.height)
    expect(restored.editor).toEqual(DEFAULT_PORTRAIT_EDITOR_SETTINGS)
    expect(restored.profiles).toEqual(project.profiles)
    expect(restored.structure).toEqual(DEFAULT_PORTRAIT_STRUCTURE_SETTINGS)

    current.version = 2
    expect(parsePortraitProject(current, project.width, project.height).structure).toEqual(DEFAULT_PORTRAIT_STRUCTURE_SETTINGS)

    current.version = 1
    delete current.profiles
    expect(parsePortraitProject(current, project.width, project.height).profiles).toEqual(DEFAULT_PARTICLE_PROFILES)
  })

  it('restores projects with legacy brush-only editor settings', () => {
    const legacy = JSON.parse(serializePortraitProject(project)) as Record<string, unknown>
    legacy.version = 2
    legacy.editor = { maskOpacity: 0.6, brushSize: 3, brushSoftness: 0.2, brushIntensity: 0.7, brushValue: 64 }
    const restored = parsePortraitProject(legacy, project.width, project.height)
    expect(restored.editor).toEqual({ ...DEFAULT_PORTRAIT_EDITOR_SETTINGS, ...legacy.editor as object })
  })

  it('rejects projects with invalid brush settings', () => {
    const current = JSON.parse(serializePortraitProject(project)) as Record<string, unknown>
    current.editor = { ...project.editor, brushSize: 0 }
    expect(() => parsePortraitProject(current, project.width, project.height)).toThrow('Некорректная настройка кисти')
  })

  it('rejects invalid contour/support/fill controls', () => {
    const current = JSON.parse(serializePortraitProject(project)) as Record<string, unknown>
    current.structure = { ...project.structure, fillSuppression: 1.5 }
    expect(() => parsePortraitProject(current, project.width, project.height)).toThrow('Некорректная настройка структуры портрета')
  })
})
