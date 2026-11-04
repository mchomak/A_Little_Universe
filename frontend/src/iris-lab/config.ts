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

export type BlueEyeSettings = {
  irisCenterX: number; irisCenterY: number; irisRadiusX: number; irisRadiusY: number; irisRotation: number
  pupilCenterX: number; pupilCenterY: number; pupilRadiusX: number; pupilRadiusY: number; pupilRotation: number
  irisFocus: number; outerEyeFade: number; irisColorStrength: number; pupilDarkness: number; particleDepth: number
  particleDensity: number; particleSize: number; particleOpacity: number; particleBrightness: number; particleScatter: number
  fiberDensity: number; fiberLength: number; fiberCurvature: number; fiberThickness: number; fiberBrightness: number; fiberOpacity: number; fiberNoiseScale: number; fiberDepth: number; fiberAnimationSpeed: number
  bloomStrength: number
  showSourceParticles: boolean; showFiberRibbons: boolean; showFiberSparks: boolean
}

export type LabConfig = {
  version: 6
  display: { mode: 'Original' | 'Memory Signal' | 'Memory Signal Baseline' | 'Blue Particle Eye' | 'Cinematic Fiber Iris' | 'Run 017 Blue Fibers' | 'Fire Eye Fibers' | 'Hybrid'; showModel: boolean; modelOpacity: number; particleOpacity: number; fiberOpacity: number }
  camera: { distance: number; azimuth: number; elevation: number; fov: number; targetX: number; targetY: number; autoRotate: boolean; autoSpeed: number; locked: boolean }
  eye: { scale: number; irisRadius: number; pupilRadius: number; irisDepth: number; corneaScale: number; corneaCurvature: number }
  material: { scleraTint: string; roughness: number; reflection: number; corneaOpacity: number; corneaRoughness: number; irisBrightness: number; irisContrast: number; irisSaturation: number; irisDetail: number }
  lighting: { key: number; keyColor: string; keyX: number; keyY: number; fill: number; rim: number; ambient: number; environment: number; background: string }
  particles: { density: number; size: number; sizeVariation: number; glow: number; opacity: number; brightness: number; depth: number; movement: number; speed: number; twinkle: number }
  fibers: { density: number; secondaryDensity: number; length: number; secondaryLength: number; thickness: number; secondaryThickness: number; curvature: number; secondaryCurvature: number; brightness: number; secondaryBrightness: number; branching: number; glow: number; secondaryGlow: number; colorVariation: number; secondaryColorVariation: number; movement: number; secondaryMovement: number; opacity: number; noiseScale: number; fineFrequency: number; coarseFrequency: number; radialAlignment: number; depth: number; animationSpeed: number }
  memorySignal: { zRelief: number; noiseStrength: number; edgeDiffusion: number; brightnessThreshold: number; backgroundThreshold: number; alphaThreshold: number; colorIntensity: number; scatter: number; maxPoints: number }
  blueEye: BlueEyeSettings
  effects: { mix: number; glow: number; glowColor: string; bloomThreshold: number; bloomRadius: number; exposure: number; toneMapping: number; antialias: boolean; paused: boolean; dpr: number }
  layers: { eyeball: boolean; iris: boolean; pupil: boolean; cornea: boolean; eyelids: boolean; eyelashes: boolean; primaryFibers: boolean; secondaryFibers: boolean; microParticles: boolean; highlightParticles: boolean; atmosphericGlow: boolean; bloom: boolean; memorySignal: boolean; proceduralFibers: boolean }
  colorGrading: IrisColorGrading
}

export type CameraConfig = LabConfig['camera']
export type IrisViewMode = LabConfig['display']['mode']
export type LabStats = { fps: number; drawCalls: number; particles: number; geometries: number; textures: number; dpr: number; status: string }
export type IrisPreviewState = { previewGrading: boolean; albedoOnly: boolean }
export type IrisPreviewAction = keyof IrisPreviewState

export function isPhotoIrisMode(mode: IrisViewMode): boolean {
  return mode === 'Blue Particle Eye' || mode === 'Cinematic Fiber Iris' || mode === 'Run 017 Blue Fibers'
}

export function getIrisBloomSettings(config: LabConfig): { enabled: boolean; strength: number } {
  const photoIris = isPhotoIrisMode(config.display.mode)
  const strength = photoIris ? config.blueEye.bloomStrength : config.effects.glow
  return { enabled: config.layers.bloom && (!photoIris || strength > 0), strength }
}

/** Selects a view composition while leaving camera, grading and other adjustments intact. */
export function applyViewMode(config: LabConfig, mode: IrisViewMode): LabConfig {
  const hybrid = mode === 'Hybrid'
  const run017 = mode === 'Run 017 Blue Fibers'
  return {
    ...config,
    display: { ...config.display, mode, showModel: mode === 'Original' || hybrid },
    ...(run017 ? { blueEye: { ...config.blueEye, irisCenterX: 0.5, irisCenterY: 0.5, irisRadiusX: 0.46, irisRadiusY: 0.46, pupilCenterX: 0.5, pupilCenterY: 0.5, pupilRadiusX: 0.08, pupilRadiusY: 0.08 } } : {}),
    layers: {
      ...config.layers,
      memorySignal: mode === 'Memory Signal' || hybrid,
      proceduralFibers: mode === 'Fire Eye Fibers' || hybrid,
      ...(!hybrid ? { primaryFibers: false, secondaryFibers: false, microParticles: false, highlightParticles: false, atmosphericGlow: false } : {}),
      ...(hybrid ? { primaryFibers: true, secondaryFibers: true, microParticles: true, highlightParticles: true, atmosphericGlow: true } : {}),
    },
  }
}

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
  version: 6,
  display: { mode: 'Original', showModel: true, modelOpacity: 1, particleOpacity: 0.9, fiberOpacity: 0.86 },
  camera: { distance: 4.5, azimuth: 0, elevation: 0, fov: 38, targetX: 0, targetY: 0, autoRotate: false, autoSpeed: 0.15, locked: false },
  eye: { scale: 1, irisRadius: 0.55, pupilRadius: 0.105, irisDepth: 0, corneaScale: 1, corneaCurvature: 1 },
  material: { scleraTint: '#d6c9c5', roughness: 0.45, reflection: 0.65, corneaOpacity: 0.26, corneaRoughness: 0.12, irisBrightness: 1, irisContrast: 1, irisSaturation: 1, irisDetail: 1 },
  lighting: { key: 2, keyColor: '#dceaff', keyX: -3, keyY: 4, fill: 0.6, rim: 1, ambient: 0.35, environment: 0.5, background: '#101418' },
  particles: { density: 0.5, size: 1.1, sizeVariation: 0.4, glow: 0.5, opacity: 0.55, brightness: 0.8, depth: 0.015, movement: 0.02, speed: 0.5, twinkle: 0.2 },
  fibers: { density: 0.5, secondaryDensity: 0.5, length: 1, secondaryLength: 1, thickness: 1, secondaryThickness: 1, curvature: 0.2, secondaryCurvature: 0.2, brightness: 0.55, secondaryBrightness: 0.55, branching: 0.4, glow: 0.5, secondaryGlow: 0.5, colorVariation: 0.35, secondaryColorVariation: 0.35, movement: 0.1, secondaryMovement: 0.1, opacity: 0.86, noiseScale: 7, fineFrequency: 72, coarseFrequency: 18, radialAlignment: 0.88, depth: 0.014, animationSpeed: 0.018 },
  memorySignal: { zRelief: 0.12, noiseStrength: 0.028, edgeDiffusion: 0.8, brightnessThreshold: 0.045, backgroundThreshold: 0.16, alphaThreshold: 0.08, colorIntensity: 1.65, scatter: 0.018, maxPoints: 220000 },
  // Calibrated to the visible iris ellipse in images/eye_3_1.png; the pupil is slightly above its center.
  blueEye: { irisCenterX: 0.435, irisCenterY: 0.49, irisRadiusX: 0.215, irisRadiusY: 0.16, irisRotation: 0, pupilCenterX: 0.436, pupilCenterY: 0.44, pupilRadiusX: 0.059, pupilRadiusY: 0.044, pupilRotation: 0, irisFocus: 1, outerEyeFade: 1, irisColorStrength: 1, pupilDarkness: 0.985, particleDepth: 0.12, particleDensity: 0.3, particleSize: 1.2, particleOpacity: 1, particleBrightness: 1.3, particleScatter: 0.001, fiberDensity: 0.84, fiberLength: 1.08, fiberCurvature: 0.78, fiberThickness: 1.1, fiberBrightness: 1.16, fiberOpacity: 0.92, fiberNoiseScale: 4.2, fiberDepth: 0.2, fiberAnimationSpeed: 0.02, bloomStrength: 0, showSourceParticles: true, showFiberRibbons: true, showFiberSparks: true },
  effects: { mix: 0.2, glow: 0.25, glowColor: '#b8dcff', bloomThreshold: 0.8, bloomRadius: 0.3, exposure: 1, toneMapping: 2, antialias: true, paused: false, dpr: 1.5 },
  layers: { eyeball: true, iris: true, pupil: true, cornea: true, eyelids: true, eyelashes: true, primaryFibers: true, secondaryFibers: true, microParticles: true, highlightParticles: true, atmosphericGlow: true, bloom: true, memorySignal: false, proceduralFibers: false },
  colorGrading: irisGradingPresets.Original,
}

const copy = (config: LabConfig): LabConfig => structuredClone(config)
export const builtInPresets: Record<string, LabConfig> = {
  'Natural Eye': { ...copy(defaults), effects: { ...defaults.effects, mix: 0, glow: 0.05 }, particles: { ...defaults.particles, opacity: 0.18 }, fibers: { ...defaults.fibers, brightness: 0.15 } },
  'Soft Cinematic': copy(defaults),
  'Luminous Fibers': { ...copy(defaults), effects: { ...defaults.effects, mix: 0.55, glow: 0.55 }, fibers: { ...defaults.fibers, density: 0.85, brightness: 1.1 }, particles: { ...defaults.particles, brightness: 1 } },
  'Cosmic Blue': { ...copy(defaults), effects: { ...defaults.effects, mix: 0.9, glow: 0.7 }, lighting: { ...defaults.lighting, keyColor: '#a8cfff', background: '#080f1e' }, particles: { ...defaults.particles, brightness: 1.2 } },
  'Detail Inspection': { ...copy(defaults), camera: { ...defaults.camera, distance: 2.2 }, effects: { ...defaults.effects, paused: true, glow: 0.05 }, particles: { ...defaults.particles, opacity: 0.25 } },
  Original: { ...copy(defaults), display: { ...defaults.display, mode: 'Original' }, layers: { ...defaults.layers, memorySignal: false, proceduralFibers: false } },
  'Memory Signal': { ...copy(defaults), display: { ...defaults.display, mode: 'Memory Signal', showModel: false }, particles: { ...defaults.particles, density: 0.92, size: 0.88, brightness: 1.12, depth: 0.025 }, effects: { ...defaults.effects, glow: 0.32, glowColor: '#a9d8ff' }, layers: { ...defaults.layers, memorySignal: true, proceduralFibers: false, primaryFibers: false, secondaryFibers: false, microParticles: false, highlightParticles: false, atmosphericGlow: false } },
  'Blue Particle Eye': applyViewMode(copy(defaults), 'Blue Particle Eye'),
  'Cinematic Fiber Iris': { ...applyViewMode(copy(defaults), 'Cinematic Fiber Iris'), fibers: { ...defaults.fibers, density: 0.86, secondaryDensity: 0.72, length: 1.12, secondaryLength: 0.82, thickness: 1.15, secondaryThickness: 0.72, curvature: 0.64, secondaryCurvature: 0.58, brightness: 0.92, secondaryBrightness: 0.72, branching: 0.25, glow: 0.35, secondaryGlow: 0.2, opacity: 0.92, noiseScale: 4.2 } },
  'Run 017 Blue Fibers': { ...applyViewMode(copy(defaults), 'Run 017 Blue Fibers'), camera: { ...defaults.camera, distance: 3.25 }, blueEye: { ...defaults.blueEye, irisCenterX: 0.5, irisCenterY: 0.5, irisRadiusX: 0.46, irisRadiusY: 0.46, pupilCenterX: 0.5, pupilCenterY: 0.5, pupilRadiusX: 0.08, pupilRadiusY: 0.08, irisFocus: 1, outerEyeFade: 1, irisColorStrength: 1, pupilDarkness: 0.99, particleDensity: 0.3, particleSize: 1.2, particleBrightness: 1.3, fiberDensity: 0.84, fiberLength: 1.08, fiberCurvature: 0.78, fiberThickness: 1.1, fiberBrightness: 1.16, fiberDepth: 0.2, bloomStrength: 0 } },
  'Blue Fibers': { ...copy(defaults), display: { ...defaults.display, mode: 'Fire Eye Fibers', showModel: false }, fibers: { ...defaults.fibers, density: 0.72, secondaryDensity: 0.44, brightness: 0.8, opacity: 0.92 }, colorGrading: irisGradingPresets['Vasilisa Natural Blue'], layers: { ...defaults.layers, memorySignal: false, proceduralFibers: true, microParticles: false, highlightParticles: false, atmosphericGlow: false, primaryFibers: false, secondaryFibers: false } },
  'Hybrid Cinematic': { ...copy(defaults), display: { ...defaults.display, mode: 'Hybrid' }, particles: { ...defaults.particles, density: 0.88, size: 0.92, brightness: 0.96 }, fibers: { ...defaults.fibers, density: 0.8, secondaryDensity: 0.56, brightness: 0.72, opacity: 0.88 }, effects: { ...defaults.effects, glow: 0.55, glowColor: '#9ccaff', bloomThreshold: 0.64 }, colorGrading: irisGradingPresets['Cinematic Blue'], layers: { ...defaults.layers, memorySignal: true, proceduralFibers: true } },
}

export const cameraViews: Record<string, CameraConfig> = {
  'Full Eye': { ...defaults.camera },
  'Iris Close-up': { ...defaults.camera, distance: 2.5 },
  'Macro Iris': { ...defaults.camera, distance: 1.55 },
  'Three-quarter View': { ...defaults.camera, distance: 4, azimuth: 0.45, elevation: 0.16 },
}

const limits: Record<string, [number, number]> = {
  'display.modelOpacity': [0, 1], 'display.particleOpacity': [0, 1], 'display.fiberOpacity': [0, 1],
  'camera.distance': [1.3, 8], 'camera.azimuth': [-1, 1], 'camera.elevation': [-0.8, 0.8], 'camera.fov': [20, 75], 'camera.targetX': [-1, 1], 'camera.targetY': [-1, 1], 'camera.autoSpeed': [0, 1],
  'eye.scale': [0.7, 1.3], 'eye.irisRadius': [0.4, 0.7], 'eye.pupilRadius': [0.08, 0.3], 'eye.irisDepth': [-0.1, 0.1], 'eye.corneaScale': [0.8, 1.2], 'eye.corneaCurvature': [0.5, 1.5],
  'material.roughness': [0, 1], 'material.reflection': [0, 2], 'material.corneaOpacity': [0, 0.8], 'material.corneaRoughness': [0, 1], 'material.irisBrightness': [0.2, 2], 'material.irisContrast': [0.2, 2], 'material.irisSaturation': [0, 2], 'material.irisDetail': [0, 2],
  'lighting.key': [0, 5], 'lighting.keyX': [-8, 8], 'lighting.keyY': [-8, 8], 'lighting.fill': [0, 3], 'lighting.rim': [0, 3], 'lighting.ambient': [0, 2], 'lighting.environment': [0, 2],
  'particles.sizeVariation': [0, 1], 'particles.glow': [0, 2], 'particles.density': [0, 1], 'particles.size': [0.1, 4], 'particles.opacity': [0, 1], 'particles.brightness': [0, 2], 'particles.depth': [0, 0.2], 'particles.movement': [0, 0.2], 'particles.speed': [0, 3], 'particles.twinkle': [0, 1],
  'fibers.secondaryThickness': [0.1, 3], 'fibers.secondaryCurvature': [0, 1], 'fibers.secondaryGlow': [0, 2], 'fibers.secondaryColorVariation': [0, 1], 'fibers.secondaryMovement': [0, 1], 'fibers.branching': [0, 1], 'fibers.glow': [0, 2], 'fibers.colorVariation': [0, 1], 'fibers.movement': [0, 1], 'fibers.density': [0, 1], 'fibers.secondaryDensity': [0, 1], 'fibers.secondaryLength': [0.2, 2], 'fibers.secondaryBrightness': [0, 2], 'fibers.length': [0.2, 2], 'fibers.thickness': [0.1, 3], 'fibers.curvature': [0, 1], 'fibers.brightness': [0, 2],
  'fibers.opacity': [0, 1], 'fibers.noiseScale': [1, 16], 'fibers.fineFrequency': [12, 160], 'fibers.coarseFrequency': [3, 40], 'fibers.radialAlignment': [0, 1], 'fibers.depth': [0, 0.08], 'fibers.animationSpeed': [0, 0.25],
  'memorySignal.zRelief': [0, 0.4], 'memorySignal.noiseStrength': [0, 0.2], 'memorySignal.edgeDiffusion': [0, 2], 'memorySignal.brightnessThreshold': [0, 0.6], 'memorySignal.backgroundThreshold': [0, 1], 'memorySignal.alphaThreshold': [0, 1], 'memorySignal.colorIntensity': [0, 2], 'memorySignal.scatter': [0, 0.2], 'memorySignal.maxPoints': [50000, 400000],
  'blueEye.irisCenterX': [0, 1], 'blueEye.irisCenterY': [0, 1], 'blueEye.irisRadiusX': [0.08, 0.5], 'blueEye.irisRadiusY': [0.08, 0.5], 'blueEye.irisRotation': [-1.57, 1.57],
  'blueEye.pupilCenterX': [0, 1], 'blueEye.pupilCenterY': [0, 1], 'blueEye.pupilRadiusX': [0.01, 0.12], 'blueEye.pupilRadiusY': [0.01, 0.12], 'blueEye.pupilRotation': [-1.57, 1.57],
  'blueEye.irisFocus': [0, 1], 'blueEye.outerEyeFade': [0, 1], 'blueEye.irisColorStrength': [0, 1], 'blueEye.pupilDarkness': [0, 1], 'blueEye.particleDepth': [0, 0.3],
  'blueEye.particleDensity': [0.02, 1], 'blueEye.particleSize': [0.1, 2], 'blueEye.particleOpacity': [0, 1], 'blueEye.particleBrightness': [0, 2], 'blueEye.particleScatter': [0, 0.03],
  'blueEye.fiberDensity': [0, 1], 'blueEye.fiberLength': [0.2, 2], 'blueEye.fiberCurvature': [0, 1], 'blueEye.fiberThickness': [0.1, 3], 'blueEye.fiberBrightness': [0, 2], 'blueEye.fiberOpacity': [0, 1], 'blueEye.fiberNoiseScale': [1, 16], 'blueEye.fiberDepth': [0, 0.6], 'blueEye.fiberAnimationSpeed': [0, 0.25],
  'blueEye.bloomStrength': [0, 0.8],
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
    if (typeof next !== typeof target[key] || (typeof next === 'number' && !Number.isFinite(next)) || (typeof next === 'string' && !(group === 'display' && key === 'mode') && !/^#[0-9a-f]{6}$/i.test(next))) throw new Error(`Invalid setting: ${group}.${key}`)
    if (group === 'display' && key === 'mode' && !['Original', 'Memory Signal', 'Memory Signal Baseline', 'Blue Particle Eye', 'Cinematic Fiber Iris', 'Run 017 Blue Fibers', 'Fire Eye Fibers', 'Hybrid'].includes(next as string)) throw new Error('Invalid display mode')
    const bounds = limits[`${group}.${key}`]
    if (typeof next === 'number' && (!bounds || next < bounds[0] || next > bounds[1])) throw new Error(`Out of range: ${group}.${key}`)
    if (group === 'effects' && key === 'toneMapping' && !Number.isInteger(next)) throw new Error('Invalid tone mapping')
    if (group === 'memorySignal' && key === 'maxPoints' && !Number.isInteger(next)) throw new Error('Invalid particle count')
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
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) throw new Error('Unsupported or missing configuration version')

  const result = copy(defaults)
  for (const group of Object.keys(result) as (keyof LabConfig)[]) {
    if (group === 'version' || group === 'colorGrading') continue
    const target = result[group] as unknown as Record<string, unknown>
    if (group === 'blueEye' && version < 5) continue
    if (group === 'blueEye' && version === 5) {
      validateGroup(group, { ...target, ...(input[group] as Record<string, unknown>) }, target)
      continue
    }
    if (version < 4 && (group === 'display' || group === 'memorySignal')) continue
    if (version < 4 && (group === 'fibers' || group === 'layers')) {
      const source = input[group]
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`Invalid group: ${group}`)
      validateGroup(group, { ...target, ...(source as Record<string, unknown>) }, target)
    } else validateGroup(group, input[group], target)
  }

  if (version < 3) {
    result.colorGrading = migrateLegacyGrading(input.colorGrading, version)
  } else {
    validateGroup('colorGrading', input.colorGrading, result.colorGrading as unknown as Record<string, unknown>)
    const grade = result.colorGrading
    const minimumOuterStart = grade.innerZoneRadius + grade.amberTransitionWidth * 2
    if (grade.outerZoneStart < minimumOuterStart) throw new Error('Outer zone must begin after the inner amber transition')
  }

  result.version = 6
  return result
}

export function identifyIrisGradingPreset(settings: IrisColorGrading): keyof typeof irisGradingPresets | 'Manual' {
  for (const [name, preset] of Object.entries(irisGradingPresets)) {
    if ((Object.keys(preset) as (keyof IrisColorGrading)[]).every((key) => settings[key] === preset[key])) return name as keyof typeof irisGradingPresets
  }
  return 'Manual'
}
