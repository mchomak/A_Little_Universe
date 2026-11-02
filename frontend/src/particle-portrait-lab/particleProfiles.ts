export type ParticleKind = 'contour' | 'support' | 'flow' | 'fill'
export type ParticleProfile = { density: number; size: number; brightness: number; jitter: number }
export type ParticleProfiles = Record<ParticleKind, ParticleProfile>

export type PortraitStructureSettings = {
  contourMinSpacing: number
  supportWidth: number
  supportMix: number
  fillSuppression: number
  minFaceFill: number
}

export const DEFAULT_PARTICLE_PROFILES: ParticleProfiles = {
  contour: { density: 0.7, size: 0.9, brightness: 0.78, jitter: 0.55 },
  support: { density: 1, size: 0.78, brightness: 0.46, jitter: 1.2 },
  flow: { density: 1, size: 1, brightness: 1, jitter: 1 },
  fill: { density: 1, size: 0.8, brightness: 0.7, jitter: 1 },
}

export const DEFAULT_PORTRAIT_STRUCTURE_SETTINGS: PortraitStructureSettings = {
  contourMinSpacing: 6,
  supportWidth: 26,
  supportMix: 0.2,
  fillSuppression: 0.28,
  minFaceFill: 0.24,
}

const PARTICLE_KINDS = ['contour', 'flow', 'fill'] as const

export function parseParticleProfiles(value: unknown, includeSupport = true): ParticleProfiles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки типов частиц.')
  const input = value as Record<string, unknown>
  const result = { support: { ...DEFAULT_PARTICLE_PROFILES.support } } as ParticleProfiles
  for (const kind of PARTICLE_KINDS) {
    const profile = input[kind]
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error(`Некорректный тип частиц: ${kind}.`)
    result[kind] = parseProfile(kind, profile)
  }
  if (includeSupport) result.support = parseProfile('support', input.support)
  return result
}

function parseProfile(kind: ParticleKind, profile: unknown): ParticleProfile {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error(`Некорректный тип частиц: ${kind}.`)
  const item = profile as Record<string, unknown>
  const keys = ['density', 'size', 'brightness', 'jitter'] as const
  for (const key of keys) {
    if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0 || item[key] > 2) throw new Error(`Некорректный параметр ${kind}.${key}.`)
  }
  return { density: item.density as number, size: item.size as number, brightness: item.brightness as number, jitter: item.jitter as number }
}

export function parsePortraitStructureSettings(value: unknown, allowDefaults = false): PortraitStructureSettings {
  if (value === undefined && allowDefaults) return { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки структуры портрета.')
  const input = value as Record<string, unknown>
  const limits: Record<keyof PortraitStructureSettings, readonly [number, number]> = {
    contourMinSpacing: [3, 40], supportWidth: [2, 160], supportMix: [0, 0.7], fillSuppression: [0, 1], minFaceFill: [0, 1],
  }
  const result = {} as PortraitStructureSettings
  for (const key of Object.keys(limits) as (keyof PortraitStructureSettings)[]) {
    const current = input[key], [minimum, maximum] = limits[key]
    if (typeof current !== 'number' || !Number.isFinite(current) || current < minimum || current > maximum) throw new Error(`Некорректная настройка структуры портрета: ${key}.`)
    result[key] = current
  }
  return result
}
