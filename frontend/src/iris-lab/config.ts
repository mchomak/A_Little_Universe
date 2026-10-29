import { hexToOklch, oklchToHex } from './gradingMath'

export type IrisColorGrading = {
  enabled: boolean
  strength: number
  targetBlueHue: number
  blueChroma: number
  grayRecolorStrength: number
  lightnessPreservation: number
  brightness: number
  contrast: number
  innerZoneRadius: number
  amberHue: number
  amberChroma: number
  amberPreservation: number
  amberTransitionWidth: number
  middleBlueHue: number
  middleBlueChroma: number
  middleColorStrength: number
  outerZoneStart: number
  outerBlueHue: number
  outerBlueChroma: number
  outerColorStrength: number
  limbalRingHue: number
  limbalRingChroma: number
  limbalRingDarkness: number
  mainBlueColor: string
  outerBlueColor: string
  darkRimColor: string
  amberColor: string
  fiberArtisticColor: string
  fiberArtisticMix: number
}

export type LabConfig = {
  version: 3
  camera: { distance: number; azimuth: number; elevation: number; fov: number; targetX: number; targetY: number; autoRotate: boolean; autoSpeed: number; locked: boolean }
  eye: { scale: number; irisRadius: number; pupilRadius: number; irisDepth: number; corneaScale: number; corneaCurvature: number }
  material: { scleraTint: string; roughness: number; reflection: number; corneaOpacity: number; corneaRoughness: number; irisBrightness: number; irisContrast: number; irisSaturation: number; irisDetail: number }
  lighting: { key: number; keyColor: string; keyX: number; keyY: number; fill: number; rim: number; ambient: number; environment: number; background: string }
  particles: { density: number; size: number; sizeVariation: number; glow: number; opacity: number; brightness: number; depth: number; movement: number; speed: number; twinkle: number }
  fibers: { density: number; secondaryDensity: number; length: number; secondaryLength: number; thickness: number; secondaryThickness: number; curvature: number; secondaryCurvature: number; brightness: number; secondaryBrightness: number; branching: number; glow: number; secondaryGlow: number; colorVariation: number; secondaryColorVariation: number; movement: number; secondaryMovement: number }
  effects: { mix: number; glow: number; glowColor: string; bloomThreshold: number; bloomRadius: number; exposure: number; toneMapping: number; antialias: boolean; paused: boolean; dpr: number }
  layers: { eyeball: boolean; iris: boolean; pupil: boolean; cornea: boolean; eyelids: boolean; eyelashes: boolean; primaryFibers: boolean; secondaryFibers: boolean; microParticles: boolean; highlightParticles: boolean; atmosphericGlow: boolean; bloom: boolean }
  colorGrading: IrisColorGrading
}

export type CameraConfig = LabConfig['camera']
export type LabStats = { fps: number; drawCalls: number; particles: number; geometries: number; textures: number; dpr: number; status: string }
export type IrisPreviewState = { previewGrading: boolean; albedoOnly: boolean }
export type IrisPreviewAction = keyof IrisPreviewState

const linkedColorFields = {
  mainBlueColor: { hue: 'targetBlueHue', chroma: 'blueChroma', lightness: 0.68 },
  outerBlueColor: { hue: 'outerBlueHue', chroma: 'outerBlueChroma', lightness: 0.58 },
  darkRimColor: { hue: 'limbalRingHue', chroma: 'limbalRingChroma', lightness: 0.38 },
  amberColor: { hue: 'amberHue', chroma: 'amberChroma', lightness: 0.68 },
} as const

type LinkedColorField = keyof typeof linkedColorFields
export type GradingColorField = LinkedColorField | 'fiberArtisticColor'

export function updateGradingColor(settings: IrisColorGrading, field: GradingColorField, hex: string): IrisColorGrading {
  const color = hexToOklch(hex)
  if (field === 'fiberArtisticColor') return { ...settings, fiberArtisticColor: hex }
  const link = linkedColorFields[field]
  return { ...settings, [field]: hex, [link.hue]: color.h, [link.chroma]: color.c }
}

/** Update one persisted slider and keep its linked picker in sync in both directions. */
export function updateGradingSetting(settings: IrisColorGrading, field: keyof IrisColorGrading, value: number | boolean): IrisColorGrading {
  const next = { ...settings, [field]: value } as IrisColorGrading
  if (field === 'innerZoneRadius' || field === 'amberTransitionWidth') {
    next.outerZoneStart = Math.max(next.outerZoneStart, next.innerZoneRadius + next.amberTransitionWidth * 2)
  } else if (field === 'outerZoneStart') {
    const outerStart = value as number
    const innerRadiusLimit = outerStart - next.amberTransitionWidth * 2
    if (innerRadiusLimit >= 0.08) next.innerZoneRadius = Math.min(next.innerZoneRadius, innerRadiusLimit)
    else {
      next.innerZoneRadius = 0.08
      next.amberTransitionWidth = Math.max(0.04, (outerStart - next.innerZoneRadius) / 2)
    }
  }
  const linked = (Object.entries(linkedColorFields) as [LinkedColorField, (typeof linkedColorFields)[LinkedColorField]][])
    .find(([, link]) => link.hue === field || link.chroma === field)
  if (!linked) return next

  const [colorField, link] = linked
  const lightness = hexToOklch(settings[colorField]).l || link.lightness
  const hue = next[link.hue]
  const chroma = next[link.chroma]
  return { ...next, [colorField]: oklchToHex({ l: lightness, c: chroma, h: hue }) }
}

/** These view-only flags intentionally live outside LabConfig and are never serialized. */
export function toggleIrisPreview(state: IrisPreviewState, action: IrisPreviewAction): IrisPreviewState {
  return { ...state, [action]: !state[action] }
}

type GradingValues = Omit<IrisColorGrading, 'mainBlueColor' | 'outerBlueColor' | 'darkRimColor' | 'amberColor'>
const basePickerColors: Record<LinkedColorField, string> = {
  mainBlueColor: '#7899c2', outerBlueColor: '#667f9e', darkRimColor: '#394b66', amberColor: '#bc9057',
}

function makeGrading(values: GradingValues): IrisColorGrading {
  const settings = { ...values, ...basePickerColors } as IrisColorGrading
  for (const [field, link] of Object.entries(linkedColorFields) as [LinkedColorField, (typeof linkedColorFields)[LinkedColorField]][]) {
    settings[field] = oklchToHex({ l: hexToOklch(basePickerColors[field]).l, h: settings[link.hue], c: settings[link.chroma] })
  }
  return settings
}

const originalGrading = makeGrading({
  enabled: true, strength: 0, targetBlueHue: 238, blueChroma: 0.07, grayRecolorStrength: 0.75, lightnessPreservation: 1, brightness: 0, contrast: 1,
  innerZoneRadius: 0.2, amberHue: 76, amberChroma: 0.09, amberPreservation: 0.96, amberTransitionWidth: 0.09,
  middleBlueHue: 238, middleBlueChroma: 0.075, middleColorStrength: 0.9, outerZoneStart: 0.74, outerBlueHue: 231, outerBlueChroma: 0.052, outerColorStrength: 0.72,
  limbalRingHue: 226, limbalRingChroma: 0.028, limbalRingDarkness: 0.18, fiberArtisticColor: '#9abde3', fiberArtisticMix: 0.12,
})

export const irisGradingPresets = {
  Original: makeGrading({ ...originalGrading, enabled: true, strength: 0, fiberArtisticMix: 0 }),
  'Vasilisa Natural Blue': makeGrading({
    ...originalGrading, strength: 0.82, targetBlueHue: 239, blueChroma: 0.064, grayRecolorStrength: 0.78, lightnessPreservation: 0.97,
    innerZoneRadius: 0.2, amberHue: 76, amberChroma: 0.095, amberPreservation: 0.97, amberTransitionWidth: 0.095,
    middleBlueHue: 238, middleBlueChroma: 0.071, middleColorStrength: 0.88, outerZoneStart: 0.76, outerBlueHue: 232, outerBlueChroma: 0.048, outerColorStrength: 0.68,
    limbalRingHue: 225, limbalRingChroma: 0.027, limbalRingDarkness: 0.2, fiberArtisticMix: 0.12,
  }),
  'Cool Blue': makeGrading({
    ...originalGrading, strength: 0.88, targetBlueHue: 224, blueChroma: 0.078, grayRecolorStrength: 0.83, lightnessPreservation: 0.97,
    middleBlueHue: 226, middleBlueChroma: 0.079, middleColorStrength: 0.92, outerZoneStart: 0.74, outerBlueHue: 222, outerBlueChroma: 0.058, outerColorStrength: 0.82,
    limbalRingHue: 220, limbalRingChroma: 0.036, limbalRingDarkness: 0.24, fiberArtisticMix: 0.18,
  }),
  'Full Blue Recolor': makeGrading({
    ...originalGrading, strength: 1, targetBlueHue: 238, blueChroma: 0.092, grayRecolorStrength: 1, lightnessPreservation: 1,
    amberPreservation: 0.92, middleBlueHue: 237, middleBlueChroma: 0.09, middleColorStrength: 1, outerZoneStart: 0.7, outerBlueHue: 231, outerBlueChroma: 0.07, outerColorStrength: 1,
    limbalRingHue: 226, limbalRingChroma: 0.041, limbalRingDarkness: 0.2, fiberArtisticMix: 0.14,
  }),
  'Cinematic Blue': makeGrading({
    ...originalGrading, strength: 0.92, targetBlueHue: 231, blueChroma: 0.081, grayRecolorStrength: 0.86, lightnessPreservation: 0.9, brightness: -0.008, contrast: 1.08,
    amberPreservation: 0.9, middleBlueHue: 230, middleBlueChroma: 0.084, middleColorStrength: 0.94, outerZoneStart: 0.73, outerBlueHue: 224, outerBlueChroma: 0.063, outerColorStrength: 0.88,
    limbalRingHue: 220, limbalRingChroma: 0.035, limbalRingDarkness: 0.28, fiberArtisticMix: 0.3,
  }),
} as const satisfies Record<string, IrisColorGrading>

export const defaults: LabConfig = {
  version: 3,
  camera: { distance: 4.5, azimuth: 0, elevation: 0, fov: 38, targetX: 0, targetY: 0, autoRotate: false, autoSpeed: 0.15, locked: false },
  eye: { scale: 1, irisRadius: 0.55, pupilRadius: 0.105, irisDepth: 0, corneaScale: 1, corneaCurvature: 1 },
  material: { scleraTint: '#d6c9c5', roughness: 0.45, reflection: 0.65, corneaOpacity: 0.26, corneaRoughness: 0.12, irisBrightness: 1, irisContrast: 1, irisSaturation: 1, irisDetail: 1 },
  lighting: { key: 2, keyColor: '#dceaff', keyX: -3, keyY: 4, fill: 0.6, rim: 1, ambient: 0.35, environment: 0.5, background: '#101418' },
  particles: { density: 0.5, size: 1.1, sizeVariation: 0.4, glow: 0.5, opacity: 0.55, brightness: 0.8, depth: 0.015, movement: 0.02, speed: 0.5, twinkle: 0.2 },
  fibers: { density: 0.5, secondaryDensity: 0.5, length: 1, secondaryLength: 1, thickness: 1, secondaryThickness: 1, curvature: 0.2, secondaryCurvature: 0.2, brightness: 0.55, secondaryBrightness: 0.55, branching: 0.4, glow: 0.5, secondaryGlow: 0.5, colorVariation: 0.35, secondaryColorVariation: 0.35, movement: 0.1, secondaryMovement: 0.1 },
  effects: { mix: 0.2, glow: 0.25, glowColor: '#b8dcff', bloomThreshold: 0.8, bloomRadius: 0.3, exposure: 1, toneMapping: 2, antialias: true, paused: false, dpr: 1.5 },
  layers: { eyeball: true, iris: true, pupil: true, cornea: true, eyelids: true, eyelashes: true, primaryFibers: true, secondaryFibers: true, microParticles: true, highlightParticles: true, atmosphericGlow: true, bloom: true },
  colorGrading: irisGradingPresets.Original,
}

const copy = (config: LabConfig): LabConfig => structuredClone(config)
export const builtInPresets: Record<string, LabConfig> = {
  'Natural Eye': { ...copy(defaults), effects: { ...defaults.effects, mix: 0, glow: 0.05 }, particles: { ...defaults.particles, opacity: 0.18 }, fibers: { ...defaults.fibers, brightness: 0.15 } },
  'Soft Cinematic': copy(defaults),
  'Luminous Fibers': { ...copy(defaults), effects: { ...defaults.effects, mix: 0.55, glow: 0.55 }, fibers: { ...defaults.fibers, density: 0.85, brightness: 1.1 }, particles: { ...defaults.particles, brightness: 1 } },
  'Cosmic Blue': { ...copy(defaults), effects: { ...defaults.effects, mix: 0.9, glow: 0.7 }, lighting: { ...defaults.lighting, keyColor: '#a8cfff', background: '#080f1e' }, particles: { ...defaults.particles, brightness: 1.2 } },
  'Detail Inspection': { ...copy(defaults), camera: { ...defaults.camera, distance: 2.2 }, effects: { ...defaults.effects, paused: true, glow: 0.05 }, particles: { ...defaults.particles, opacity: 0.25 } },
}

export const cameraViews: Record<string, CameraConfig> = {
  'Full Eye': { ...defaults.camera },
  'Iris Close-up': { ...defaults.camera, distance: 2.5 },
  'Macro Iris': { ...defaults.camera, distance: 1.55 },
  'Three-quarter View': { ...defaults.camera, distance: 4, azimuth: 0.45, elevation: 0.16 },
}

const limits: Record<string, [number, number]> = {
  'camera.distance': [1.3, 8], 'camera.azimuth': [-1, 1], 'camera.elevation': [-0.8, 0.8], 'camera.fov': [20, 75], 'camera.targetX': [-1, 1], 'camera.targetY': [-1, 1], 'camera.autoSpeed': [0, 1],
  'eye.scale': [0.7, 1.3], 'eye.irisRadius': [0.4, 0.7], 'eye.pupilRadius': [0.08, 0.3], 'eye.irisDepth': [-0.1, 0.1], 'eye.corneaScale': [0.8, 1.2], 'eye.corneaCurvature': [0.5, 1.5],
  'material.roughness': [0, 1], 'material.reflection': [0, 2], 'material.corneaOpacity': [0, 0.8], 'material.corneaRoughness': [0, 1], 'material.irisBrightness': [0.2, 2], 'material.irisContrast': [0.2, 2], 'material.irisSaturation': [0, 2], 'material.irisDetail': [0, 2],
  'lighting.key': [0, 5], 'lighting.keyX': [-8, 8], 'lighting.keyY': [-8, 8], 'lighting.fill': [0, 3], 'lighting.rim': [0, 3], 'lighting.ambient': [0, 2], 'lighting.environment': [0, 2],
  'particles.sizeVariation': [0, 1], 'particles.glow': [0, 2], 'particles.density': [0, 1], 'particles.size': [0.1, 4], 'particles.opacity': [0, 1], 'particles.brightness': [0, 2], 'particles.depth': [0, 0.2], 'particles.movement': [0, 0.2], 'particles.speed': [0, 3], 'particles.twinkle': [0, 1],
  'fibers.secondaryThickness': [0.1, 3], 'fibers.secondaryCurvature': [0, 1], 'fibers.secondaryGlow': [0, 2], 'fibers.secondaryColorVariation': [0, 1], 'fibers.secondaryMovement': [0, 1], 'fibers.branching': [0, 1], 'fibers.glow': [0, 2], 'fibers.colorVariation': [0, 1], 'fibers.movement': [0, 1], 'fibers.density': [0, 1], 'fibers.secondaryDensity': [0, 1], 'fibers.secondaryLength': [0.2, 2], 'fibers.secondaryBrightness': [0, 2], 'fibers.length': [0.2, 2], 'fibers.thickness': [0.1, 3], 'fibers.curvature': [0, 1], 'fibers.brightness': [0, 2],
  'effects.bloomThreshold': [0, 2], 'effects.bloomRadius': [0, 1], 'effects.mix': [0, 1], 'effects.glow': [0, 2], 'effects.exposure': [0.3, 2], 'effects.toneMapping': [0, 2], 'effects.dpr': [0.5, 2],
  'colorGrading.strength': [0, 1], 'colorGrading.targetBlueHue': [0, 360], 'colorGrading.blueChroma': [0, 0.4], 'colorGrading.grayRecolorStrength': [0, 1], 'colorGrading.lightnessPreservation': [0, 1], 'colorGrading.brightness': [-0.25, 0.25], 'colorGrading.contrast': [0.5, 1.5],
  'colorGrading.innerZoneRadius': [0.08, 0.45], 'colorGrading.amberHue': [0, 360], 'colorGrading.amberChroma': [0, 0.4], 'colorGrading.amberPreservation': [0, 1], 'colorGrading.amberTransitionWidth': [0.04, 0.16],
  'colorGrading.middleBlueHue': [0, 360], 'colorGrading.middleBlueChroma': [0, 0.4], 'colorGrading.middleColorStrength': [0, 1], 'colorGrading.outerZoneStart': [0.45, 0.98], 'colorGrading.outerBlueHue': [0, 360], 'colorGrading.outerBlueChroma': [0, 0.4], 'colorGrading.outerColorStrength': [0, 1],
  'colorGrading.limbalRingHue': [0, 360], 'colorGrading.limbalRingChroma': [0, 0.4], 'colorGrading.limbalRingDarkness': [0, 0.5], 'colorGrading.fiberArtisticMix': [0, 1],
}

const legacyLimits: Record<string, [number, number]> = {
  hueShift: [-60, 60], saturation: [0, 2], vibrance: [0, 1], blueCyanBalance: [0, 1], greenReduction: [0, 1], brightness: [-0.3, 0.3], contrast: [0.5, 1.5], amberPreservation: [0, 1], strength: [0, 1],
}
const legacyKeys = Object.keys(legacyLimits)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrapHue = (value: number) => ((value % 360) + 360) % 360

function validateGroup(group: string, source: unknown, target: Record<string, unknown>) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`Invalid group: ${group}`)
  const values = source as Record<string, unknown>
  for (const key of Object.keys(target)) {
    const next = values[key]
    if (typeof next !== typeof target[key] || (typeof next === 'number' && !Number.isFinite(next)) || (typeof next === 'string' && !/^#[0-9a-f]{6}$/i.test(next))) throw new Error(`Invalid setting: ${group}.${key}`)
    const bounds = limits[`${group}.${key}`]
    if (typeof next === 'number' && (!bounds || next < bounds[0] || next > bounds[1])) throw new Error(`Out of range: ${group}.${key}`)
    if (group === 'effects' && key === 'toneMapping' && !Number.isInteger(next)) throw new Error('Invalid tone mapping')
    target[key] = next
  }
}

function migrateLegacyGrading(source: unknown, version: number): IrisColorGrading {
  if (source === undefined && version === 1) return copy(defaults).colorGrading
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid group: colorGrading')
  const old = source as Record<string, unknown>
  for (const key of legacyKeys) {
    const value = old[key]
    const range = legacyLimits[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid setting: colorGrading.${key}`)
    if (value < range![0] || value > range![1]) throw new Error(`Out of range: colorGrading.${key}`)
  }
  const hueShift = old.hueShift as number
  const blueCyanBalance = old.blueCyanBalance as number
  const saturation = old.saturation as number
  const vibrance = old.vibrance as number
  const greenReduction = old.greenReduction as number
  const targetHue = wrapHue(238 + hueShift - greenReduction * 7)
  return makeGrading({
    ...originalGrading, enabled: true,
    strength: old.strength as number, targetBlueHue: targetHue,
    blueChroma: clamp(0.045 * saturation + vibrance * 0.025, 0, 0.16),
    grayRecolorStrength: blueCyanBalance,
    brightness: old.brightness as number, contrast: old.contrast as number,
    amberPreservation: old.amberPreservation as number,
    middleBlueHue: targetHue, middleBlueChroma: clamp(0.05 * saturation + vibrance * 0.025, 0, 0.16), middleColorStrength: blueCyanBalance,
    outerBlueHue: wrapHue(targetHue - 7), outerBlueChroma: clamp(0.035 * saturation + vibrance * 0.018, 0, 0.14), outerColorStrength: blueCyanBalance,
  })
}

/** Whitelist known fields, migrate v1/v2 input, and reject malformed or out-of-range settings. */
export function parseConfig(value: unknown): LabConfig {
  if (!value || typeof value !== 'object') throw new Error('Unsupported or missing configuration version')
  const input = value as Record<string, unknown>
  const version = input.version
  if (version !== 1 && version !== 2 && version !== 3) throw new Error('Unsupported or missing configuration version')

  const result = copy(defaults)
  for (const group of Object.keys(result) as (keyof LabConfig)[]) {
    if (group === 'version' || group === 'colorGrading') continue
    validateGroup(group, input[group], result[group] as unknown as Record<string, unknown>)
  }

  if (version < 3) {
    result.colorGrading = migrateLegacyGrading(input.colorGrading, version)
  } else {
    validateGroup('colorGrading', input.colorGrading, result.colorGrading as unknown as Record<string, unknown>)
    const grade = result.colorGrading
    const minimumOuterStart = grade.innerZoneRadius + grade.amberTransitionWidth * 2
    if (grade.outerZoneStart < minimumOuterStart) throw new Error('Outer zone must begin after the inner amber transition')
  }

  result.version = 3
  return result
}

export function identifyIrisGradingPreset(settings: IrisColorGrading): keyof typeof irisGradingPresets | 'Manual' {
  for (const [name, preset] of Object.entries(irisGradingPresets)) {
    if ((Object.keys(preset) as (keyof IrisColorGrading)[]).every((key) => settings[key] === preset[key])) return name as keyof typeof irisGradingPresets
  }
  return 'Manual'
}
