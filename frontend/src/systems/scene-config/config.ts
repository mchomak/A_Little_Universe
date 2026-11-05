import '../../styles/fonts.css'
import { type ArtFontId, isArtFontId } from './fontIds'
import { isDeveloperMode } from '../../debug/developerMode'
import { DEFAULT_GROWTH_CLOUD_LAYERS, normalizeGrowthCloudLayers, type GrowthCloudLayers } from './growthCloudLayers'

export type QualityProfile = 'standard' | 'low'
export type ScenePresetId = 'moonlit-letter' | 'stardust' | 'vasilisa-cinematic'
export type GalaxyPalette = 'vasilisa' | 'spore' | 'ember' | 'emerald' | 'ice' | 'rose' | 'custom'
export type SeedQuality = 'low' | 'standard' | 'high'
export type ConfigResetScope = 'all' | 'global' | 'openingBackground' | 'preload' | 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery' | 'galaxy' | 'preset'

export interface GalleryCloudLayerSettings {
  count: number
  density: number
  scale: number
  opacity: number
  brightness: number
  driftSpeed: number
  height: number
  distance: number
  softness: number
}

export interface GalleryCloudLayers {
  far: Readonly<GalleryCloudLayerSettings>
  mid: Readonly<GalleryCloudLayerSettings>
  nearLow: Readonly<GalleryCloudLayerSettings>
  waterline: Readonly<GalleryCloudLayerSettings>
  moon: Readonly<GalleryCloudLayerSettings>
}

export interface GalleryPhotoLayout {
  laneWidth: number
  offsetX: number
  offsetY: number
  offsetZ: number
}

export interface LilyBudGlowSettings {
  enabled: boolean
  intensity: number
  color: string
  rimStrength: number
  bloomBoost: number
}

export interface LilyLeafMaterialSettings {
  translucencyStrength: number
  edgeLightIntensity: number
  colorVariation: number
}

export interface LilyGrowthVortexSettings {
  enabled: boolean
  particleCount: number
  particleSize: number
  sizeVariation: number
  brightness: number
  orbitRadius: number
  rotationSpeed: number
  verticalSpread: number
  spiralTightness: number
  dissipationDuration: number
  dissipationSpread: number
  color: string
}

export interface LilyBloomPollenSettings {
  enabled: boolean
  particleCount: number
  particleSize: number
  glowIntensity: number
  riseSpeed: number
  spreadRadius: number
  lifetime: number
  innerCupGlow: number
}

type DeepPartial<T> = { [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key] }
export type SceneComposerConfigPatch = DeepPartial<SceneComposerConfig>

export interface SceneComposerConfig {
  readonly schemaVersion: 25
  readonly global: Readonly<{
    quality: QualityProfile
    dprMin: number
    dprMax: number
    playbackSpeed: number
  }>
  readonly scenes: Readonly<{
    openingBackground: Readonly<{ zoom: number; offsetX: number; offsetY: number }>
    preload: Readonly<{ glow: number; particleCount: number; movementSpeed: number; collapseDuration: number }>
    prologue: Readonly<{
      fontFamily: ArtFontId
      fontSize: number
      lineHeight: number
      positionY: number
      handwritingDuration: number
      handwritingRhythm: number
      interphraseInterval: number
      readableHold: number
      particleCount: number
      windStrength: number
      turbulence: number
      fractureWidth: number
      fractureDuration: number
      promptHandwritingDuration: number
      particleFadeDuration: number
      particleDuration: number
      glow: number
      pulseAmplitude: number
      pulseFrequency: number
      coreIntensity: number
      innerGlowRadius: number
      outerGlowRadius: number
      phraseResponse: number
      touchIntensity: number
      touchDuration: number
      waveStrength: number
      waveRadius: number
      atmosphereDensity: number
      hazeIntensity: number
      spaceDepth: number
      driftSpeed: number
      secondFontScale: number
      textGap: number
      textGlow: number
      copyVariant: 'awakening' | 'legacy'
      particleSizeMin: number
      particleSizeMax: number
      particleGlow: number
      seed: number
    }>
    growth: Readonly<{
      particleQuality: SeedQuality
      particleSize: number
      particleOpacity: number
      cloudRadius: number
      noiseStrength: number
      attractionStrength: number
      attractionRampDuration: number
      morphDamping: number
      formationDuration: number
      freeParticleFraction: number
      pearlColor: string
      roseColor: string
      lavenderColor: string
      coreGlow: number
      vfxCoreIntensity: number
      vfxPulseBrightness: number
      vfxPulseWidth: number
      vfxPulseEnabled: boolean
      vfxPulseSpeed: number
      vfxPulseTrailFade: number
      vfxPulseColor: string
      vfxPulseLeafBoost: number
      vfxPulseBudBoost: number
      vfxParticleCount: number
      vfxParticleSize: number
      vfxParticleSizeVariation: number
      vfxParticleSpeed: number
      vfxParticleBrightness: number
      vfxParticleGlow: number
      vfxParticleLifetime: number
      vfxParticleSpread: number
      vfxParticleTint: string
      lilyBudGlow: Readonly<LilyBudGlowSettings>
      lilyLeafMaterial: Readonly<LilyLeafMaterialSettings>
      growthVortex: Readonly<LilyGrowthVortexSettings>
      seedScale: number
      flowerGrowthDuration: number
      islandRadius: number
      islandThickness: number
      islandDepth: number
      islandRoughness: number
      grassDensity: number
      grassHeight: number
      windStrength: number
      windSpeed: number
      seedOrbitCount: number
      seedOrbitRadius: number
      seedOrbitTilt: number
      seedOrbitSpeed: number
      seedFallDuration: number
      seedFallAcceleration: number
      seedFallHeight: number
      seedCameraLag: number
      seedCameraFollowSpeed: number
      seedSpinSpeed: number
      seedTumbleSpeed: number
      seedWobbleAmplitude: number
      islandRevealDuration: number
      seedTrailIntensity: number
      seedTrailSpread: number
      seedTrailLifetime: number
      seedTrailLiftSpeed: number
      seedTrailParticleCount: number
      seedImpactStrength: number
      seedImpactRadius: number
      seedImpactParticles: number
      seedImpactLifetime: number
      moonLightIntensity: number
      moonLightColor: string
      moonBeamRadius: number
      moonBeamSoftness: number
      moonBeamIntensity: number
      moonScatteringIntensity: number
      moonPositionX: number
      moonPositionY: number
      moonPositionZ: number
      cloudCount: number
      cloudDensity: number
      cloudScale: number
      cloudDriftSpeed: number
      cloudOpacity: number
      cloudLightIntensity: number
      cloudSizeVariation: number
      cloudLightVariation: number
      cloudPathDensity: number
      cloudShapeVariation: number
      cloudDepthVariation: number
      cloudLayers: GrowthCloudLayers
    }>
    bloom: Readonly<{
      flowerBloomDuration: number
      cameraApproachDuration: number
      cameraBloomSync: number
      cameraFinalDistance: number
      cameraFinalHeight: number
      cameraTargetX: number
      cameraTargetY: number
      textPositionX: number
      textPositionY: number
      textSize: number
      textColor: string
      textWritingDuration: number
      textParticleCount: number
      lilyBloomPollen: Readonly<LilyBloomPollenSettings>
    }>
    identity: Readonly<{
      dissolveDuration: number
      particleCount: number
      particleSize: number
      edgeWidth: number
      particleBrightness: number
      vortexRadius: number
      vortexExpansion: number
      swirlSpeed: number
      swirlAcceleration: number
      centerDissolveAt: number
      cameraPullback: number
      cameraRise: number
      cameraMoveDuration: number
      portraitStart: number
      portraitDuration: number
      portraitStartProgress: number
      portraitFraction: number
      portraitMinTurns: number
      portraitMaxTurns: number
      portraitSteering: number
      portraitBraking: number
      portraitSettledBrightness: number
      vortexSpeedMultiplier: number
      portraitDetail: number
      portraitBrightness: number
      portraitSize: number
      portraitScale: number
      portraitOffsetX: number
      portraitOffsetY: number
    }>
    gallery: Readonly<{
      galleryLayoutVariant: 'on-columns' | 'between-columns'
      galleryLayoutA: Readonly<GalleryPhotoLayout>
      galleryLayoutB: Readonly<GalleryPhotoLayout>
      galleryPhotoFacingMaxDegrees: number
      /** Distance between the two photo-lane centers; changing it leaves their Z/order untouched. */
      galleryWidth: number
      columnVisible: boolean
      columnScale: number
      /** Positive depth points behind the photo plane; offsets X/Y are horizontal on its face and vertical from floor. */
      columnDepth: number
      columnOffsetX: number
      columnOffsetY: number
      archVisible: boolean
      archScale: number
      archOpacity: number
      archPositionX: number
      archPositionY: number
      /** @deprecated Retained for older composer JSON; render placement follows the terminal support pair. */
      archPositionZ: number
      archRotationY: number
      frameIntensity: number
      particleCount: number
      collageParticleCount: number
      collageParticleSize: number
      collageNoiseStrength: number
      collageDepth: number
      collageGlow: number
      collageAssembleDuration: number
      collageRevealDuration: number
      collageStaggerDelay: number
      collagePhotoScale: number
      collagePhotoGap: number
      captionFontSize: number
      moonBrightness: number
      moonSize: number
      cloudDriftVariation: number
      cloudLayers: GalleryCloudLayers
      cloudCoolTint: number
      cloudWhiteHighlight: number
      hazeDensity: number
      hazeHeight: number
      hazeMotionSpeed: number
      reflectionStrength: number
      reflectionBlur: number
      reflectionFalloff: number
      waterBaseBrightness: number
      waterDistortion: number
      waterDistortionScale: number
      waterRippleSpeed: number
      waterNormalStrength: number
      moonHighlightStrength: number
      moonReflectionSpread: number
      waterOpacity: number
      threadOpacity: number
      coldLightIntensity: number
      moonLightIntensity: number
      moonFillIntensity: number
      moonHaloIntensity: number
      moonCloudLightIntensity: number
      moonScatteringIntensity: number
      moonLightColor: string
      moonPositionX: number
      moonPositionY: number
      moonPositionZ: number
      moonTargetX: number
      moonTargetY: number
      moonTargetZ: number
      moonHaloRadius: number
      moonGodRaysIntensity: number
    }>
    galaxy: Readonly<{
      quality: SeedQuality
      seed: string
      starCount: number
      arms: number
      radius: number
      spin: number
      armWidth: number
      randomness: number
      randomnessPower: number
      coreSize: number
      coreDensity: number
      thickness: number
      distribution: 'balanced' | 'core' | 'arms'
      starSize: number
      brightness: number
      twinkle: number
      twinkleSpeed: number
      brightStarCount: number
      brightStarSize: number
      brightStarIntensity: number
      backgroundStarCount: number
      backgroundBrightness: number
      backgroundSize: number
      backgroundDepth: number
      backgroundGasDensity: number
      backgroundGasBrightness: number
      nebulaEnabled: boolean
      blackHoleEnabled: boolean
      nebulaDensity: number
      nebulaBrightness: number
      nebulaSaturation: number
      nebulaOpacity: number
      nebulaScale: number
      nebulaIntensity: number
      nebulaSpeed: number
      fogDensity: number
      fogLayers: number
      fogDepth: number
      fogDissipation: number
      fogStart: number
      fogEnd: number
      fogTurbulence: number
      fogAfterOpacity: number
      palette: GalaxyPalette
      coreColor: string
      innerColor: string
      armColor: string
      nebulaColor: string
      brightColor: string
      backgroundColor: string
      exposure: number
      coreGlow: number
      rotationSpeed: number
      motionSpeed: number
      revealMotion: number
      idleMotion: number
      firstStarsAt: number
      galaxyRevealAt: number
      revealDuration: number
      pauseDuration: number
      backgroundTransition: number
      cameraStartDistance: number
      cameraEndDistance: number
      cameraStartAngle: number
      cameraEndAngle: number
      cameraFocusX: number
      cameraFocusY: number
      cameraDuration: number
      cameraEase: 'sine' | 'power2' | 'power3'
      cameraSlowdown: number
      compositionScale: number
    }>
  }>
  readonly preset: ScenePresetId
}

export const DEFAULT_SCENE_COMPOSER_CONFIG: SceneComposerConfig = deepFreeze({
  schemaVersion: 25,
  global: { quality: 'standard', dprMin: 1, dprMax: 1.5, playbackSpeed: 1 },
  scenes: {
    openingBackground: { zoom: 1, offsetX: 0, offsetY: 0 },
    preload: { glow: 1, particleCount: 150, movementSpeed: 1, collapseDuration: 1.25 },
    prologue: {
      fontFamily: 'great-vibes', fontSize: 48, lineHeight: 1.3, positionY: 40,
      handwritingDuration: 3.5, handwritingRhythm: 0.82, interphraseInterval: 1.35, readableHold: 2,
      particleCount: 1800, windStrength: 1.15, turbulence: 0.3, fractureWidth: 0.08,
      fractureDuration: 1.5, particleDuration: 2.2, particleFadeDuration: 1.2, promptHandwritingDuration: 0.65,
      glow: 0.45, pulseAmplitude: 0.035, pulseFrequency: 0.22, seed: 1420577,
      coreIntensity: 1, innerGlowRadius: 16, outerGlowRadius: 95, phraseResponse: 0.12,
      touchIntensity: 0.55, touchDuration: 0.85, waveStrength: 0.14, waveRadius: 70,
      atmosphereDensity: 42, hazeIntensity: 0.035, spaceDepth: 0.35, driftSpeed: 0.035,
      secondFontScale: 0.86, textGap: 34, textGlow: 0.22, copyVariant: 'legacy',
      particleSizeMin: 0.6, particleSizeMax: 1.8, particleGlow: 0.95,
    },
    growth: {
      particleQuality: 'standard', particleSize: 1.4, particleOpacity: 0.7,
      cloudRadius: 0.6, noiseStrength: 0.55, attractionStrength: 11.5,
      attractionRampDuration: 2.8, morphDamping: 7.2, formationDuration: 3.2,
      freeParticleFraction: 0.08, pearlColor: '#FFF4E8', roseColor: '#F4CCDA',
      lavenderColor: '#D7CCF1', coreGlow: 0.55,
      vfxCoreIntensity: 0.65, vfxPulseBrightness: 1.45, vfxPulseWidth: 0.2,
      vfxPulseEnabled: true, vfxPulseSpeed: 1, vfxPulseTrailFade: 1.4,
      vfxPulseColor: '#F4DFB8', vfxPulseLeafBoost: 0.6, vfxPulseBudBoost: 0.55,
      vfxParticleCount: 440, vfxParticleSize: 3.4, vfxParticleSizeVariation: 0.65,
      vfxParticleSpeed: 0.95, vfxParticleBrightness: 1.15, vfxParticleGlow: 1.35,
      vfxParticleLifetime: 2.3, vfxParticleSpread: 0.65, vfxParticleTint: '#FFF4E8',
      lilyBudGlow: { enabled: true, intensity: 0.48, color: '#E9B9CE', rimStrength: 0.28, bloomBoost: 0.7 },
      lilyLeafMaterial: { translucencyStrength: 0.32, edgeLightIntensity: 0.2, colorVariation: 0.24 },
      growthVortex: {
        enabled: true, particleCount: 360, particleSize: 1.8, sizeVariation: 0.55, brightness: 1,
        orbitRadius: 0.42, rotationSpeed: 1.55, verticalSpread: 0.9, spiralTightness: 1.4,
        dissipationDuration: 2.3, dissipationSpread: 1.35, color: '#EBD4A7',
      },
      seedScale: 1, flowerGrowthDuration: 9,
      islandRadius: 0.82, islandThickness: 0.24, islandDepth: 0.58, islandRoughness: 0.5,
      grassDensity: 360, grassHeight: 0.14, windStrength: 1, windSpeed: 0.8,
      seedOrbitCount: 3, seedOrbitRadius: 0.4, seedOrbitTilt: 0.62, seedOrbitSpeed: 0.85,
      seedFallDuration: 8, seedFallAcceleration: 3.2, seedFallHeight: 3.2,
      seedCameraLag: 0.3, seedCameraFollowSpeed: 3, seedSpinSpeed: 1,
      seedTumbleSpeed: 0.7, seedWobbleAmplitude: 0.08,
      islandRevealDuration: 1.5,
      seedTrailIntensity: 1.2, seedTrailSpread: 0.36, seedTrailLifetime: 1,
      seedTrailLiftSpeed: 0.8, seedTrailParticleCount: 60,
      seedImpactStrength: 0.6, seedImpactRadius: 0.72,
      seedImpactParticles: 64, seedImpactLifetime: 0.85,
      moonLightIntensity: 1.2, moonLightColor: '#AFC9F5', moonBeamRadius: 2,
      moonBeamSoftness: 0.6, moonBeamIntensity: 0.55, moonScatteringIntensity: 0.35,
      moonPositionX: -0.65, moonPositionY: 5.5, moonPositionZ: 1,
      cloudCount: 20, cloudDensity: 0.9, cloudScale: 1, cloudDriftSpeed: 0.28,
      cloudOpacity: 0.48, cloudLightIntensity: 0.7,
      cloudSizeVariation: 0.72, cloudLightVariation: 0.55, cloudPathDensity: 0.65,
      cloudShapeVariation: 0.72, cloudDepthVariation: 0.8,
      cloudLayers: DEFAULT_GROWTH_CLOUD_LAYERS,
    },
    bloom: {
      flowerBloomDuration: 16, cameraApproachDuration: 10.7, cameraBloomSync: 0.67,
      cameraFinalDistance: 2.3, cameraFinalHeight: 2.55, cameraTargetX: 0.27, cameraTargetY: 1.25,
      textPositionX: 0.1, textPositionY: 0.52, textSize: 36, textColor: '#C7AD77',
      textWritingDuration: 4.2, textParticleCount: 1800,
      lilyBloomPollen: {
        enabled: true, particleCount: 48, particleSize: 1.6, glowIntensity: 0.75,
        riseSpeed: 0.09, spreadRadius: 0.28, lifetime: 3.8, innerCupGlow: 0.35,
      },
    },
    identity: {
      dissolveDuration: 12, particleCount: 80000, particleSize: 2.3, edgeWidth: 0.035,
      particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45,
      swirlSpeed: 1, swirlAcceleration: 0.1, centerDissolveAt: 0.5,
      cameraPullback: 1.8, cameraRise: 0.65, cameraMoveDuration: 12,
      portraitStart: 12, portraitDuration: 8.5, portraitStartProgress: 0.3, portraitFraction: 0.4,
      portraitMinTurns: 0, portraitMaxTurns: 2, portraitSteering: 1, portraitBraking: 1,
      portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9, portraitDetail: 1.5,
      portraitBrightness: 1.8, portraitSize: 1.8, portraitScale: 1.05, portraitOffsetX: 0, portraitOffsetY: 0,
    },
    gallery: {
      galleryLayoutVariant: 'between-columns',
      galleryLayoutA: { laneWidth: 7, offsetX: 0, offsetY: 0, offsetZ: 0 },
      galleryLayoutB: { laneWidth: 7, offsetX: 2, offsetY: 0.75, offsetZ: 2.1 },
      galleryPhotoFacingMaxDegrees: 45,
      galleryWidth: 7,
      columnVisible: true, columnScale: 1, columnDepth: 0.15, columnOffsetX: 0, columnOffsetY: 0,
      archVisible: true, archScale: 19, archOpacity: 0.78, archPositionX: 0, archPositionY: 0, archPositionZ: -82, archRotationY: 0,
      frameIntensity: 1, particleCount: 220,
      collageParticleCount: 90000, collageParticleSize: 2.6, collageNoiseStrength: 0.035, collageDepth: 0.42,
      collageGlow: 1, collageAssembleDuration: 5, collageRevealDuration: 2.5, collageStaggerDelay: 0.14,
      collagePhotoScale: 0.9, collagePhotoGap: 0.3,
      captionFontSize: 29,
      moonBrightness: 0.8, moonSize: 1.2,
      cloudDriftVariation: 0.65,
      cloudLayers: {
        far: { count: 2, density: 0.84, scale: 1.12, opacity: 0.72, brightness: 0.84, driftSpeed: 0.48, height: 0, distance: 0, softness: 0.82 },
        mid: { count: 2, density: 0.92, scale: 1.16, opacity: 0.78, brightness: 0.92, driftSpeed: 0.68, height: 0, distance: 0, softness: 0.7 },
        nearLow: { count: 8, density: 1.12, scale: 1, opacity: 0.94, brightness: 1.08, driftSpeed: 0.62, height: 0, distance: 0, softness: 0.55 },
        waterline: { count: 8, density: 0.96, scale: 1.05, opacity: 0.92, brightness: 0.96, driftSpeed: 0.52, height: 0.8, distance: 0, softness: 0.58 },
        moon: { count: 2, density: 0.62, scale: 0.62, opacity: 0.68, brightness: 0.8, driftSpeed: 0.22, height: 0, distance: 0, softness: 0.72 },
      },
      cloudCoolTint: 1.35, cloudWhiteHighlight: 0.24,
      hazeDensity: 0.3, hazeHeight: 0, hazeMotionSpeed: 0.35, reflectionStrength: 0.64,
      reflectionBlur: 0.62, reflectionFalloff: 1.25, waterBaseBrightness: 0.72,
      waterDistortion: 0.02, waterDistortionScale: 0.87, waterRippleSpeed: 1,
      waterNormalStrength: 0.5, moonHighlightStrength: 1.1, moonReflectionSpread: 2, waterOpacity: 1,
      threadOpacity: 0.38, coldLightIntensity: 0.58,
      moonLightIntensity: 1.4, moonFillIntensity: 0.22, moonHaloIntensity: 1.8,
      moonCloudLightIntensity: 0.72, moonScatteringIntensity: 0.62,
      moonLightColor: '#C3D8F2', moonPositionX: 0.2, moonPositionY: 24, moonPositionZ: -126,
      moonTargetX: 0, moonTargetY: 5.2, moonTargetZ: -34, moonHaloRadius: 1.7,
      moonGodRaysIntensity: 0.12,
    },
    galaxy: {
      quality: 'standard', seed: 'andromeda', starCount: 32000, arms: 5, radius: 8.2,
      spin: 4.6, armWidth: 0.16, randomness: 0.065, randomnessPower: 3.6, coreSize: 0.24, coreDensity: 0.2,
      thickness: 0.05, distribution: 'balanced', starSize: 1.03, brightness: 1.14,
      twinkle: 0.5, twinkleSpeed: 0.72, brightStarCount: 175, brightStarSize: 1.4,
      brightStarIntensity: 1.1, backgroundStarCount: 5200, backgroundBrightness: 1,
      backgroundSize: 1.6, backgroundDepth: 42, backgroundGasDensity: 0.34,
      backgroundGasBrightness: 0.34, nebulaEnabled: true, blackHoleEnabled: true, nebulaDensity: 0.5,
      nebulaBrightness: 0.69, nebulaSaturation: 1.15, nebulaOpacity: 0.72, nebulaScale: 1.35,
      nebulaIntensity: 0.46, nebulaSpeed: 0.018, fogDensity: 0.14, fogLayers: 3,
      fogDepth: 14, fogDissipation: 0.84, fogStart: 1.5, fogEnd: 8.5,
      fogTurbulence: 0.18, fogAfterOpacity: 0.008, palette: 'spore',
      coreColor: '#FFE6AD', innerColor: '#D9C6FF', armColor: '#4F5CFF',
      nebulaColor: '#9A52FF', brightColor: '#7FB4FF', backgroundColor: '#04020C',
      exposure: 1, coreGlow: 1, rotationSpeed: 0.045, motionSpeed: 1,
      revealMotion: 1, idleMotion: 0.3, firstStarsAt: 0.25, galaxyRevealAt: 1.2,
      revealDuration: 10.4, pauseDuration: 4.2, backgroundTransition: 7,
      cameraStartDistance: 6.4, cameraEndDistance: 16, cameraStartAngle: 0.18,
      cameraEndAngle: 0.785, cameraFocusX: 0, cameraFocusY: 0, cameraDuration: 10,
      cameraEase: 'sine', cameraSlowdown: 3, compositionScale: 1,
    },
  },
  preset: 'moonlit-letter',
})

export const SCENE_CONFIG_PRESETS = deepFreeze({
  'moonlit-letter': {
    label: 'Moonlit Letter',
    patch: { preset: 'moonlit-letter', scenes: { prologue: { glow: 0.9, pulseAmplitude: 0.07, turbulence: 0.29 } } },
  },
  stardust: {
    label: 'Stardust',
    patch: { preset: 'stardust', scenes: { prologue: { glow: 1.25, particleCount: 2600, turbulence: 0.38 } } },
  },
  'vasilisa-cinematic': {
    label: 'Vasilisa Cinematic',
    patch: { preset: 'vasilisa-cinematic', scenes: { galaxy: { palette: 'spore', blackHoleEnabled: true,
      coreColor: '#FFE6AD', innerColor: '#D9C6FF', armColor: '#4F5CFF', nebulaColor: '#9A52FF',
      brightColor: '#7FB4FF', backgroundColor: '#04020C', seed: 'andromeda', starCount: 32000,
      arms: 5, spin: 4.6, rotationSpeed: 0.045, coreGlow: 1, brightness: 1.14,
      coreSize: 0.24, coreDensity: 0.2, armWidth: 0.16, randomness: 0.065,
      randomnessPower: 3.6, thickness: 0.05, twinkle: 0.5, starSize: 1.03,
      brightStarCount: 175, brightStarSize: 1.4, brightStarIntensity: 1.1, backgroundStarCount: 5200, backgroundBrightness: 1,
      nebulaDensity: 0.5, nebulaBrightness: 0.69, nebulaSaturation: 1.15,
      nebulaOpacity: 0.72, nebulaIntensity: 0.46 } } },
  },
})

let activeConfig = DEFAULT_SCENE_COMPOSER_CONFIG
let updateRevision = 0
let startupConfigRequest: Promise<void> | undefined
const configListeners = new Set<(config: SceneComposerConfig) => void>()
const LILY_GROWTH_VFX_STORAGE_KEY = 'a-little-universe:dev:lily-growth-particles:v3'
const LILY_GROWTH_VFX_FIELDS = [
  'vfxCoreIntensity', 'vfxPulseEnabled', 'vfxPulseBrightness', 'vfxPulseWidth', 'vfxPulseSpeed',
  'vfxPulseTrailFade', 'vfxPulseColor', 'vfxPulseLeafBoost', 'vfxPulseBudBoost',
  'vfxParticleCount', 'vfxParticleSize', 'vfxParticleSizeVariation', 'vfxParticleBrightness',
  'vfxParticleGlow', 'vfxParticleSpeed', 'vfxParticleLifetime', 'vfxParticleSpread', 'vfxParticleTint',
] as const

restoreLilyGrowthVfx()

export function normalizeConfig(input: unknown): SceneComposerConfig {
  const root = asRecord(input)
  if (root && root.schemaVersion === undefined && Object.keys(root).length === 0) return DEFAULT_SCENE_COMPOSER_CONFIG
  const inputVersion = root?.schemaVersion === undefined ? 1 : root.schemaVersion
  if (!root || !Number.isInteger(inputVersion) || Number(inputVersion) < 1 || Number(inputVersion) > 25) return DEFAULT_SCENE_COMPOSER_CONFIG
  const migratingV1 = inputVersion === 1
  const globalInput = asRecord(root.global)
  const scenesInput = asRecord(root.scenes)
  const openingBackgroundInput = asRecord(scenesInput?.openingBackground)
  const preloadInput = asRecord(scenesInput?.preload)
  const prologueInput = asRecord(scenesInput?.prologue)
  const rawGrowthInput = asRecord(scenesInput?.growth)
  const bloomInput = asRecord(scenesInput?.bloom)
  const identityInput = asRecord(scenesInput?.identity)
  const rawGalleryInput = asRecord(scenesInput?.gallery)
  // Schema v9 allowed at most 12 cloud banks; expand that old default while
  // preserving deliberate lower values, including zero.
  const galleryInput = inputVersion === 9 && rawGalleryInput?.cloudLayerCount === 12
    ? { ...rawGalleryInput, cloudLayerCount: 18 }
    : rawGalleryInput
  const growthV17Input = Number(inputVersion) < 17 && rawGrowthInput
    ? {
        ...rawGrowthInput,
        ...(rawGrowthInput.seedFallDuration === 3.6 ? { seedFallDuration: 4.8 } : {}),
        ...(rawGrowthInput.cloudCount === 3 ? { cloudCount: 18 } : {}),
      }
    : rawGrowthInput
  const growthInput = Number(inputVersion) < 18 && growthV17Input
    ? {
        ...growthV17Input,
        ...(rawGrowthInput?.seedFallHeight === 1.6 ? { seedFallHeight: 3.2 } : {}),
        ...(Number(inputVersion) === 17 && rawGrowthInput?.seedFallDuration === 4.8 ? { seedFallDuration: 8 } : {}),
        ...(Number(inputVersion) < 17 && rawGrowthInput?.seedFallDuration === 3.6 ? { seedFallDuration: 8 } : {}),
      }
    : growthV17Input
  const lilyBudGlowInput = asRecord(growthInput?.lilyBudGlow)
  const lilyLeafMaterialInput = asRecord(growthInput?.lilyLeafMaterial)
  const growthVortexInput = asRecord(growthInput?.growthVortex)
  const lilyBloomPollenInput = asRecord(bloomInput?.lilyBloomPollen)
  const galaxyInput = asRecord(scenesInput?.galaxy)
  const galaxySettingsInput = migrateGalaxySettings(galaxyInput, inputVersion)
  const legacyParticleSpeed = numberValue(prologueInput?.particleSpeed, 1, 0.1, 10)
  const legacyParticleSpread = numberValue(prologueInput?.particleSpread, 1, 0, 2)
  const windStrength = numberValue(
    prologueInput?.windStrength ?? (migratingV1 ? clamp(legacyParticleSpeed * 1.15, 0.2, 3) : undefined),
    DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.windStrength, 0.2, 3,
  )
  const turbulence = numberValue(
    prologueInput?.turbulence ?? (migratingV1 ? legacyParticleSpread * 0.3 : undefined),
    DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.turbulence, 0, 1,
  )

  const global = {
    quality: enumValue(globalInput?.quality, ['standard', 'low'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.global.quality),
    dprMin: numberValue(globalInput?.dprMin, DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMin, 0.5, 1.5),
    dprMax: numberValue(globalInput?.dprMax, DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMax, 1, 2),
    playbackSpeed: numberValue(globalInput?.playbackSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.global.playbackSpeed, 0.25, 4),
  }
  if (global.dprMin > global.dprMax) {
    global.dprMin = DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMin
    global.dprMax = DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMax
  }

  const scenes = {
    openingBackground: {
      zoom: numberValue(openingBackgroundInput?.zoom, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.openingBackground.zoom, 1, 3),
      offsetX: boundedNumberValue(openingBackgroundInput?.offsetX, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.openingBackground.offsetX, -1, 1),
      offsetY: boundedNumberValue(openingBackgroundInput?.offsetY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.openingBackground.offsetY, -1, 1),
    },
    preload: {
      glow: numberValue(preloadInput?.glow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.glow, 0, 2),
      particleCount: numberValue(preloadInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.particleCount, 40, 300, true),
      movementSpeed: numberValue(preloadInput?.movementSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.movementSpeed, 0.1, 4),
      collapseDuration: numberValue(preloadInput?.collapseDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.collapseDuration, 0, 4),
    },
    prologue: {
      fontFamily: fontValue(prologueInput?.fontFamily, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily),
      fontSize: numberValue(prologueInput?.fontSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize, 16, 160),
      lineHeight: numberValue(prologueInput?.lineHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.lineHeight, 0.8, 2.5),
      positionY: numberValue(prologueInput?.positionY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.positionY, 10, 80),
      handwritingDuration: numberValue(prologueInput?.handwritingDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.handwritingDuration, 0.5, 20),
      handwritingRhythm: numberValue(prologueInput?.handwritingRhythm, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.handwritingRhythm, 0.1, 3),
      interphraseInterval: numberValue(prologueInput?.interphraseInterval, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.interphraseInterval, 0, 8),
      readableHold: numberValue(prologueInput?.readableHold, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.readableHold, 0, 30),
      particleCount: migratingV1
        ? migrateLegacyNumber(prologueInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleCount, 100, 6000, 300, 6000, true)
        : numberValue(prologueInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleCount, 300, 6000, true),
      windStrength,
      turbulence,
      fractureWidth: numberValue(prologueInput?.fractureWidth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fractureWidth, 0, 0.18),
      fractureDuration: numberValue(prologueInput?.fractureDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fractureDuration, 0.8, 4),
      promptHandwritingDuration: numberValue(prologueInput?.promptHandwritingDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.promptHandwritingDuration, 0.2, 0.8),
      particleFadeDuration: numberValue(prologueInput?.particleFadeDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleFadeDuration, 0.5, 4),
      particleDuration: numberValue(prologueInput?.particleDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleDuration, 0.1, 20),
      glow: numberValue(prologueInput?.glow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.glow, 0, 2),
      pulseAmplitude: numberValue(prologueInput?.pulseAmplitude, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseAmplitude, 0, 1),
      pulseFrequency: numberValue(prologueInput?.pulseFrequency, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseFrequency, 0, 5),
      coreIntensity: numberValue(prologueInput?.coreIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.coreIntensity, 0.2, 2),
      innerGlowRadius: numberValue(prologueInput?.innerGlowRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.innerGlowRadius, 6, 40),
      outerGlowRadius: numberValue(prologueInput?.outerGlowRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.outerGlowRadius, 40, 160),
      phraseResponse: numberValue(prologueInput?.phraseResponse, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.phraseResponse, 0, 0.6),
      touchIntensity: numberValue(prologueInput?.touchIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.touchIntensity, 0, 1.5),
      touchDuration: numberValue(prologueInput?.touchDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.touchDuration, 0.7, 1),
      waveStrength: numberValue(prologueInput?.waveStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.waveStrength, 0, 0.5),
      waveRadius: numberValue(prologueInput?.waveRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.waveRadius, 30, 120),
      atmosphereDensity: numberValue(prologueInput?.atmosphereDensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.atmosphereDensity, 0, 120, true),
      hazeIntensity: numberValue(prologueInput?.hazeIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.hazeIntensity, 0, 0.12),
      spaceDepth: numberValue(prologueInput?.spaceDepth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.spaceDepth, 0, 1),
      driftSpeed: numberValue(prologueInput?.driftSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.driftSpeed, 0, 0.2),
      secondFontScale: numberValue(prologueInput?.secondFontScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.secondFontScale, 0.6, 1.2),
      textGap: numberValue(prologueInput?.textGap, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.textGap, 20, 100),
      textGlow: numberValue(prologueInput?.textGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.textGlow, 0, 1),
      copyVariant: enumValue(prologueInput?.copyVariant, ['awakening', 'legacy'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.copyVariant),
      particleSizeMin: numberValue(prologueInput?.particleSizeMin, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSizeMin, 0.25, 2.5),
      particleSizeMax: numberValue(prologueInput?.particleSizeMax, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSizeMax, 0.5, 4),
      particleGlow: numberValue(prologueInput?.particleGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleGlow, 0, 2),
      seed: numberValue(prologueInput?.seed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.seed, 0, 2_147_483_647, true),
    },
    growth: {
      particleQuality: enumValue(growthInput?.particleQuality, ['low', 'standard', 'high'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleQuality),
      particleSize: numberValue(growthInput?.particleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleSize, 0.5, 3),
      particleOpacity: numberValue(growthInput?.particleOpacity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleOpacity, 0, 1.5),
      cloudRadius: numberValue(growthInput?.cloudRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudRadius, 0.3, 1.2),
      noiseStrength: numberValue(growthInput?.noiseStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.noiseStrength, 0, 2),
      attractionStrength: numberValue(growthInput?.attractionStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.attractionStrength, 2, 24),
      attractionRampDuration: numberValue(growthInput?.attractionRampDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.attractionRampDuration, 0.5, 3.5),
      morphDamping: numberValue(growthInput?.morphDamping, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.morphDamping, 2, 14),
      formationDuration: numberValue(growthInput?.formationDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.formationDuration, 2.5, 3.5),
      freeParticleFraction: numberValue(growthInput?.freeParticleFraction, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.freeParticleFraction, 0, 0.2),
      pearlColor: colorValue(growthInput?.pearlColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.pearlColor),
      roseColor: colorValue(growthInput?.roseColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.roseColor),
      lavenderColor: colorValue(growthInput?.lavenderColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lavenderColor),
      coreGlow: numberValue(growthInput?.coreGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.coreGlow, 0, 1.5),
      vfxCoreIntensity: numberValue(growthInput?.vfxCoreIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxCoreIntensity, 0, 1.5),
      vfxPulseBrightness: numberValue(growthInput?.vfxPulseBrightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseBrightness, 0, 2.5),
      vfxPulseWidth: numberValue(growthInput?.vfxPulseWidth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseWidth, 0.025, 0.3),
      vfxPulseEnabled: typeof growthInput?.vfxPulseEnabled === 'boolean' ? growthInput.vfxPulseEnabled : DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseEnabled,
      vfxPulseSpeed: numberValue(growthInput?.vfxPulseSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseSpeed, 0.4, 2),
      vfxPulseTrailFade: numberValue(growthInput?.vfxPulseTrailFade, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseTrailFade, 0.35, 3),
      vfxPulseColor: colorValue(growthInput?.vfxPulseColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseColor),
      vfxPulseLeafBoost: numberValue(growthInput?.vfxPulseLeafBoost, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseLeafBoost, 0, 1.5),
      vfxPulseBudBoost: numberValue(growthInput?.vfxPulseBudBoost, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxPulseBudBoost, 0, 1.5),
      vfxParticleCount: numberValue(growthInput?.vfxParticleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleCount, 0, 528, true),
      vfxParticleSize: numberValue(growthInput?.vfxParticleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleSize, 0.75, 8),
      vfxParticleSizeVariation: numberValue(growthInput?.vfxParticleSizeVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleSizeVariation, 0, 1.5),
      vfxParticleSpeed: numberValue(growthInput?.vfxParticleSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleSpeed, 0.2, 2),
      vfxParticleBrightness: numberValue(growthInput?.vfxParticleBrightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleBrightness, 0, 2.5),
      vfxParticleGlow: numberValue(growthInput?.vfxParticleGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleGlow, 0, 2),
      vfxParticleLifetime: numberValue(growthInput?.vfxParticleLifetime, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleLifetime, 0.3, 3),
      vfxParticleSpread: numberValue(growthInput?.vfxParticleSpread, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleSpread, 0, 1.5),
      vfxParticleTint: colorValue(growthInput?.vfxParticleTint, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.vfxParticleTint),
      lilyBudGlow: {
        enabled: typeof lilyBudGlowInput?.enabled === 'boolean' ? lilyBudGlowInput.enabled : DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyBudGlow.enabled,
        intensity: numberValue(lilyBudGlowInput?.intensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyBudGlow.intensity, 0, 2),
        color: colorValue(lilyBudGlowInput?.color, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyBudGlow.color),
        rimStrength: numberValue(lilyBudGlowInput?.rimStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyBudGlow.rimStrength, 0, 2),
        bloomBoost: numberValue(lilyBudGlowInput?.bloomBoost, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyBudGlow.bloomBoost, 0, 2),
      },
      lilyLeafMaterial: {
        translucencyStrength: numberValue(lilyLeafMaterialInput?.translucencyStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyLeafMaterial.translucencyStrength, 0, 1),
        edgeLightIntensity: numberValue(lilyLeafMaterialInput?.edgeLightIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyLeafMaterial.edgeLightIntensity, 0, 1),
        colorVariation: numberValue(lilyLeafMaterialInput?.colorVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyLeafMaterial.colorVariation, 0, 1),
      },
      growthVortex: {
        enabled: typeof growthVortexInput?.enabled === 'boolean' ? growthVortexInput.enabled : DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.enabled,
        particleCount: numberValue(growthVortexInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.particleCount, 0, 1600, true),
        particleSize: numberValue(growthVortexInput?.particleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.particleSize, 0.2, 8),
        sizeVariation: numberValue(growthVortexInput?.sizeVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.sizeVariation, 0, 1),
        brightness: numberValue(growthVortexInput?.brightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.brightness, 0, 3),
        orbitRadius: numberValue(growthVortexInput?.orbitRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.orbitRadius, 0.02, 1.5),
        rotationSpeed: numberValue(growthVortexInput?.rotationSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.rotationSpeed, 0, 4),
        verticalSpread: numberValue(growthVortexInput?.verticalSpread, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.verticalSpread, 0.02, 2),
        spiralTightness: numberValue(growthVortexInput?.spiralTightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.spiralTightness, 0.1, 6),
        dissipationDuration: numberValue(growthVortexInput?.dissipationDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.dissipationDuration, 0.2, 12),
        dissipationSpread: numberValue(growthVortexInput?.dissipationSpread, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.dissipationSpread, 0, 3),
        color: colorValue(growthVortexInput?.color, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.growthVortex.color),
      },
      seedScale: numberValue(growthInput?.seedScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedScale, 0.65, 1.4),
      flowerGrowthDuration: numberValue(growthInput?.flowerGrowthDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.flowerGrowthDuration, 4, 14),
      islandRadius: numberValue(growthInput?.islandRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.islandRadius, 0.55, 1.05),
      islandThickness: numberValue(growthInput?.islandThickness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.islandThickness, 0.1, 0.55),
      islandDepth: numberValue(growthInput?.islandDepth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.islandDepth, 0.25, 1.4),
      islandRoughness: numberValue(growthInput?.islandRoughness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.islandRoughness, 0, 1),
      grassDensity: numberValue(growthInput?.grassDensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.grassDensity, 80, 720, true),
      grassHeight: numberValue(growthInput?.grassHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.grassHeight, 0.06, 0.28),
      windStrength: numberValue(growthInput?.windStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.windStrength, 0, 2.5),
      windSpeed: numberValue(growthInput?.windSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.windSpeed, 0, 2.5),
      seedOrbitCount: numberValue(growthInput?.seedOrbitCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedOrbitCount, 1, 5, true),
      seedOrbitRadius: numberValue(growthInput?.seedOrbitRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedOrbitRadius, 0.24, 0.62),
      seedOrbitTilt: numberValue(growthInput?.seedOrbitTilt, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedOrbitTilt, 0.15, 1.2),
      seedOrbitSpeed: numberValue(growthInput?.seedOrbitSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedOrbitSpeed, 0, 2),
      seedFallDuration: numberValue(growthInput?.seedFallDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedFallDuration, 1.8, 20),
      seedFallAcceleration: numberValue(growthInput?.seedFallAcceleration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedFallAcceleration, 1, 5),
      seedFallHeight: numberValue(growthInput?.seedFallHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedFallHeight, 2, 6.4),
      seedCameraLag: numberValue(growthInput?.seedCameraLag, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedCameraLag, 0.1, 0.8),
      seedCameraFollowSpeed: numberValue(growthInput?.seedCameraFollowSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedCameraFollowSpeed, 0.1, 8),
      seedSpinSpeed: numberValue(growthInput?.seedSpinSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedSpinSpeed, 0, 4),
      seedTumbleSpeed: numberValue(growthInput?.seedTumbleSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTumbleSpeed, 0, 3),
      seedWobbleAmplitude: numberValue(growthInput?.seedWobbleAmplitude, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedWobbleAmplitude, 0, 0.35),
      islandRevealDuration: numberValue(growthInput?.islandRevealDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.islandRevealDuration, 0.4, 3),
      seedTrailIntensity: numberValue(growthInput?.seedTrailIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTrailIntensity, 0, 2),
      seedTrailSpread: numberValue(growthInput?.seedTrailSpread, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTrailSpread, 0, 0.5),
      seedTrailLifetime: numberValue(growthInput?.seedTrailLifetime, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTrailLifetime, 0.15, 2),
      seedTrailLiftSpeed: numberValue(growthInput?.seedTrailLiftSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTrailLiftSpeed, 0.1, 2),
      seedTrailParticleCount: numberValue(growthInput?.seedTrailParticleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedTrailParticleCount, 12, 128, true),
      seedImpactStrength: numberValue(growthInput?.seedImpactStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedImpactStrength, 0, 1),
      seedImpactRadius: numberValue(growthInput?.seedImpactRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedImpactRadius, 0.1, 1.2),
      seedImpactParticles: numberValue(growthInput?.seedImpactParticles, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedImpactParticles, 0, 180, true),
      seedImpactLifetime: numberValue(growthInput?.seedImpactLifetime, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedImpactLifetime, 0.2, 1.6),
      moonLightIntensity: numberValue(growthInput?.moonLightIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonLightIntensity, 0, 2),
      moonLightColor: colorValue(growthInput?.moonLightColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonLightColor),
      moonBeamRadius: numberValue(growthInput?.moonBeamRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonBeamRadius, 0.4, 4),
      moonBeamSoftness: numberValue(growthInput?.moonBeamSoftness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonBeamSoftness, 0.05, 1),
      moonBeamIntensity: numberValue(growthInput?.moonBeamIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonBeamIntensity, 0, 1.5),
      moonScatteringIntensity: numberValue(growthInput?.moonScatteringIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonScatteringIntensity, 0, 1.5),
      moonPositionX: numberValue(growthInput?.moonPositionX, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonPositionX, -4, 4),
      moonPositionY: numberValue(growthInput?.moonPositionY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonPositionY, 1, 10),
      moonPositionZ: numberValue(growthInput?.moonPositionZ, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.moonPositionZ, -4, 4),
      cloudCount: numberValue(growthInput?.cloudCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudCount, 0, 24, true),
      cloudDensity: numberValue(growthInput?.cloudDensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudDensity, 0, 2),
      cloudScale: numberValue(growthInput?.cloudScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudScale, 0.4, 2),
      cloudDriftSpeed: numberValue(growthInput?.cloudDriftSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudDriftSpeed, 0, 2),
      cloudOpacity: numberValue(growthInput?.cloudOpacity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudOpacity, 0, 1),
      cloudLightIntensity: numberValue(growthInput?.cloudLightIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudLightIntensity, 0, 2),
      cloudSizeVariation: numberValue(growthInput?.cloudSizeVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudSizeVariation, 0, 1),
      cloudLightVariation: numberValue(growthInput?.cloudLightVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudLightVariation, 0, 1),
      cloudPathDensity: numberValue(growthInput?.cloudPathDensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudPathDensity, 0, 1),
      cloudShapeVariation: numberValue(growthInput?.cloudShapeVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudShapeVariation, 0, 1),
      cloudDepthVariation: numberValue(growthInput?.cloudDepthVariation, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudDepthVariation, 0, 1),
      cloudLayers: normalizeGrowthCloudLayers(growthInput?.cloudLayers),
    },
    bloom: {
      flowerBloomDuration: numberValue(bloomInput?.flowerBloomDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.flowerBloomDuration, 6, 24),
      cameraApproachDuration: numberValue(bloomInput?.cameraApproachDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraApproachDuration, 1, 22),
      cameraBloomSync: numberValue(bloomInput?.cameraBloomSync, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraBloomSync, 0.5, 0.85),
      cameraFinalDistance: numberValue(bloomInput?.cameraFinalDistance, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraFinalDistance, 1.5, 5),
      cameraFinalHeight: numberValue(bloomInput?.cameraFinalHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraFinalHeight, 0.5, 4),
      cameraTargetX: numberValue(bloomInput?.cameraTargetX, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraTargetX, -1, 1),
      cameraTargetY: numberValue(bloomInput?.cameraTargetY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.cameraTargetY, -0.5, 3),
      textPositionX: numberValue(bloomInput?.textPositionX, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textPositionX, 0.05, 0.48),
      textPositionY: numberValue(bloomInput?.textPositionY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textPositionY, 0.1, 0.9),
      textSize: numberValue(bloomInput?.textSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textSize, 26, 100),
      textColor: colorValue(bloomInput?.textColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textColor),
      textWritingDuration: numberValue(bloomInput?.textWritingDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textWritingDuration, 1, 12),
      textParticleCount: numberValue(bloomInput?.textParticleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.textParticleCount, 300, 6000, true),
      lilyBloomPollen: {
        enabled: typeof lilyBloomPollenInput?.enabled === 'boolean' ? lilyBloomPollenInput.enabled : DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.enabled,
        particleCount: numberValue(lilyBloomPollenInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.particleCount, 0, 600, true),
        particleSize: numberValue(lilyBloomPollenInput?.particleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.particleSize, 0.2, 6),
        glowIntensity: numberValue(lilyBloomPollenInput?.glowIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.glowIntensity, 0, 3),
        riseSpeed: numberValue(lilyBloomPollenInput?.riseSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.riseSpeed, 0, 0.5),
        spreadRadius: numberValue(lilyBloomPollenInput?.spreadRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.spreadRadius, 0.01, 0.8),
        lifetime: numberValue(lilyBloomPollenInput?.lifetime, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.lifetime, 0.5, 12),
        innerCupGlow: numberValue(lilyBloomPollenInput?.innerCupGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom.lilyBloomPollen.innerCupGlow, 0, 2),
      },
    },
    identity: {
      dissolveDuration: numberValue(identityInput?.dissolveDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.dissolveDuration, 2, 18),
      particleCount: numberValue(identityInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.particleCount, 1000, 100000, true),
      particleSize: numberValue(identityInput?.particleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.particleSize, 0.5, 6),
      edgeWidth: numberValue(identityInput?.edgeWidth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.edgeWidth, 0.005, 0.1),
      particleBrightness: numberValue(identityInput?.particleBrightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.particleBrightness, 0.25, 2),
      vortexRadius: numberValue(identityInput?.vortexRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.vortexRadius, 0.5, 3),
      vortexExpansion: numberValue(identityInput?.vortexExpansion, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.vortexExpansion, 0, 1.5),
      swirlSpeed: numberValue(identityInput?.swirlSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.swirlSpeed, 0, 8),
      swirlAcceleration: numberValue(identityInput?.swirlAcceleration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.swirlAcceleration, 0, 3),
      centerDissolveAt: numberValue(identityInput?.centerDissolveAt, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.centerDissolveAt, 0.1, 0.9),
      cameraPullback: numberValue(identityInput?.cameraPullback, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.cameraPullback, 0, 5),
      cameraRise: numberValue(identityInput?.cameraRise, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.cameraRise, 0, 3),
      cameraMoveDuration: numberValue(identityInput?.cameraMoveDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.cameraMoveDuration, 1, 18),
      portraitStart: numberValue(identityInput?.portraitStart, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitStart, 0, 30),
      portraitDuration: numberValue(identityInput?.portraitDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitDuration, 2, 16),
      portraitStartProgress: numberValue(identityInput?.portraitStartProgress, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitStartProgress, 0, 1),
      portraitFraction: numberValue(identityInput?.portraitFraction, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitFraction, 0, 0.45),
      portraitMinTurns: numberValue(identityInput?.portraitMinTurns, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitMinTurns, 0, 4),
      portraitMaxTurns: numberValue(identityInput?.portraitMaxTurns, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitMaxTurns, 0, 4),
      portraitSteering: numberValue(identityInput?.portraitSteering, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitSteering, 0, 2),
      portraitBraking: numberValue(identityInput?.portraitBraking, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitBraking, 0.25, 2),
      portraitSettledBrightness: numberValue(identityInput?.portraitSettledBrightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitSettledBrightness, 1, 2),
      vortexSpeedMultiplier: numberValue(identityInput?.vortexSpeedMultiplier, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.vortexSpeedMultiplier, 0, 2),
      portraitDetail: numberValue(identityInput?.portraitDetail, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitDetail, 0.5, 2),
      portraitBrightness: numberValue(identityInput?.portraitBrightness, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitBrightness, 1.1, 2),
      portraitSize: numberValue(identityInput?.portraitSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitSize, 0.6, 1.8),
      portraitScale: numberValue(identityInput?.portraitScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitScale, 0.55, 1.25),
      portraitOffsetX: numberValue(identityInput?.portraitOffsetX, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitOffsetX, -1, 1),
      portraitOffsetY: numberValue(identityInput?.portraitOffsetY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity.portraitOffsetY, -1, 1),
    },
    gallery: normalizeGallery(galleryInput),
    galaxy: normalizeGalaxy(galaxySettingsInput),
  }
  if (scenes.identity.portraitMinTurns > scenes.identity.portraitMaxTurns) {
    scenes.identity.portraitMaxTurns = scenes.identity.portraitMinTurns
  }
  if (scenes.prologue.particleSizeMin > scenes.prologue.particleSizeMax) {
    scenes.prologue.particleSizeMax = scenes.prologue.particleSizeMin
  }
  const preset = enumValue(root.preset, ['moonlit-letter', 'stardust', 'vasilisa-cinematic'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.preset)
  // Construct each level explicitly so unknown keys never enter the active model.
  return deepFreeze({ schemaVersion: 25, global, scenes, preset })
}

function migrateGalaxySettings(input: Record<string, unknown> | undefined, version: unknown) {
  if (typeof version === 'number' && version >= 5) return input
  if (!input) return { blackHoleEnabled: false }
  const radius = numberValue(input.radius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy.radius, 4, 14)
  const migrated: Record<string, unknown> = {
    ...input,
    seed: typeof input.seed === 'string' ? input.seed : String(input.seed ?? DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy.seed),
    blackHoleEnabled: typeof input.blackHoleEnabled === 'boolean' ? input.blackHoleEnabled : false,
  }
  if (version === 3 && typeof input.spin === 'number') migrated.spin = input.spin * Math.PI * 2
  if (typeof input.armWidth === 'number') migrated.armWidth = input.armWidth * 0.25
  if (typeof input.scatter === 'number') migrated.randomness = input.scatter * 0.197
  if (typeof input.coreSize === 'number') migrated.coreSize = input.coreSize / radius
  if (typeof input.coreDensity === 'number') migrated.coreDensity = input.coreDensity * 0.62
  if (typeof input.thickness === 'number') migrated.thickness = input.thickness / radius
  return migrated
}

function normalizeGallery(input: Record<string, unknown> | undefined): SceneComposerConfig['scenes']['gallery'] {
  const d = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery
  const cloudLayers = normalizeGalleryCloudLayers(input)
  const layoutA = input?.galleryLayoutA && typeof input.galleryLayoutA === 'object' ? input.galleryLayoutA as Record<string, unknown> : undefined
  const layoutB = input?.galleryLayoutB && typeof input.galleryLayoutB === 'object' ? input.galleryLayoutB as Record<string, unknown> : undefined
  return {
    galleryLayoutVariant: enumValue(input?.galleryLayoutVariant, ['on-columns', 'between-columns'] as const, d.galleryLayoutVariant),
    galleryLayoutA: {
      laneWidth: numberValue(layoutA?.laneWidth, numberValue(input?.galleryWidth, d.galleryLayoutA.laneWidth, 6, 12), 6, 12),
      offsetX: numberValue(layoutA?.offsetX, d.galleryLayoutA.offsetX, -3, 3),
      offsetY: numberValue(layoutA?.offsetY, d.galleryLayoutA.offsetY, -2, 2),
      offsetZ: numberValue(layoutA?.offsetZ, d.galleryLayoutA.offsetZ, -5, 5),
    },
    galleryLayoutB: {
      laneWidth: numberValue(layoutB?.laneWidth, numberValue(input?.galleryWidth, d.galleryLayoutB.laneWidth, 6, 12), 6, 12),
      // v17 profiles allowed -3; preserve those saved values while applying the
      // tighter current bound used to keep the two mirrored cards apart.
      offsetX: clampedNumberValue(layoutB?.offsetX, d.galleryLayoutB.offsetX, -3, 3, -2.5, 3),
      offsetY: numberValue(layoutB?.offsetY, d.galleryLayoutB.offsetY, -2, 2),
      offsetZ: numberValue(layoutB?.offsetZ, d.galleryLayoutB.offsetZ, -5, 5),
    },
    galleryPhotoFacingMaxDegrees: numberValue(input?.galleryPhotoFacingMaxDegrees, d.galleryPhotoFacingMaxDegrees, 0, 45),
    galleryWidth: numberValue(input?.galleryWidth, d.galleryWidth, 6, 12),
    columnVisible: typeof input?.columnVisible === 'boolean' ? input.columnVisible : d.columnVisible,
    columnScale: numberValue(input?.columnScale, d.columnScale, 0.75, 3),
    columnDepth: numberValue(input?.columnDepth, d.columnDepth, 0.02, 2),
    columnOffsetX: numberValue(input?.columnOffsetX, d.columnOffsetX, -2, 2),
    columnOffsetY: numberValue(input?.columnOffsetY, d.columnOffsetY, -2, 2),
    archVisible: typeof input?.archVisible === 'boolean' ? input.archVisible : d.archVisible,
    archScale: numberValue(input?.archScale, d.archScale, 8, 28),
    archOpacity: numberValue(input?.archOpacity, d.archOpacity, 0.1, 1),
    archPositionX: numberValue(input?.archPositionX, d.archPositionX, -30, 30),
    archPositionY: numberValue(input?.archPositionY, d.archPositionY, -12, 24),
    archPositionZ: numberValue(input?.archPositionZ, d.archPositionZ, -140, -65),
    archRotationY: numberValue(input?.archRotationY, d.archRotationY, -Math.PI, Math.PI),
    frameIntensity: numberValue(input?.frameIntensity, d.frameIntensity, 0, 2),
    particleCount: numberValue(input?.particleCount, d.particleCount, 0, 600, true),
    collageParticleCount: numberValue(input?.collageParticleCount, d.collageParticleCount, 96, 90000, true),
    collageParticleSize: numberValue(input?.collageParticleSize, d.collageParticleSize, 1, 8),
    collageNoiseStrength: numberValue(input?.collageNoiseStrength, d.collageNoiseStrength, 0, 0.12),
    collageDepth: numberValue(input?.collageDepth, d.collageDepth, 0, 0.8),
    collageGlow: numberValue(input?.collageGlow, d.collageGlow, 0, 2),
    collageAssembleDuration: numberValue(input?.collageAssembleDuration, d.collageAssembleDuration, 0.25, 10),
    collageRevealDuration: numberValue(input?.collageRevealDuration, d.collageRevealDuration, 0.25, 6),
    collageStaggerDelay: numberValue(input?.collageStaggerDelay, d.collageStaggerDelay, 0, 0.5),
    collagePhotoScale: numberValue(input?.collagePhotoScale, d.collagePhotoScale, 0.5, 1),
    collagePhotoGap: numberValue(input?.collagePhotoGap, d.collagePhotoGap, 0.1, 1.5),
    captionFontSize: numberValue(input?.captionFontSize, d.captionFontSize, 20, 40, true),
    moonBrightness: numberValue(input?.moonBrightness, d.moonBrightness, 0, 2),
    moonSize: numberValue(input?.moonSize, d.moonSize, 0.4, 1.8),
    cloudDriftVariation: numberValue(input?.cloudDriftVariation, d.cloudDriftVariation, 0, 1),
    cloudLayers,
    cloudCoolTint: numberValue(input?.cloudCoolTint, d.cloudCoolTint, 0, 1.5),
    cloudWhiteHighlight: numberValue(input?.cloudWhiteHighlight, d.cloudWhiteHighlight, 0, 1.5),
    hazeDensity: numberValue(input?.hazeDensity, d.hazeDensity, 0, 1.8),
    hazeHeight: numberValue(input?.hazeHeight, d.hazeHeight, -3, 3),
    hazeMotionSpeed: numberValue(input?.hazeMotionSpeed, d.hazeMotionSpeed, 0, 3),
    reflectionStrength: numberValue(input?.reflectionStrength, d.reflectionStrength, 0, 0.9),
    reflectionBlur: numberValue(input?.reflectionBlur, d.reflectionBlur, 0.3, 1.5),
    reflectionFalloff: numberValue(input?.reflectionFalloff, d.reflectionFalloff, 0.25, 2.5),
    waterBaseBrightness: numberValue(input?.waterBaseBrightness, d.waterBaseBrightness, 0, 1.5),
    waterDistortion: numberValue(input?.waterDistortion, d.waterDistortion, 0, 0.14),
    waterDistortionScale: numberValue(input?.waterDistortionScale, d.waterDistortionScale, 0.25, 4.5),
    waterRippleSpeed: numberValue(input?.waterRippleSpeed, d.waterRippleSpeed, 0, 3),
    waterNormalStrength: numberValue(input?.waterNormalStrength, d.waterNormalStrength, 0, 3),
    moonHighlightStrength: numberValue(input?.moonHighlightStrength, d.moonHighlightStrength, 0, 2),
    moonReflectionSpread: numberValue(input?.moonReflectionSpread, d.moonReflectionSpread, 0.25, 4),
    waterOpacity: numberValue(input?.waterOpacity, d.waterOpacity, 0, 1),
    threadOpacity: numberValue(input?.threadOpacity, d.threadOpacity, 0, 0.8),
    coldLightIntensity: numberValue(input?.coldLightIntensity, d.coldLightIntensity, 0, 1.8),
    moonLightIntensity: numberValue(input?.moonLightIntensity, d.moonLightIntensity, 0, 3),
    moonFillIntensity: numberValue(input?.moonFillIntensity, d.moonFillIntensity, 0, 1.2),
    moonHaloIntensity: numberValue(input?.moonHaloIntensity, d.moonHaloIntensity, 0, 2),
    moonCloudLightIntensity: numberValue(input?.moonCloudLightIntensity, d.moonCloudLightIntensity, 0, 2),
    moonScatteringIntensity: numberValue(input?.moonScatteringIntensity, d.moonScatteringIntensity, 0, 1.5),
    moonLightColor: colorValue(input?.moonLightColor, d.moonLightColor),
    moonPositionX: numberValue(input?.moonPositionX, d.moonPositionX, -12, 12),
    moonPositionY: numberValue(input?.moonPositionY, d.moonPositionY, 4, 24),
    moonPositionZ: numberValue(input?.moonPositionZ, d.moonPositionZ, -180, -80),
    moonTargetX: numberValue(input?.moonTargetX, d.moonTargetX, -40, 40),
    moonTargetY: numberValue(input?.moonTargetY, d.moonTargetY, -12, 14),
    moonTargetZ: numberValue(input?.moonTargetZ, d.moonTargetZ, -180, 40),
    moonHaloRadius: numberValue(input?.moonHaloRadius, d.moonHaloRadius, 0, 2.5),
    moonGodRaysIntensity: numberValue(input?.moonGodRaysIntensity, d.moonGodRaysIntensity, 0, 0.8),
  }
}

function normalizeGalleryCloudLayers(input: Record<string, unknown> | undefined): GalleryCloudLayers {
  const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.cloudLayers
  const source = asRecord(input?.cloudLayers)
  const legacyLayers = ['far', 'mid', 'nearLow', 'waterline'] as const
  const layers = [...legacyLayers, 'moon'] as const
  const legacyLayerCount = !source && typeof input?.cloudLayerCount === 'number'
    ? numberValue(input.cloudLayerCount, 18, 0, 18, true)
    : undefined
  const legacyDensity = numberValue(input?.cloudDensity, 1.12, 0, 1.8)
  const legacyOpacity = numberValue(input?.cloudOpacity, 0.88, 0, 1.8)
  const legacyBrightness = numberValue(input?.cloudIntensity, 1, 0, 2)
  const legacyScale = numberValue(input?.cloudScale, 1, 0.55, 2)
  const legacyDrift = numberValue(input?.cloudDriftSpeed, 0.82, 0, 2)
  const legacyAmounts = {
    far: numberValue(input?.cloudBackgroundAmount, 0.78, 0, 1.6),
    mid: 1,
    nearLow: numberValue(input?.cloudForegroundAmount, 1, 0, 1.6),
    waterline: numberValue(input?.cloudNearFloorAmount, 1, 0, 1.6),
    moon: 1,
  }
  const legacyMoonCount = legacyLayerCount === undefined ? defaults.moon.count : Math.min(defaults.moon.count, legacyLayerCount)
  const counts = distributeLegacyCloudCount(legacyLayerCount === undefined ? undefined : Math.max(0, legacyLayerCount - legacyMoonCount), legacyLayers.map((layer) => defaults[layer].count))
  const next = Object.fromEntries(layers.map((layer) => {
    const value = asRecord(source?.[layer])
    const d = defaults[layer]
    const maxCount = layer === 'far' ? 12 : layer === 'mid' ? 20 : layer === 'nearLow' ? 24 : layer === 'waterline' ? 32 : 8
    return [layer, {
      count: numberValue(value?.count, legacyLayerCount === undefined ? d.count : layer === 'moon' ? legacyMoonCount : counts[legacyLayers.findIndex((legacyLayer) => legacyLayer === layer)]!, 0, maxCount, true),
      density: numberValue(value?.density, input?.cloudDensity === undefined ? d.density : legacyDensity, 0, 1.8),
      scale: numberValue(value?.scale, input?.cloudScale === undefined ? d.scale : legacyScale, 0.55, 2),
      opacity: numberValue(value?.opacity,
        input?.cloudOpacity === undefined && input?.cloudBackgroundAmount === undefined && input?.cloudForegroundAmount === undefined && input?.cloudNearFloorAmount === undefined
          ? d.opacity
          : legacyOpacity * legacyAmounts[layer], 0, 1.8),
      brightness: numberValue(value?.brightness, input?.cloudIntensity === undefined ? d.brightness : legacyBrightness, 0, 2),
      driftSpeed: numberValue(value?.driftSpeed, input?.cloudDriftSpeed === undefined ? d.driftSpeed : legacyDrift, 0, 3),
      height: numberValue(value?.height, d.height, -8, 12),
      distance: numberValue(value?.distance, d.distance, 0, 24),
      softness: numberValue(value?.softness, d.softness, 0, 1),
    }]
  })) as unknown as GalleryCloudLayers
  return next
}

function distributeLegacyCloudCount(count: number | undefined, weights: readonly number[]): number[] {
  if (count === undefined) return weights.map(() => 0)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) => count * weight / totalWeight)
  const counts = exact.map(Math.floor)
  let remaining = count - counts.reduce((sum, value) => sum + value, 0)
  const order = exact.map((value, index) => ({ index, remainder: value - counts[index]! }))
    .sort((a, b) => b.remainder - a.remainder)
  for (const { index } of order) {
    if (remaining <= 0) break
    counts[index]! += 1
    remaining -= 1
  }
  return counts
}

function normalizeGalaxy(input: Record<string, unknown> | undefined): SceneComposerConfig['scenes']['galaxy'] {
  const d = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy
  return {
    quality: enumValue(input?.quality, ['low', 'standard', 'high'] as const, d.quality),
    seed: typeof input?.seed === 'string' && input.seed.length > 0 ? input.seed.slice(0, 64) : d.seed,
    starCount: numberValue(input?.starCount, d.starCount, 8000, 90000, true),
    arms: numberValue(input?.arms, d.arms, 2, 8, true), radius: numberValue(input?.radius, d.radius, 4, 14),
    spin: numberValue(input?.spin, d.spin, 0.2, 18), armWidth: numberValue(input?.armWidth, d.armWidth, 0, 0.5),
    randomness: numberValue(input?.randomness, d.randomness, 0, 0.3), randomnessPower: numberValue(input?.randomnessPower, d.randomnessPower, 0.1, 8),
    coreSize: numberValue(input?.coreSize, d.coreSize, 0.08, 0.5),
    coreDensity: numberValue(input?.coreDensity, d.coreDensity, 0, 0.5), thickness: numberValue(input?.thickness, d.thickness, 0.005, 0.2),
    distribution: enumValue(input?.distribution, ['balanced', 'core', 'arms'] as const, d.distribution),
    starSize: numberValue(input?.starSize, d.starSize, 0.25, 3.5), brightness: numberValue(input?.brightness, d.brightness, 0.1, 1.5),
    twinkle: numberValue(input?.twinkle, d.twinkle, 0, 1), twinkleSpeed: numberValue(input?.twinkleSpeed, d.twinkleSpeed, 0, 3),
    brightStarCount: numberValue(input?.brightStarCount, d.brightStarCount, 0, 200, true),
    brightStarSize: numberValue(input?.brightStarSize, d.brightStarSize, 1, 8), brightStarIntensity: numberValue(input?.brightStarIntensity, d.brightStarIntensity, 0, 3),
    backgroundStarCount: numberValue(input?.backgroundStarCount, d.backgroundStarCount, 0, 10000, true),
    backgroundBrightness: numberValue(input?.backgroundBrightness, d.backgroundBrightness, 0, 1), backgroundSize: numberValue(input?.backgroundSize, d.backgroundSize, 0.2, 2.5),
    backgroundDepth: numberValue(input?.backgroundDepth, d.backgroundDepth, 15, 100),
    backgroundGasDensity: numberValue(input?.backgroundGasDensity, d.backgroundGasDensity, 0, 0.8),
    backgroundGasBrightness: numberValue(input?.backgroundGasBrightness, d.backgroundGasBrightness, 0, 1),
    nebulaEnabled: typeof input?.nebulaEnabled === 'boolean' ? input.nebulaEnabled : d.nebulaEnabled,
    blackHoleEnabled: typeof input?.blackHoleEnabled === 'boolean' ? input.blackHoleEnabled : d.blackHoleEnabled,
    nebulaDensity: numberValue(input?.nebulaDensity, d.nebulaDensity, 0, 1), nebulaBrightness: numberValue(input?.nebulaBrightness, d.nebulaBrightness, 0, 1.5),
    nebulaSaturation: numberValue(input?.nebulaSaturation, d.nebulaSaturation, 0, 1.5), nebulaOpacity: numberValue(input?.nebulaOpacity, d.nebulaOpacity, 0, 1),
    nebulaScale: numberValue(input?.nebulaScale, d.nebulaScale, 0.3, 4), nebulaIntensity: numberValue(input?.nebulaIntensity, d.nebulaIntensity, 0, 2),
    nebulaSpeed: numberValue(input?.nebulaSpeed, d.nebulaSpeed, 0, 0.1), fogDensity: numberValue(input?.fogDensity, d.fogDensity, 0, 1),
    fogLayers: numberValue(input?.fogLayers, d.fogLayers, 1, 8, true), fogDepth: numberValue(input?.fogDepth, d.fogDepth, 4, 30),
    fogDissipation: numberValue(input?.fogDissipation, d.fogDissipation, 0, 1), fogStart: numberValue(input?.fogStart, d.fogStart, 0, 8),
    fogEnd: numberValue(input?.fogEnd, d.fogEnd, 4, 18), fogTurbulence: numberValue(input?.fogTurbulence, d.fogTurbulence, 0, 1),
    fogAfterOpacity: numberValue(input?.fogAfterOpacity, d.fogAfterOpacity, 0, 0.2),
    palette: enumValue(input?.palette, ['vasilisa', 'spore', 'ember', 'emerald', 'ice', 'rose', 'custom'] as const, d.palette),
    coreColor: colorValue(input?.coreColor, d.coreColor), innerColor: colorValue(input?.innerColor, d.innerColor),
    armColor: colorValue(input?.armColor, d.armColor), nebulaColor: colorValue(input?.nebulaColor, d.nebulaColor),
    brightColor: colorValue(input?.brightColor, d.brightColor), backgroundColor: colorValue(input?.backgroundColor, d.backgroundColor),
    exposure: numberValue(input?.exposure, d.exposure, 0.3, 1.8), coreGlow: numberValue(input?.coreGlow, d.coreGlow, 0, 2),
    rotationSpeed: numberValue(input?.rotationSpeed, d.rotationSpeed, 0, 0.1), motionSpeed: numberValue(input?.motionSpeed, d.motionSpeed, 0, 2),
    revealMotion: numberValue(input?.revealMotion, d.revealMotion, 0, 3), idleMotion: numberValue(input?.idleMotion, d.idleMotion, 0, 0.6),
    firstStarsAt: numberValue(input?.firstStarsAt, d.firstStarsAt, 0, 6), galaxyRevealAt: numberValue(input?.galaxyRevealAt, d.galaxyRevealAt, 0, 10),
    revealDuration: numberValue(input?.revealDuration, d.revealDuration, 5, 18), pauseDuration: numberValue(input?.pauseDuration, d.pauseDuration, 0, 12),
    backgroundTransition: numberValue(input?.backgroundTransition, d.backgroundTransition, 2, 18),
    cameraStartDistance: numberValue(input?.cameraStartDistance, d.cameraStartDistance, 3, 12), cameraEndDistance: numberValue(input?.cameraEndDistance, d.cameraEndDistance, 9, 28),
    cameraStartAngle: numberValue(input?.cameraStartAngle, d.cameraStartAngle, -0.3, 0.8), cameraEndAngle: numberValue(input?.cameraEndAngle, d.cameraEndAngle, 0.1, 0.95),
    cameraFocusX: numberValue(input?.cameraFocusX, d.cameraFocusX, -3, 3), cameraFocusY: numberValue(input?.cameraFocusY, d.cameraFocusY, -3, 3),
    cameraDuration: numberValue(input?.cameraDuration, d.cameraDuration, 5, 18),
    cameraEase: enumValue(input?.cameraEase, ['sine', 'power2', 'power3'] as const, d.cameraEase),
    cameraSlowdown: numberValue(input?.cameraSlowdown, d.cameraSlowdown, 0, 8), compositionScale: numberValue(input?.compositionScale, d.compositionScale, 0.65, 1.4),
  }
}

export function getConfig(): SceneComposerConfig { return activeConfig }

export function subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void {
  configListeners.add(listener)
  return () => configListeners.delete(listener)
}

export async function updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig> {
  const revision = ++updateRevision
  const updated = await applyConfig(normalizeConfig(mergePartial(activeConfig, patch)), revision, false)
  persistLilyGrowthVfx(updated)
  return updated
}

export async function resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig> {
  if (scope === 'all') return updateConfig(DEFAULT_SCENE_COMPOSER_CONFIG)
  if (scope === 'global') return updateConfig({ global: DEFAULT_SCENE_COMPOSER_CONFIG.global })
  if (scope === 'preset') return updateConfig({ preset: DEFAULT_SCENE_COMPOSER_CONFIG.preset })
  const sceneKey = scope
  return updateConfig({ scenes: { [sceneKey]: DEFAULT_SCENE_COMPOSER_CONFIG.scenes[sceneKey] } })
}

/** Load a same-origin optional startup override without touching preload readiness. */
export function loadStartupConfig(): Promise<void> {
  startupConfigRequest ??= readStartupConfig()
  return startupConfigRequest
}

async function readStartupConfig() {
  const revision = updateRevision
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}scene-composer.json`, {
      cache: 'no-cache', signal: AbortSignal.timeout(2000),
    })
    if (!response.ok || revision !== updateRevision) return
    const input: unknown = await response.json()
    if (revision !== updateRevision) return
    await applyConfig(normalizeConfig(input), revision, true)
  } catch {
    // This file is intentionally optional; defaults remain active on HTTP, JSON, or network errors.
  }
}

async function applyConfig(candidate: SceneComposerConfig, revision: number, fallbackFailedFonts: boolean): Promise<SceneComposerConfig> {
  const current = activeConfig
  const changedFaces = changedFontFaces(current, candidate)
  let loadArtFont: ((id: ArtFontId) => Promise<boolean>) | undefined
  if (changedFaces.length || fallbackFailedFonts) {
    try { loadArtFont = (await import('./fontCatalog')).loadArtFont }
    catch { return activeConfig }
  }
  const readiness = new Map<ArtFontId, boolean>()
  for (const id of changedFaces) readiness.set(id, (await loadArtFont!(id)))
  if (revision !== updateRevision) return activeConfig

  if (Array.from(readiness.values()).some((ready) => !ready)) {
    if (!fallbackFailedFonts) return activeConfig
    const fallback = normalizeConfig({
      ...candidate,
      scenes: {
        ...candidate.scenes,
        prologue: { ...candidate.scenes.prologue, fontFamily: DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily },
      },
    })
    const fallbackFaces = changedFontFaces(current, fallback)
    for (const id of fallbackFaces) {
      const ready = readiness.get(id) ?? (await loadArtFont!(id))
      if (!ready) return activeConfig
    }
    if (revision !== updateRevision) return activeConfig
    activeConfig = fallback
  } else activeConfig = candidate

  for (const listener of configListeners) listener(activeConfig)
  return activeConfig
}

function changedFontFaces(current: SceneComposerConfig, next: SceneComposerConfig): ArtFontId[] {
  const candidate = [next.scenes.prologue.fontFamily]
  const active = new Set([current.scenes.prologue.fontFamily])
  return [...new Set(candidate.filter((id) => !active.has(id)))]
}

function mergePartial(base: unknown, patch: unknown): unknown {
  const baseRecord = asRecord(base)
  const patchRecord = asRecord(patch)
  if (!baseRecord || !patchRecord) return patch === undefined ? base : patch
  const result: Record<string, unknown> = { ...baseRecord }
  for (const [key, value] of Object.entries(patchRecord)) {
    if (value !== undefined) result[key] = mergePartial(result[key], value)
  }
  return result
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function numberValue(value: unknown, fallback: number, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return fallback
  return value
}

function boundedNumberValue(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clamp(value, min, max)
}
function clampedNumberValue(value: unknown, fallback: number, acceptedMin: number, acceptedMax: number, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < acceptedMin || value > acceptedMax || (integer && !Number.isInteger(value))) return fallback
  return clamp(value, min, max)
}

function migrateLegacyNumber(value: unknown, fallback: number, legacyMin: number, legacyMax: number, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < legacyMin || value > legacyMax || (integer && !Number.isInteger(value))) return fallback
  return clamp(value, min, max)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function enumValue<const Values extends readonly string[]>(value: unknown, allowed: Values, fallback: Values[number]): Values[number] {
  return typeof value === 'string' && allowed.includes(value) ? value as Values[number] : fallback
}

function fontValue(value: unknown, fallback: ArtFontId): ArtFontId {
  return isArtFontId(value) ? value : fallback
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value) ? value.toUpperCase() : fallback
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function persistLilyGrowthVfx(config: SceneComposerConfig) {
  if (!isDeveloperMode() || typeof window === 'undefined') return
  const settings = {
    ...Object.fromEntries(LILY_GROWTH_VFX_FIELDS.map((field) => [field, config.scenes.growth[field]])),
    lilyBudGlow: config.scenes.growth.lilyBudGlow,
    lilyLeafMaterial: config.scenes.growth.lilyLeafMaterial,
    growthVortex: config.scenes.growth.growthVortex,
    lilyBloomPollen: config.scenes.bloom.lilyBloomPollen,
  }
  try { window.localStorage.setItem(LILY_GROWTH_VFX_STORAGE_KEY, JSON.stringify(settings)) }
  catch { /* Browser storage may be disabled; the live config remains usable. */ }
}

function restoreLilyGrowthVfx() {
  if (!isDeveloperMode() || typeof window === 'undefined') return
  try {
    const serialized = window.localStorage.getItem(LILY_GROWTH_VFX_STORAGE_KEY)
    if (!serialized) return
    const storedGrowth = asRecord(JSON.parse(serialized))
    if (!storedGrowth) return
    // Overlay the Lily-only draft on the complete mainline config so restoring
    // effect controls never resets island, seed, lighting, or background values.
    activeConfig = normalizeConfig(mergePartial(activeConfig, {
      scenes: {
        growth: storedGrowth,
        bloom: { lilyBloomPollen: storedGrowth.lilyBloomPollen },
      },
    }))
  } catch {
    // A corrupt or unavailable local draft should leave the expressive defaults active.
  }
}




