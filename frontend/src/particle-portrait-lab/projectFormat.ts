import { parseParticlePortraitSettings, type ParticlePortraitSettings } from './config'
import { DEFAULT_PARTICLE_PROFILES, DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, parseParticleProfiles, parsePortraitStructureSettings, type ParticleProfiles, type PortraitStructureSettings } from './particleProfiles'
import type { Stroke } from './hybridPortrait'

export type PortraitEditorSettings = {
  maskOpacity: number; brushSize: number; brushSoftness: number; brushIntensity: number; brushValue: number
  strokeSpacing: number; strokeWidth: number; strokeJitter: number; strokeBrightness: number; strokeSmooth: number; strokeSize: number
}
export const DEFAULT_PORTRAIT_EDITOR_SETTINGS: PortraitEditorSettings = {
  maskOpacity: 0.42, brushSize: 54, brushSoftness: 0.55, brushIntensity: 0.8, brushValue: 220,
  strokeSpacing: 8, strokeWidth: 8, strokeJitter: 2, strokeBrightness: 1.2, strokeSmooth: 0.5, strokeSize: 1,
}
export type PortraitProject = { width: number; height: number; settings: ParticlePortraitSettings; density: Uint8Array; suppression: Uint8Array; strokes: Stroke[]; profiles: ParticleProfiles; structure: PortraitStructureSettings; editor: PortraitEditorSettings }

function encode(bytes: Uint8Array) {
  let result = ''
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(result)
}

export function serializePortraitProject(project: PortraitProject): string {
  return JSON.stringify({ format: 'a-little-universe/portrait-project', version: 4, width: project.width, height: project.height,
    settings: project.settings, densityMask: encode(project.density), suppressionMask: encode(project.suppression), strokes: project.strokes, profiles: project.profiles, structure: project.structure, editor: project.editor })
}

export function parsePortraitProject(raw: unknown, width: number, height: number): PortraitProject {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Некорректный файл проекта.')
  const data = raw as Record<string, unknown>
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0
    || data.format !== 'a-little-universe/portrait-project' || (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4)
    || data.width !== width || data.height !== height || typeof data.densityMask !== 'string' || typeof data.suppressionMask !== 'string' || !Array.isArray(data.strokes)) throw new Error('Формат проекта или размер фотографии не совпадает.')
  const maximumEncodedLength = Math.ceil(width * height / 3) * 4
  if (data.densityMask.length !== maximumEncodedLength || data.suppressionMask.length !== maximumEncodedLength) throw new Error('Некорректный размер маски.')
  const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
  const density = decode(data.densityMask), suppression = decode(data.suppressionMask)
  if (density.length !== width * height || suppression.length !== density.length) throw new Error('Некорректный размер маски.')
  if (data.strokes.length > 2000) throw new Error('Слишком много штрихов в проекте.')
  let totalPoints = 0
  const strokes = data.strokes as Stroke[]
  for (const stroke of strokes) {
    if (!stroke || typeof stroke.id !== 'string' || stroke.id.length > 200 || (stroke.kind !== 'contour' && stroke.kind !== 'flow') || !Array.isArray(stroke.points) || stroke.points.length < 2) throw new Error('Некорректный штрих.')
    totalPoints += stroke.points.length
    if (totalPoints > 200_000 || !stroke.points.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height)) throw new Error('Некорректные координаты штриха.')
    if (![stroke.spacing, stroke.width, stroke.jitter, stroke.brightness, stroke.smooth, stroke.size].every((n) => typeof n === 'number' && Number.isFinite(n)) || stroke.spacing < 3 || stroke.spacing > 40 || stroke.width < 0 || stroke.width > 60 || stroke.jitter < 0 || stroke.jitter > 20 || stroke.brightness < 0.2 || stroke.brightness > 2 || stroke.smooth < 0 || stroke.smooth > 1 || stroke.size < 0.4 || stroke.size > 3) throw new Error('Некорректные параметры штриха.')
  }
  return { width, height, settings: parseParticlePortraitSettings(data.settings), density, suppression, strokes,
    profiles: data.version === 1 ? structuredClone(DEFAULT_PARTICLE_PROFILES) : parseParticleProfiles(data.profiles, data.version >= 4),
    structure: data.version >= 4 ? parsePortraitStructureSettings(data.structure) : { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS },
    editor: parseEditorSettings(data.editor, data.version < 3) }
}

function parseEditorSettings(value: unknown, legacy = false): PortraitEditorSettings {
  if (value === undefined) return { ...DEFAULT_PORTRAIT_EDITOR_SETTINGS }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки кисти в проекте.')
  const input = value as Record<string, unknown>
  const limits: Record<keyof PortraitEditorSettings, readonly [number, number]> = {
    maskOpacity: [0.05, 1], brushSize: [1, 300], brushSoftness: [0, 1], brushIntensity: [0.05, 1], brushValue: [0, 255],
    strokeSpacing: [3, 40], strokeWidth: [0, 60], strokeJitter: [0, 20], strokeBrightness: [0.2, 2], strokeSmooth: [0, 1], strokeSize: [0.4, 3],
  }
  const result = {} as PortraitEditorSettings
  for (const key of Object.keys(limits) as (keyof PortraitEditorSettings)[]) {
    const field = input[key] === undefined && legacy ? DEFAULT_PORTRAIT_EDITOR_SETTINGS[key] : input[key], [minimum, maximum] = limits[key]
    if (typeof field !== 'number' || !Number.isFinite(field) || field < minimum || field > maximum) throw new Error(`Некорректная настройка кисти: ${key}.`)
    result[key] = field
  }
  return result
}
