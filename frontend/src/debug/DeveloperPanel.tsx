import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import type { FilmRuntime } from '../engine/runtime'
import { getSceneDuration, SCENES, type SceneId } from '../engine/filmConfig'
import {
  DEFAULT_SCENE_COMPOSER_CONFIG,
  SCENE_CONFIG_PRESETS,
  getConfig,
  subscribeConfig,
  updateConfig,
  type QualityProfile,
  type GalaxyPalette,
  type SceneComposerConfig,
  type SceneComposerConfigPatch,
  type ScenePresetId,
} from '../systems/scene-config/config'
import { type ArtFontId } from '../systems/scene-config/fontIds'
import { ART_FONT_CATALOG } from '../systems/scene-config/fontCatalog'
import {
  applyComposerPreset,
  exportComposerJson,
  importComposerJson,
  resetComposerScope,
  setComposerField,
  type ComposerFieldPath,
} from './composerControls'
import { createInspectorHistory, type InspectorScope } from './inspectorHistory'
import { comparisonPointValid, type ComparisonPoint } from './inspectorCompare'
import { editGalaxyColor, getGalaxyColors, selectGalaxyPalette, type GalaxyColorKey } from '../scenes/galaxy/palette'
import ScenePresetControls from './ScenePresetControls'
import { captureScenePreset, scenePresetPatch, type ScenePresetScope } from './scenePresetModel'

type NumericControl = {
  path: ComposerFieldPath
  label: string
  unit: string
  min: number
  max: number
  step: number
  displayScale?: number
}

type InspectorScene = SceneId | 'preload'
type SelectControl = { path: ComposerFieldPath; label: string; options: readonly { value: string; label: string }[] }

const PRELOAD_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.preload.glow', label: 'Свечение', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.preload.particleCount', label: 'Частицы', unit: 'шт.', min: 40, max: 300, step: 1 },
  { path: 'scenes.preload.movementSpeed', label: 'Скорость движения', unit: '×', min: 0.1, max: 4, step: 0.1 },
  { path: 'scenes.preload.collapseDuration', label: 'Длительность схлопывания', unit: 'с', min: 0, max: 4, step: 0.1 },
]

const OPENING_BACKGROUND_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.openingBackground.zoom', label: 'Масштаб фона', unit: '×', min: 1, max: 3, step: 0.01 },
  { path: 'scenes.openingBackground.offsetX', label: 'Положение фона · X', unit: '', min: -1, max: 1, step: 0.01 },
  { path: 'scenes.openingBackground.offsetY', label: 'Положение фона · Y', unit: '', min: -1, max: 1, step: 0.01 },
]

const PROLOGUE_GROUPS: readonly { name: string; controls: readonly NumericControl[] }[] = [
  { name: 'Typography', controls: [
    { path: 'scenes.prologue.fontSize', label: 'Размер первой фразы', unit: 'px', min: 16, max: 160, step: 1 },
    { path: 'scenes.prologue.secondFontScale', label: 'Размер второй фразы', unit: '×', min: 0.6, max: 1.2, step: 0.01 },
    { path: 'scenes.prologue.lineHeight', label: 'Высота строки', unit: '×', min: 0.8, max: 2.5, step: 0.05 },
    { path: 'scenes.prologue.positionY', label: 'Положение текста', unit: '%', min: 10, max: 80, step: 1 },
    { path: 'scenes.prologue.textGap', label: 'Отступ от света', unit: 'px', min: 20, max: 100, step: 1 },
    { path: 'scenes.prologue.textGlow', label: 'Свечение текста', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.prologue.handwritingDuration', label: 'Рукописное появление', unit: 'с', min: 0.5, max: 20, step: 0.1 },
    { path: 'scenes.prologue.handwritingRhythm', label: 'Ритм письма', unit: '×', min: 0.1, max: 3, step: 0.05 },
    { path: 'scenes.prologue.promptHandwritingDuration', label: 'Рукописное появление подсказки', unit: 'с', min: 0.2, max: 0.8, step: 0.05 },
    { path: 'scenes.prologue.interphraseInterval', label: 'Пауза между фразами', unit: 'с', min: 0, max: 8, step: 0.1 },
    { path: 'scenes.prologue.readableHold', label: 'Время на чтение', unit: 'с', min: 0, max: 30, step: 0.1 },
  ] },
  { name: 'Light', controls: [
    { path: 'scenes.prologue.coreIntensity', label: 'Яркость ядра', unit: '×', min: 0.2, max: 2, step: 0.05 },
    { path: 'scenes.prologue.innerGlowRadius', label: 'Радиус внутреннего свечения', unit: 'px', min: 6, max: 40, step: 1 },
    { path: 'scenes.prologue.outerGlowRadius', label: 'Радиус рассеивания', unit: 'px', min: 40, max: 160, step: 1 },
    { path: 'scenes.prologue.glow', label: 'Сила ореола', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.prologue.pulseAmplitude', label: 'Амплитуда дыхания', unit: '×', min: 0, max: 0.3, step: 0.005 },
    { path: 'scenes.prologue.pulseFrequency', label: 'Частота дыхания', unit: 'Гц', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.prologue.phraseResponse', label: 'Отклик на фразу', unit: '×', min: 0, max: 0.5, step: 0.01 },
  ] },
  { name: 'Atmosphere', controls: [
    { path: 'scenes.prologue.atmosphereDensity', label: 'Фоновые пылинки', unit: 'шт.', min: 0, max: 120, step: 1 },
    { path: 'scenes.prologue.hazeIntensity', label: 'Дымка', unit: '×', min: 0, max: 0.12, step: 0.005 },
    { path: 'scenes.prologue.spaceDepth', label: 'Глубина пространства', unit: '×', min: 0, max: 1, step: 0.05 },
    { path: 'scenes.prologue.driftSpeed', label: 'Дрейф фона', unit: '×', min: 0, max: 0.15, step: 0.005 },
  ] },
  { name: 'Dissolve', controls: [
    { path: 'scenes.prologue.particleCount', label: 'Световая пыль', unit: 'шт.', min: 300, max: 6000, step: 1 },
    { path: 'scenes.prologue.particleSizeMin', label: 'Минимальный размер', unit: 'px', min: 0.3, max: 2, step: 0.05 },
    { path: 'scenes.prologue.particleSizeMax', label: 'Максимальный размер', unit: 'px', min: 0.5, max: 4, step: 0.05 },
    { path: 'scenes.prologue.particleGlow', label: 'Свечение пыли', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.prologue.windStrength', label: 'Ветер', unit: '×', min: 0.2, max: 3, step: 0.05 },
    { path: 'scenes.prologue.turbulence', label: 'Турбулентность', unit: '×', min: 0, max: 1, step: 0.05 },
    { path: 'scenes.prologue.fractureWidth', label: 'Ширина фронта', unit: '%', min: 0, max: 18, step: 1, displayScale: 100 },
    { path: 'scenes.prologue.fractureDuration', label: 'Длительность фронта', unit: 'с', min: 0.8, max: 4, step: 0.1 },
    { path: 'scenes.prologue.particleDuration', label: 'Длительность движения частиц', unit: 'с', min: 0.1, max: 20, step: 0.1 },
    { path: 'scenes.prologue.particleFadeDuration', label: 'Длительность затухания пыли', unit: 'с', min: 0.5, max: 4, step: 0.1 },
    { path: 'scenes.prologue.seed', label: 'Seed частиц', unit: '', min: 0, max: 2147483647, step: 1 },
  ] },
  { name: 'Interaction', controls: [
    { path: 'scenes.prologue.touchIntensity', label: 'Отклик касания', unit: '×', min: 0, max: 1.5, step: 0.05 },
    { path: 'scenes.prologue.touchDuration', label: 'Длительность отклика', unit: 'с', min: 0.7, max: 1, step: 0.05 },
    { path: 'scenes.prologue.waveStrength', label: 'Сила световой волны', unit: '×', min: 0, max: 0.4, step: 0.01 },
    { path: 'scenes.prologue.waveRadius', label: 'Радиус световой волны', unit: 'px', min: 30, max: 120, step: 1 },
  ] },
]

const GROWTH_GROUPS: readonly { name: string; controls: readonly NumericControl[]; color?: { path: ComposerFieldPath; label: string } }[] = [
  { name: 'Частицы и формирование', controls: [
    { path: 'scenes.growth.particleSize', label: 'Размер точки', unit: 'px', min: 0.5, max: 3, step: 0.1 },
    { path: 'scenes.growth.particleOpacity', label: 'Непрозрачность', unit: '×', min: 0, max: 1.5, step: 0.05 },
    { path: 'scenes.growth.cloudRadius', label: 'Радиус облака', unit: '', min: 0.3, max: 1.2, step: 0.05 },
    { path: 'scenes.growth.formationDuration', label: 'Длительность формирования', unit: 'с', min: 2.5, max: 3.5, step: 0.1 },
  ] },
  { name: 'Движение и притяжение', controls: [
    { path: 'scenes.growth.noiseStrength', label: 'Сила noise-поля', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.attractionStrength', label: 'Притяжение к форме', unit: '×', min: 2, max: 24, step: 0.5 },
    { path: 'scenes.growth.attractionRampDuration', label: 'Нарастание притяжения', unit: 'с', min: 0.5, max: 3.5, step: 0.1 },
    { path: 'scenes.growth.morphDamping', label: 'Торможение формы', unit: '×', min: 2, max: 14, step: 0.2 },
    { path: 'scenes.growth.freeParticleFraction', label: 'Свободные искры', unit: '%', min: 0, max: 20, step: 1, displayScale: 100 },
  ] },
  { name: 'Свет и размер', controls: [
    { path: 'scenes.growth.coreGlow', label: 'Свечение ядра', unit: '×', min: 0, max: 1.5, step: 0.05 },
    { path: 'scenes.growth.seedScale', label: 'Масштаб семечка', unit: '×', min: 0.65, max: 1.4, step: 0.05 },
  ] },
  { name: 'Орбита и падение семечка', controls: [
    { path: 'scenes.growth.seedOrbitCount', label: 'Число витков орбиты', unit: 'витков', min: 1, max: 5, step: 1 },
    { path: 'scenes.growth.seedOrbitRadius', label: 'Радиус орбиты', unit: 'м', min: 0.24, max: 0.62, step: 0.01 },
    { path: 'scenes.growth.seedOrbitTilt', label: 'Наклон орбиты', unit: 'рад', min: 0.15, max: 1.2, step: 0.01 },
    { path: 'scenes.growth.seedOrbitSpeed', label: 'Скорость орбиты', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.seedFallDuration', label: 'Длительность падения', unit: 'с', min: 1.8, max: 20, step: 0.1 },
    { path: 'scenes.growth.seedFallAcceleration', label: 'Ускорение падения', unit: '×', min: 1, max: 5, step: 0.05 },
    { path: 'scenes.growth.seedFallHeight', label: 'Высота начала падения', unit: '× высоты кадра', min: 2, max: 6.4, step: 0.01 },
    { path: 'scenes.growth.seedCameraLag', label: 'Запаздывание камеры', unit: 'с', min: 0.1, max: 0.8, step: 0.01 },
    { path: 'scenes.growth.seedCameraFollowSpeed', label: 'Скорость сглаженного слежения камеры', unit: 'с⁻¹', min: 0.1, max: 8, step: 0.1 },
    { path: 'scenes.growth.seedSpinSpeed', label: 'Скорость вращения семечка', unit: 'рад/с', min: 0, max: 4, step: 0.05 },
    { path: 'scenes.growth.seedTumbleSpeed', label: 'Вращение по поперечной оси', unit: 'рад/с', min: 0, max: 3, step: 0.05 },
    { path: 'scenes.growth.seedWobbleAmplitude', label: 'Амплитуда покачивания семечка', unit: 'рад', min: 0, max: 0.35, step: 0.005 },
  ] },
  { name: 'Парящий остров', controls: [
    { path: 'scenes.growth.islandRadius', label: 'Размер острова', unit: '', min: 0.55, max: 1.05, step: 0.01 },
    { path: 'scenes.growth.islandThickness', label: 'Толщина острова', unit: 'м', min: 0.1, max: 0.55, step: 0.01 },
    { path: 'scenes.growth.islandDepth', label: 'Глубина нижней части', unit: 'м', min: 0.25, max: 1.4, step: 0.01 },
    { path: 'scenes.growth.islandRoughness', label: 'Неровность краёв', unit: '×', min: 0, max: 1, step: 0.05 },
    { path: 'scenes.growth.grassDensity', label: 'Плотность травы', unit: 'шт.', min: 80, max: 720, step: 40 },
    { path: 'scenes.growth.grassHeight', label: 'Высота травы', unit: 'м', min: 0.06, max: 0.28, step: 0.01 },
    { path: 'scenes.growth.windStrength', label: 'Сила ветра', unit: '×', min: 0, max: 2.5, step: 0.05 },
    { path: 'scenes.growth.windSpeed', label: 'Скорость ветра', unit: '×', min: 0, max: 2.5, step: 0.05 },
  ] },
  { name: 'След и удар семечка', controls: [
    { path: 'scenes.growth.seedTrailIntensity', label: 'Интенсивность следа', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.seedTrailSpread', label: 'Разлёт осколков следа', unit: 'м', min: 0, max: 0.5, step: 0.01 },
    { path: 'scenes.growth.seedTrailLifetime', label: 'Время жизни осколков следа', unit: 'с', min: 0.15, max: 2, step: 0.05 },
    { path: 'scenes.growth.seedTrailLiftSpeed', label: 'Скорость отлёта вверх', unit: 'м/с', min: 0.1, max: 2, step: 0.05 },
    { path: 'scenes.growth.seedTrailParticleCount', label: 'Количество осколков', unit: 'шт.', min: 12, max: 128, step: 1 },
    { path: 'scenes.growth.seedImpactStrength', label: 'Сила удара', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.seedImpactRadius', label: 'Радиус удара', unit: 'м', min: 0.1, max: 1.2, step: 0.01 },
    { path: 'scenes.growth.seedImpactParticles', label: 'Частицы удара', unit: 'шт.', min: 0, max: 180, step: 1 },
    { path: 'scenes.growth.seedImpactLifetime', label: 'Время жизни частиц удара', unit: 'с', min: 0.2, max: 1.6, step: 0.05 },
  ] },
  { name: 'Облака', controls: [
    { path: 'scenes.growth.cloudCount', label: 'Количество облаков', unit: 'шт.', min: 0, max: 24, step: 1 },
    { path: 'scenes.growth.cloudDensity', label: 'Плотность облаков', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.cloudScale', label: 'Масштаб облаков', unit: '×', min: 0.4, max: 2, step: 0.05 },
    { path: 'scenes.growth.cloudDriftSpeed', label: 'Скорость облаков', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.cloudOpacity', label: 'Непрозрачность облаков', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.cloudLightIntensity', label: 'Освещение облаков', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.cloudSizeVariation', label: 'Разнообразие размеров облаков', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.cloudLightVariation', label: 'Разнообразие подсветки облаков', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.cloudPathDensity', label: 'Облака вдоль траектории', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.cloudShapeVariation', label: 'Разнообразие формы облаков', unit: '×', min: 0, max: 1, step: 0.01 },
    { path: 'scenes.growth.cloudDepthVariation', label: 'Разброс облаков по глубине', unit: '×', min: 0, max: 1, step: 0.01 },
  ] },
  { name: 'Лунное освещение', color: { path: 'scenes.growth.moonLightColor', label: 'Цвет лунного света' }, controls: [
    { path: 'scenes.growth.moonLightIntensity', label: 'Интенсивность лунного света', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.growth.moonBeamRadius', label: 'Диаметр луча', unit: '× радиуса острова', min: 0.4, max: 4, step: 0.05 },
    { path: 'scenes.growth.moonBeamSoftness', label: 'Мягкость краёв луча', unit: '×', min: 0.05, max: 1, step: 0.01 },
    { path: 'scenes.growth.moonBeamIntensity', label: 'Интенсивность объёмного луча', unit: '×', min: 0, max: 1.5, step: 0.025 },
    { path: 'scenes.growth.moonScatteringIntensity', label: 'Интенсивность рассеянного света', unit: '×', min: 0, max: 1.5, step: 0.025 },
    { path: 'scenes.growth.moonPositionY', label: 'Положение источника · Y', unit: 'м', min: 1, max: 10, step: 0.05 },
  ] },
  { name: 'Анимация лилии', controls: [
    { path: 'scenes.growth.flowerGrowthDuration', label: 'Длительность Growth', unit: 'с', min: 4, max: 14, step: 0.25 },
    { path: 'scenes.bloom.flowerBloomDuration', label: 'Длительность Bloom', unit: 'с', min: 6, max: 24, step: 0.25 },
  ] },
]

const LILY_GROWTH_PARTICLE_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.growth.vfxParticleCount', label: 'Particle Count / Density', unit: 'pcs', min: 0, max: 528, step: 8 },
  { path: 'scenes.growth.vfxParticleSize', label: 'Particle Size', unit: 'px', min: 0.75, max: 8, step: 0.1 },
  { path: 'scenes.growth.vfxParticleSizeVariation', label: 'Size Variation', unit: 'x', min: 0, max: 1.5, step: 0.05 },
  { path: 'scenes.growth.vfxParticleBrightness', label: 'Brightness / Intensity', unit: 'x', min: 0, max: 2.5, step: 0.05 },
  { path: 'scenes.growth.vfxParticleGlow', label: 'Glow Strength', unit: 'x', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.growth.vfxParticleSpeed', label: 'Particle Speed', unit: 'x', min: 0.2, max: 2, step: 0.05 },
  { path: 'scenes.growth.vfxParticleLifetime', label: 'Lifetime', unit: 'x', min: 0.3, max: 3, step: 0.05 },
  { path: 'scenes.growth.vfxParticleSpread', label: 'Spread / Radius', unit: 'x', min: 0, max: 1.5, step: 0.05 },
]

const LILY_GROWTH_PULSE_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.growth.vfxCoreIntensity', label: 'Core Intensity', unit: 'x', min: 0, max: 1.5, step: 0.05 },
  { path: 'scenes.growth.vfxPulseBrightness', label: 'Pulse Intensity', unit: 'x', min: 0, max: 2.5, step: 0.05 },
  { path: 'scenes.growth.vfxPulseWidth', label: 'Pulse Width', unit: '', min: 0.025, max: 0.3, step: 0.005 },
  { path: 'scenes.growth.vfxPulseSpeed', label: 'Pulse Speed', unit: 'x', min: 0.4, max: 2, step: 0.05 },
  { path: 'scenes.growth.vfxPulseTrailFade', label: 'Trail Length / Fade', unit: 'x', min: 0.35, max: 3, step: 0.05 },
  { path: 'scenes.growth.vfxPulseLeafBoost', label: 'Leaf Boost', unit: 'x', min: 0, max: 1.5, step: 0.05 },
  { path: 'scenes.growth.vfxPulseBudBoost', label: 'Bud Boost', unit: 'x', min: 0, max: 1.5, step: 0.05 },
]

const BLOOM_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.bloom.flowerBloomDuration', label: 'Длительность раскрытия Bloom', unit: 'с', min: 6, max: 24, step: 0.25 },
  { path: 'scenes.bloom.cameraFinalDistance', label: 'Финальная дистанция камеры', unit: '', min: 1.5, max: 5, step: 0.05 },
  { path: 'scenes.bloom.cameraFinalHeight', label: 'Высота камеры', unit: '', min: 0.5, max: 4, step: 0.05 },
  { path: 'scenes.bloom.cameraTargetX', label: 'Цель камеры · X', unit: '', min: -1, max: 1, step: 0.02 },
  { path: 'scenes.bloom.cameraTargetY', label: 'Цель камеры · Y', unit: '', min: -0.5, max: 3, step: 0.02 },
  { path: 'scenes.bloom.cameraApproachDuration', label: 'Длительность приближения камеры', unit: 'с', min: 1, max: 22, step: 0.1 },
  { path: 'scenes.bloom.cameraBloomSync', label: 'Раскрытие к финалу приближения', unit: '%', min: 50, max: 85, step: 1, displayScale: 100 },
]

const DISSOLVE_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.identity.dissolveDuration', label: 'Длительность растворения', unit: 'с', min: 2, max: 18, step: 0.1 },
  { path: 'scenes.identity.particleCount', label: 'Плотность частиц', unit: 'шт.', min: 1000, max: 100000, step: 1000 },
  { path: 'scenes.identity.particleSize', label: 'Размер частиц', unit: 'px', min: 0.5, max: 6, step: 0.1 },
  { path: 'scenes.identity.particleBrightness', label: 'Яркость частиц', unit: '×', min: 0.25, max: 2, step: 0.05 },
  { path: 'scenes.identity.edgeWidth', label: 'Ширина светящейся границы', unit: '', min: 0.005, max: 0.1, step: 0.005 },
  { path: 'scenes.identity.vortexRadius', label: 'Радиус вихря', unit: '× радиуса цветка', min: 0.5, max: 3, step: 0.05 },
  { path: 'scenes.identity.vortexExpansion', label: 'Расширение вверх', unit: '× / м', min: 0, max: 1.5, step: 0.05 },
  { path: 'scenes.identity.swirlSpeed', label: 'Начальная скорость вращения', unit: 'рад/с', min: 0, max: 8, step: 0.05 },
  { path: 'scenes.identity.swirlAcceleration', label: 'Ускорение вращения', unit: 'рад/с²', min: 0, max: 3, step: 0.01 },
  { path: 'scenes.identity.centerDissolveAt', label: 'Распад центра при растворении лепестков', unit: '%', min: 10, max: 90, step: 1, displayScale: 100 },
]

const PORTRAIT_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.identity.portraitStartProgress', label: 'Начало захвата портрета', unit: '%', min: 0, max: 100, step: 1, displayScale: 100 },
  { path: 'scenes.identity.portraitDuration', label: 'Длительность сборки', unit: 'с', min: 2, max: 16, step: 0.1 },
  { path: 'scenes.identity.portraitFraction', label: 'Доля частиц вихря для портрета', unit: '%', min: 0, max: 45, step: 1, displayScale: 100 },
  { path: 'scenes.identity.portraitMinTurns', label: 'Минимум витков до фиксации', unit: 'витка', min: 0, max: 4, step: 0.1 },
  { path: 'scenes.identity.portraitMaxTurns', label: 'Максимум витков до фиксации', unit: 'витка', min: 0, max: 4, step: 0.1 },
  { path: 'scenes.identity.portraitSteering', label: 'Сила отклонения к портрету', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.identity.portraitBraking', label: 'Торможение при фиксации', unit: '×', min: 0.25, max: 2, step: 0.05 },
  { path: 'scenes.identity.portraitSettledBrightness', label: 'Яркость закреплённой частицы', unit: '×', min: 1, max: 2, step: 0.05 },
  { path: 'scenes.identity.vortexSpeedMultiplier', label: 'Скорость вихря', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.identity.portraitDetail', label: 'Детализация портрета', unit: '×', min: 0.5, max: 2, step: 0.05 },
  { path: 'scenes.identity.portraitBrightness', label: 'Яркость портрета', unit: '×', min: 1.1, max: 2, step: 0.05 },
  { path: 'scenes.identity.portraitSize', label: 'Размер точек портрета', unit: '×', min: 0.6, max: 1.8, step: 0.05 },
  { path: 'scenes.identity.portraitScale', label: 'Масштаб портрета', unit: '×', min: 0.55, max: 1.25, step: 0.05 },
  { path: 'scenes.identity.portraitOffsetX', label: 'Положение портрета · X', unit: '× свободного поля', min: -1, max: 1, step: 0.05 },
  { path: 'scenes.identity.portraitOffsetY', label: 'Положение портрета · Y', unit: '× свободного поля', min: -1, max: 1, step: 0.05 },
]

const IDENTITY_CAMERA_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.bloom.cameraFinalHeight', label: 'Высота камеры / наклон взгляда', unit: '', min: 0.5, max: 4, step: 0.05 },
  { path: 'scenes.bloom.cameraFinalDistance', label: 'Дистанция камеры', unit: '', min: 1.5, max: 5, step: 0.05 },
  { path: 'scenes.bloom.cameraTargetX', label: 'Точка фокуса · X', unit: '', min: -1, max: 1, step: 0.02 },
  { path: 'scenes.bloom.cameraTargetY', label: 'Точка фокуса · высота', unit: '', min: -0.5, max: 3, step: 0.02 },
  { path: 'scenes.identity.cameraPullback', label: 'Отъезд назад', unit: '', min: 0, max: 5, step: 0.05 },
  { path: 'scenes.identity.cameraRise', label: 'Подъём камеры', unit: '', min: 0, max: 3, step: 0.05 },
  { path: 'scenes.identity.cameraMoveDuration', label: 'Длительность движения камеры', unit: 'с', min: 1, max: 18, step: 0.1 },
]

const GALLERY_LAYOUT_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.gallery.galleryWidth', label: 'Ширина прохода', unit: 'м', min: 6, max: 12, step: 0.1 },
  { path: 'scenes.gallery.columnScale', label: 'Масштаб колонн', unit: '×', min: 0.75, max: 3, step: 0.05 },
  { path: 'scenes.gallery.columnDepth', label: 'Отступ колонны за фотографией', unit: 'м', min: 0.02, max: 2, step: 0.01 },
  { path: 'scenes.gallery.columnOffsetX', label: 'Горизонтальное смещение колонны', unit: 'м', min: -2, max: 2, step: 0.05 },
  { path: 'scenes.gallery.columnOffsetY', label: 'Вертикальное смещение колонны от пола', unit: 'м', min: -2, max: 2, step: 0.05 },
]

function galleryPhotoLayoutControls(variant: 'A' | 'B'): readonly NumericControl[] {
  const prefix = `scenes.gallery.galleryLayout${variant}` as const
  return [
    { path: `${prefix}.laneWidth` as ComposerFieldPath, label: 'Ширина стороны с картинами', unit: 'м', min: 6, max: 12, step: 0.1 },
    { path: `${prefix}.offsetX` as ComposerFieldPath, label: variant === 'B' ? 'Смещение обеих сторон от центра · X' : 'Смещение картин · X', unit: 'м', min: variant === 'B' ? -2.5 : -3, max: 3, step: 0.05 },
    { path: `${prefix}.offsetY` as ComposerFieldPath, label: 'Смещение картин · Y', unit: 'м', min: -2, max: 2, step: 0.05 },
    { path: `${prefix}.offsetZ` as ComposerFieldPath, label: 'Смещение картин · Z', unit: 'м', min: -5, max: 5, step: 0.05 },
  ]
}

const GALLERY_ARCH_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.gallery.archScale', label: 'Масштаб арки', unit: '×', min: 8, max: 28, step: 0.25 },
  { path: 'scenes.gallery.archOpacity', label: 'Прозрачность арки', unit: '×', min: 0.1, max: 1, step: 0.01 },
  { path: 'scenes.gallery.archPositionX', label: 'Положение арки · X', unit: 'м', min: -30, max: 30, step: 0.25 },
  { path: 'scenes.gallery.archPositionY', label: 'Высота арки от пола', unit: 'м', min: -12, max: 24, step: 0.25 },
  { path: 'scenes.gallery.archPositionZ', label: 'Положение арки · Z', unit: 'м', min: -140, max: -65, step: 0.5 },
  { path: 'scenes.gallery.archRotationY', label: 'Поворот арки', unit: 'рад', min: -Math.PI, max: Math.PI, step: 0.05 },
]

const GALLERY_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.gallery.frameIntensity', label: 'Интенсивность рамок', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.gallery.particleCount', label: 'Количество частиц', unit: 'шт.', min: 0, max: 600, step: 1 },
  { path: 'scenes.gallery.moonBrightness', label: 'Яркость лунной сферы', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.gallery.moonSize', label: 'Размер луны', unit: '×', min: 0.4, max: 1.8, step: 0.05 },
  { path: 'scenes.gallery.waterBaseBrightness', label: 'Базовая яркость воды', unit: '×', min: 0, max: 1.5, step: 0.01 },
  { path: 'scenes.gallery.reflectionStrength', label: 'Сила отражений', unit: '×', min: 0, max: 0.9, step: 0.01 },
  { path: 'scenes.gallery.reflectionBlur', label: 'Размытие отражений', unit: '×', min: 0.3, max: 1.5, step: 0.01 },
  { path: 'scenes.gallery.reflectionFalloff', label: 'Затухание отражений', unit: '×', min: 0.25, max: 2.5, step: 0.01 },
  { path: 'scenes.gallery.waterDistortion', label: 'Искажение воды', unit: '×', min: 0, max: 0.14, step: 0.001 },
  { path: 'scenes.gallery.waterDistortionScale', label: 'Масштаб микронормалей', unit: '×', min: 0.25, max: 4.5, step: 0.01 },
  { path: 'scenes.gallery.waterRippleSpeed', label: 'Скорость ряби', unit: '×', min: 0, max: 3, step: 0.01 },
  { path: 'scenes.gallery.waterNormalStrength', label: 'Сила нормалей воды', unit: '×', min: 0, max: 3, step: 0.01 },
  { path: 'scenes.gallery.moonHighlightStrength', label: 'Сила лунного блика', unit: '×', min: 0, max: 2, step: 0.01 },
  { path: 'scenes.gallery.moonReflectionSpread', label: 'Ширина лунной дорожки', unit: '×', min: 0.25, max: 4, step: 0.01 },
  { path: 'scenes.gallery.waterOpacity', label: 'Непрозрачность воды', unit: '×', min: 0, max: 1, step: 0.01 },
  { path: 'scenes.gallery.threadOpacity', label: 'Прозрачность световых нитей', unit: '×', min: 0, max: 0.8, step: 0.01 },
  { path: 'scenes.gallery.coldLightIntensity', label: 'Интенсивность холодного света', unit: '×', min: 0, max: 1.8, step: 0.05 },
  { path: 'scenes.gallery.moonLightIntensity', label: 'Общий лунный свет', unit: '×', min: 0, max: 3, step: 0.05 },
  { path: 'scenes.gallery.moonFillIntensity', label: 'Заполняющий лунный свет', unit: '×', min: 0, max: 1.2, step: 0.025 },
  { path: 'scenes.gallery.moonHaloIntensity', label: 'Интенсивность ореола Луны', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.gallery.moonHaloRadius', label: 'Радиус ореола Луны', unit: '×', min: 0, max: 2.5, step: 0.05 },
  { path: 'scenes.gallery.moonGodRaysIntensity', label: 'Интенсивность god rays', unit: '×', min: 0, max: 0.8, step: 0.01 },
  { path: 'scenes.gallery.moonPositionX', label: 'Положение Луны X', unit: 'м', min: -12, max: 12, step: 0.1 },
  { path: 'scenes.gallery.moonPositionY', label: 'Положение Луны Y', unit: 'м', min: 4, max: 24, step: 0.1 },
  { path: 'scenes.gallery.moonPositionZ', label: 'Положение Луны Z', unit: 'м', min: -180, max: -80, step: 1 },
  { path: 'scenes.gallery.moonTargetX', label: 'Цель света X', unit: 'м', min: -40, max: 40, step: 0.5 },
  { path: 'scenes.gallery.moonTargetY', label: 'Цель света Y', unit: 'м', min: -12, max: 14, step: 0.05 },
  { path: 'scenes.gallery.moonTargetZ', label: 'Цель света Z', unit: 'м', min: -180, max: 40, step: 1 },
]

const GALLERY_CLOUD_GROUPS: readonly { name: string; controls: readonly NumericControl[] }[] = [
  ...([
    { id: 'far', name: 'Far Clouds · дальний слой', maxCount: 12 },
    { id: 'mid', name: 'Mid Clouds · боковые массы', maxCount: 20 },
    { id: 'nearLow', name: 'Near Low Clouds · за фотографиями', maxCount: 24 },
    { id: 'waterline', name: 'Waterline Clouds · дымка над водой', maxCount: 32 },
    { id: 'moon', name: 'Moon Clouds · облака у Луны', maxCount: 8 },
  ] as const).map(({ id, name, maxCount }) => ({
    name,
    controls: [
      { path: `scenes.gallery.cloudLayers.${id}.count`, label: 'Количество масс', unit: 'шт.', min: 0, max: maxCount, step: 1 },
      { path: `scenes.gallery.cloudLayers.${id}.density`, label: 'Плотность', unit: '×', min: 0, max: 1.8, step: 0.05 },
      { path: `scenes.gallery.cloudLayers.${id}.scale`, label: 'Масштаб', unit: '×', min: 0.55, max: 2, step: 0.05 },
      { path: `scenes.gallery.cloudLayers.${id}.opacity`, label: 'Непрозрачность', unit: '×', min: 0, max: 1.8, step: 0.05 },
      { path: `scenes.gallery.cloudLayers.${id}.brightness`, label: 'Яркость', unit: '×', min: 0, max: 2, step: 0.05 },
      { path: `scenes.gallery.cloudLayers.${id}.driftSpeed`, label: 'Скорость дрейфа', unit: '×', min: 0, max: 3, step: 0.05 },
      { path: `scenes.gallery.cloudLayers.${id}.height`, label: 'Высота', unit: 'м', min: -8, max: 12, step: 0.1 },
      { path: `scenes.gallery.cloudLayers.${id}.distance`, label: 'Отступ от галереи', unit: 'м', min: 0, max: 24, step: 0.25 },
      { path: `scenes.gallery.cloudLayers.${id}.softness`, label: 'Мягкость края', unit: '×', min: 0, max: 1, step: 0.025 },
    ].map(control => ({ ...control, path: control.path as ComposerFieldPath })),
  })),
  { name: 'Дрейф и дымка', controls: [
    { path: 'scenes.gallery.cloudDriftVariation', label: 'Разница дрейфа по глубине', unit: '×', min: 0, max: 1, step: 0.05 },
    { path: 'scenes.gallery.hazeDensity', label: 'Плотность дымки', unit: '×', min: 0, max: 1.8, step: 0.05 },
    { path: 'scenes.gallery.hazeHeight', label: 'Высота дымки', unit: 'м.', min: -3, max: 3, step: 0.1 },
    { path: 'scenes.gallery.hazeMotionSpeed', label: 'Скорость движения дымки', unit: '×', min: 0, max: 3, step: 0.025 },
  ] },
  { name: 'Лунный свет и цвет', controls: [
    { path: 'scenes.gallery.moonCloudLightIntensity', label: 'Лунный свет на облаках', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.gallery.moonScatteringIntensity', label: 'Интенсивность лунной дымки', unit: '×', min: 0, max: 1.5, step: 0.025 },
    { path: 'scenes.gallery.cloudCoolTint', label: 'Холодный синий оттенок', unit: '×', min: 0, max: 1.5, step: 0.025 },
    { path: 'scenes.gallery.cloudWhiteHighlight', label: 'Белые лунные акценты', unit: '×', min: 0, max: 1.5, step: 0.025 },
  ] },
]

const GALAXY_GROUPS: readonly { name: string; controls: readonly NumericControl[] }[] = [
  { name: 'Galaxy Geometry · перестройка после паузы ползунка', controls: [
    { path: 'scenes.galaxy.starCount', label: 'Количество звёзд', unit: 'шт.', min: 8000, max: 90000, step: 1000 },
    { path: 'scenes.galaxy.arms', label: 'Спиральные рукава', unit: '', min: 2, max: 8, step: 1 },
    { path: 'scenes.galaxy.radius', label: 'Радиус', unit: '', min: 4, max: 14, step: 0.1 },
    { path: 'scenes.galaxy.spin', label: 'Закручивание рукавов', unit: 'рад', min: 0.2, max: 18, step: 0.05 },
    { path: 'scenes.galaxy.armWidth', label: 'Ширина рукавов', unit: '× R', min: 0, max: 0.5, step: 0.005 },
    { path: 'scenes.galaxy.randomness', label: 'Разброс звёзд', unit: '× R', min: 0, max: 0.3, step: 0.005 },
    { path: 'scenes.galaxy.randomnessPower', label: 'Сжатие разброса', unit: '×', min: 0.1, max: 8, step: 0.1 },
    { path: 'scenes.galaxy.coreSize', label: 'Размер ядра', unit: '× R', min: 0.08, max: 0.5, step: 0.005 },
    { path: 'scenes.galaxy.coreDensity', label: 'Плотность ядра', unit: '×', min: 0, max: 0.5, step: 0.01 },
    { path: 'scenes.galaxy.thickness', label: 'Толщина диска', unit: '× R', min: 0.005, max: 0.2, step: 0.005 },
  ] },
  { name: 'Stars · live', controls: [
    { path: 'scenes.galaxy.starSize', label: 'Размер обычных звёзд', unit: '×', min: 0.25, max: 3.5, step: 0.05 },
    { path: 'scenes.galaxy.brightness', label: 'Яркость звёзд', unit: '×', min: 0.1, max: 1.5, step: 0.02 },
    { path: 'scenes.galaxy.twinkle', label: 'Интенсивность мерцания', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.twinkleSpeed', label: 'Скорость мерцания', unit: '×', min: 0, max: 3, step: 0.05 },
    { path: 'scenes.galaxy.brightStarCount', label: 'Особенно яркие звёзды', unit: 'шт.', min: 0, max: 200, step: 1 },
    { path: 'scenes.galaxy.brightStarSize', label: 'Размер ярких звёзд', unit: 'px', min: 1, max: 8, step: 0.1 },
    { path: 'scenes.galaxy.brightStarIntensity', label: 'Интенсивность ярких звёзд', unit: '×', min: 0, max: 3, step: 0.05 },
    { path: 'scenes.galaxy.backgroundStarCount', label: 'Звёзды фона · перестройка', unit: 'шт.', min: 0, max: 10000, step: 200 },
    { path: 'scenes.galaxy.backgroundBrightness', label: 'Яркость фона', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.backgroundSize', label: 'Размер звёзд фона', unit: 'px', min: 0.2, max: 2.5, step: 0.05 },
    { path: 'scenes.galaxy.backgroundDepth', label: 'Глубина фона · перестройка', unit: '', min: 15, max: 100, step: 1 },
    { path: 'scenes.galaxy.backgroundGasDensity', label: 'Плотность фонового газа', unit: '×', min: 0, max: 0.8, step: 0.02 },
    { path: 'scenes.galaxy.backgroundGasBrightness', label: 'Яркость фонового газа', unit: '×', min: 0, max: 1, step: 0.02 },
  ] },
  { name: 'Nebula · live', controls: [
    { path: 'scenes.galaxy.nebulaDensity', label: 'Плотность газа', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.nebulaBrightness', label: 'Яркость газа', unit: '×', min: 0, max: 1.5, step: 0.02 },
    { path: 'scenes.galaxy.nebulaSaturation', label: 'Насыщенность газа', unit: '×', min: 0, max: 1.5, step: 0.02 },
    { path: 'scenes.galaxy.nebulaOpacity', label: 'Непрозрачность газа', unit: '%', min: 0, max: 100, step: 1, displayScale: 100 },
    { path: 'scenes.galaxy.nebulaScale', label: 'Масштаб шума', unit: '×', min: 0.3, max: 4, step: 0.05 },
    { path: 'scenes.galaxy.nebulaIntensity', label: 'Интенсивность газовых рукавов', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.galaxy.nebulaSpeed', label: 'Скорость газа', unit: '×', min: 0, max: 0.1, step: 0.002 },
  ] },
  { name: 'Reveal Fog · live', controls: [
    { path: 'scenes.galaxy.fogDensity', label: 'Плотность переднего тумана', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.fogLayers', label: 'Слои тумана', unit: '', min: 1, max: 8, step: 1 },
    { path: 'scenes.galaxy.fogDepth', label: 'Глубина слоёв', unit: '', min: 4, max: 30, step: 0.5 },
    { path: 'scenes.galaxy.fogDissipation', label: 'Скорость рассеивания', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.fogStart', label: 'Начало рассеивания', unit: 'с', min: 0, max: 8, step: 0.1 },
    { path: 'scenes.galaxy.fogEnd', label: 'Конец рассеивания', unit: 'с', min: 4, max: 18, step: 0.1 },
    { path: 'scenes.galaxy.fogTurbulence', label: 'Турбулентность', unit: '×', min: 0, max: 1, step: 0.02 },
    { path: 'scenes.galaxy.fogAfterOpacity', label: 'Остаточная дымка', unit: '%', min: 0, max: 20, step: 0.5, displayScale: 100 },
  ] },
  { name: 'Motion · live', controls: [
    { path: 'scenes.galaxy.rotationSpeed', label: 'Скорость вращения', unit: '×', min: 0, max: 0.1, step: 0.0005 },
    { path: 'scenes.galaxy.motionSpeed', label: 'Общая скорость движения', unit: '×', min: 0, max: 2, step: 0.05 },
    { path: 'scenes.galaxy.revealMotion', label: 'Движение при раскрытии', unit: '×', min: 0, max: 3, step: 0.05 },
    { path: 'scenes.galaxy.idleMotion', label: 'Спокойное движение', unit: '×', min: 0, max: 0.6, step: 0.01 },
    { path: 'scenes.galaxy.firstStarsAt', label: 'Появление первых звёзд', unit: 'с', min: 0, max: 6, step: 0.1 },
    { path: 'scenes.galaxy.galaxyRevealAt', label: 'Начало раскрытия галактики', unit: 'с', min: 0, max: 10, step: 0.1 },
    { path: 'scenes.galaxy.revealDuration', label: 'Длительность раскрытия', unit: 'с', min: 5, max: 18, step: 0.1 },
    { path: 'scenes.galaxy.pauseDuration', label: 'Пауза до затемнения', unit: 'с', min: 0, max: 12, step: 0.1 },
    { path: 'scenes.galaxy.backgroundTransition', label: 'Переход в фон', unit: 'с', min: 2, max: 18, step: 0.1 },
  ] },
  { name: 'Camera · CameraDirector', controls: [
    { path: 'scenes.galaxy.cameraStartDistance', label: 'Начальная дистанция', unit: '', min: 3, max: 12, step: 0.1 },
    { path: 'scenes.galaxy.cameraEndDistance', label: 'Финальная дистанция', unit: '', min: 9, max: 28, step: 0.1 },
    { path: 'scenes.galaxy.cameraStartAngle', label: 'Начальный угол', unit: 'rad', min: -0.3, max: 0.8, step: 0.01 },
    { path: 'scenes.galaxy.cameraEndAngle', label: 'Финальный угол', unit: 'rad', min: 0.1, max: 0.95, step: 0.01 },
    { path: 'scenes.galaxy.cameraFocusX', label: 'Смещение фокуса X', unit: '', min: -3, max: 3, step: 0.05 },
    { path: 'scenes.galaxy.cameraFocusY', label: 'Смещение фокуса Y', unit: '', min: -3, max: 3, step: 0.05 },
    { path: 'scenes.galaxy.cameraDuration', label: 'Длительность отдаления', unit: 'с', min: 5, max: 18, step: 0.1 },
    { path: 'scenes.galaxy.cameraSlowdown', label: 'Время замедления', unit: 'с', min: 0, max: 8, step: 0.1 },
    { path: 'scenes.galaxy.compositionScale', label: 'Масштаб композиции', unit: '×', min: 0.65, max: 1.4, step: 0.01 },
  ] },
]

const GALAXY_SELECTS: readonly SelectControl[] = [
  { path: 'scenes.galaxy.quality', label: 'Качество галактики', options: [{ value: 'low', label: 'Low' }, { value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }] },
  { path: 'scenes.galaxy.distribution', label: 'Форма распределения', options: [{ value: 'balanced', label: 'Сбалансированное' }, { value: 'core', label: 'Плотное ядро' }, { value: 'arms', label: 'Выраженные рукава' }] },
  { path: 'scenes.galaxy.palette', label: 'Палитра', options: [
    { value: 'vasilisa', label: 'Vasilisa Cinematic' }, { value: 'spore', label: 'Spore (R/B/Y/V)' },
    { value: 'ember', label: 'Ember' }, { value: 'emerald', label: 'Emerald' },
    { value: 'ice', label: 'Ice' }, { value: 'rose', label: 'Rose' }, { value: 'custom', label: 'Custom' },
  ] },
  { path: 'scenes.galaxy.cameraEase', label: 'Easing камеры', options: [{ value: 'sine', label: 'Sine' }, { value: 'power2', label: 'Power 2' }, { value: 'power3', label: 'Power 3' }] },
]

function useApproximateRafFps() {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    let request = 0
    let started = 0
    let frames = 0
    const sample = (now: number) => {
      if (!started) started = now
      frames += 1
      if (now - started >= 750) {
        setFps(Math.round((frames - 1) * 1000 / (now - started)))
        started = now
        frames = 0
      }
      request = requestAnimationFrame(sample)
    }
    request = requestAnimationFrame(sample)
    return () => cancelAnimationFrame(request)
  }, [])
  return fps
}

function valueAtPath(config: SceneComposerConfig, path: ComposerFieldPath): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], config)
}

function defaultAtPath(path: ComposerFieldPath): unknown {
  return valueAtPath(DEFAULT_SCENE_COMPOSER_CONFIG, path)
}

function formatted(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
}

function RangeControl({ control, value, onChange, onReset, changed }: {
  control: NumericControl
  value: number
  onChange(value: number): void
  onReset(): void
  changed: boolean
}) {
  const id = `composer-${control.path.replaceAll('.', '-')}`
  return (
    <div className="composer-control">
      <div className="inspector-control-heading"><label htmlFor={id}>{control.label} · {formatted(value)} {control.unit}</label>{changed && <button type="button" className="inspector-reset" aria-label={`Reset ${control.label}`} title="Reset" onClick={onReset}>↺</button>}</div>
      <input id={id} data-testid={id} type="range" min={control.min} max={control.max} step={control.step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function ConfigRange({ control, config, onChange, onReset }: {
  control: NumericControl
  config: SceneComposerConfig
  onChange(path: ComposerFieldPath, value: number): void
  onReset(path: ComposerFieldPath): void
}) {
  const value = valueAtPath(config, control.path)
  const scale = control.displayScale ?? 1
  const displayValue = typeof value === 'number' ? Math.min(control.max, Math.max(control.min, value * scale)) : control.min
  return <RangeControl control={control} value={displayValue} onChange={(next) => onChange(control.path, next / scale)} onReset={() => onReset(control.path)} changed={value !== defaultAtPath(control.path)} />
}

function FontControl({ path, label, value, onChange, onReset }: {
  path: ComposerFieldPath
  label: string
  value: ArtFontId
  onChange(path: ComposerFieldPath, value: ArtFontId): void
  onReset(path: ComposerFieldPath): void
}) {
  const id = `composer-${path.replaceAll('.', '-')}`
  return (
    <div className="composer-control">
      <div className="inspector-control-heading"><label htmlFor={id}>{label}</label>{value !== defaultAtPath(path) && <button type="button" className="inspector-reset" aria-label={`Сбросить ${label}`} title="Сбросить" onClick={() => onReset(path)}>↺</button>}</div>
      <select id={id} data-testid={id} value={value} onChange={(event) => onChange(path, event.target.value as ArtFontId)}>
        {ART_FONT_CATALOG.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
      </select>
    </div>
  )
}

function SelectConfigControl({ control, value, onChange, onReset }: {
  control: SelectControl
  value: string
  onChange(path: ComposerFieldPath, value: string): void
  onReset(path: ComposerFieldPath): void
}) {
  const id = `composer-${control.path.replaceAll('.', '-')}`
  return <div className="composer-control">
    <div className="inspector-control-heading"><label htmlFor={id}>{control.label}</label>{value !== defaultAtPath(control.path) && <button type="button" className="inspector-reset" aria-label={`Сбросить ${control.label}`} onClick={() => onReset(control.path)}>↺</button>}</div>
    <select id={id} data-testid={id} value={value} onChange={(event) => onChange(control.path, event.target.value)}>{control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </div>
}

export default function DeveloperPanel({ state, dispatch, runtime, reducedMotion, onPreload, route = 'film' }: {
  state: FilmState
  dispatch: Dispatch<FilmAction>
  runtime?: FilmRuntime
  reducedMotion: boolean
  onPreload(): void
  route?: string
}) {
  const active: InspectorScene = route === 'loading' ? 'preload' : state.scene
  const [pinned, setPinned] = useState<InspectorScene | null>(null)
  const selected = pinned ?? active
  const [selectedPreset, setSelectedPreset] = useState<ScenePresetId>(() => getConfig().preset)
  const [notice, setNotice] = useState('')
  const [fontLoading, setFontLoading] = useState(false)
  const fontRequest = useRef(0)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const fps = useApproximateRafFps()
  const [history] = useState(createInspectorHistory)
  const [historyRevision, setHistoryRevision] = useState(0)
  const compareBusy = useRef(false)
  const [comparing, setComparing] = useState(false)
  const [snapshots, setSnapshots] = useState<Partial<Record<InspectorScope, { A?: object; B?: object; active?: 'A' | 'B'; point?: ComparisonPoint }>>>({})
  const section = (value: SceneComposerConfig, scope: InspectorScope): object => scope === 'global' ? value.global : value.scenes[scope]
  const recordChange = (scope: InspectorScope, before: SceneComposerConfig, after: SceneComposerConfig) => {
    history.record(scope, section(before, scope), section(after, scope))
    setHistoryRevision(value => value + 1)
  }
  const recordFieldChange = (scope: InspectorScope, path: ComposerFieldPath, before: SceneComposerConfig, after: SceneComposerConfig) => {
    const key = path.split('.').at(-1)!
    const keys = key === 'dprMin' || key === 'dprMax' ? ['dprMin', 'dprMax'] : [key]
    const pick = (config: SceneComposerConfig) => {
      const values = section(config, scope) as Record<string, unknown>
      return Object.fromEntries(keys.map(name => [name, values[name]]))
    }
    history.record(scope, pick(before), pick(after))
    setHistoryRevision(value => value + 1)
  }
  const patchSection = (scope: InspectorScope, value: object) => updateConfig((scope === 'global' ? { global: value } : { scenes: { [scope]: value } }) as SceneComposerConfigPatch)
  const matchesPatch = (result: object, patch: object) => Object.entries(patch).every(([key, value]) => Object.is((result as Record<string, unknown>)[key], value))

  const travelHistory = async (scope: InspectorScope, direction: 'undo' | 'redo') => {
    const transaction = history[direction === 'undo' ? 'undoTransaction' : 'redoTransaction'](scope)
    if (!transaction) return
    const { patch, relatedPatch } = transaction
    try {
      const configPatch = scope === 'global' ? { global: patch } : { scenes: { [scope]: patch, ...(relatedPatch ? { openingBackground: relatedPatch } : {}) } }
      const next = await updateConfig(configPatch as SceneComposerConfigPatch)
      if (!matchesPatch(section(next, scope), patch) || (relatedPatch && !matchesPatch(next.scenes.openingBackground, relatedPatch))) throw new Error('Settings were not applied')
      if (scope === 'global') syncFilmGlobals(next)
      setNotice(direction === 'undo' ? 'Изменение отменено.' : 'Изменение возвращено.')
    } catch {
      history[direction === 'undo' ? 'redoTransaction' : 'undoTransaction'](scope)
      setNotice('Не удалось восстановить настройки; история сохранена.')
    }
    setHistoryRevision(value => value + 1)
  }

  const syncFilmGlobals = (next: SceneComposerConfig) => {
    dispatch({ type: 'set-speed', speed: next.global.playbackSpeed })
    dispatch({ type: 'set-quality', quality: next.global.quality })
  }

  const changeField = async (path: ComposerFieldPath, value: unknown) => {
    const scope = (path.startsWith('global.') ? 'global' : path.split('.')[1]) as InspectorScope
    const before = getConfig()
    const isFont = path === 'scenes.prologue.fontFamily'
    const requestId = isFont ? ++fontRequest.current : 0
    if (isFont) setFontLoading(true)
    setNotice('')
    try {
      const next = await setComposerField(path, value)
      recordFieldChange(scope, path, before, next)
      if (path === 'global.playbackSpeed') dispatch({ type: 'set-speed', speed: Number(value) })
      if (path === 'global.quality') dispatch({ type: 'set-quality', quality: value as QualityProfile })
      if (isFont) {
        if (next.scenes.prologue.fontFamily !== value) setNotice('Шрифт не загрузился; сохранён прежний.')
      }
    } catch {
      setNotice('Не удалось применить настройку. Текущее значение сохранено.')
    } finally {
      if (isFont && requestId === fontRequest.current) setFontLoading(false)
    }
  }

  const resetField = async (path: ComposerFieldPath) => changeField(path, defaultAtPath(path))

  const commitGalaxySettings = async (settings: SceneComposerConfig['scenes']['galaxy']) => {
    const before = getConfig()
    const next = await updateConfig({ scenes: { galaxy: settings } })
    recordChange('galaxy', before, next)
  }

  const changeGalaxyPalette = async (palette: GalaxyPalette) => {
    await commitGalaxySettings(selectGalaxyPalette(getConfig().scenes.galaxy, palette))
  }

  const resetScope = async (scope: 'global' | 'openingBackground' | 'preload' | 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery' | 'galaxy') => {
    const before = getConfig()
    const result = await resetComposerScope(scope)
    if (!result.ok) {
      setNotice('Шрифт не загрузился; сброс не применён. Текущие настройки сохранены.')
      return
    }
    const next = result.config
    recordChange(scope, before, next)
    if (scope === 'global') syncFilmGlobals(next)
    setNotice('Параметры сброшены.')
  }

  const applyPreset = async () => {
    const next = await applyComposerPreset(selectedPreset)
    history.clear()
    setHistoryRevision(value => value + 1)
    setSnapshots({})
    setSelectedPreset(next.preset)
    setNotice(`Применён пресет «${SCENE_CONFIG_PRESETS[next.preset].label}». История и A/B очищены.`)
  }

  const downloadConfig = () => {
    const url = URL.createObjectURL(new Blob([exportComposerJson()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'scene-composer.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const result = await importComposerJson(await file.text())
      if (!result.ok) {
        const errors = {
          json: 'Файл содержит некорректный JSON. Текущие настройки сохранены.',
          document: 'Разделы файла должны быть объектами. Текущие настройки сохранены.',
          version: 'Поддерживаются schemaVersion 1–21. Текущие настройки сохранены.',
          font: 'Шрифт не загрузился; настройки из JSON не применены. Текущие настройки сохранены.',
        }
        setNotice(errors[result.reason])
        return
      }
      syncFilmGlobals(result.config)
      history.clear()
      setHistoryRevision(value => value + 1)
      setSnapshots({})
      setSelectedPreset(result.config.preset)
      setNotice('Настройки из JSON применены. История и A/B очищены.')
    } catch {
      setNotice('Не удалось прочитать файл. Текущие настройки сохранены.')
    }
  }

  const rangeWithMax = (control: NumericControl, max: number) => <ConfigRange key={control.path} control={max === control.max ? control : { ...control, max }} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
  const range = (control: NumericControl) => rangeWithMax(control, control.max)
  const color = (path: ComposerFieldPath, label: string) => {
    const isGalaxyColor = path.startsWith('scenes.galaxy.')
    const galaxyColorKey = isGalaxyColor ? path.slice('scenes.galaxy.'.length) as GalaxyColorKey : undefined
    const value = galaxyColorKey ? getGalaxyColors(config.scenes.galaxy)[galaxyColorKey] : valueAtPath(config, path) as string
    const applyColor = async (next: string) => {
      if (galaxyColorKey) {
        await commitGalaxySettings(editGalaxyColor(getConfig().scenes.galaxy, galaxyColorKey, next))
        return
      }
      await changeField(path, next.toUpperCase())
    }
    return <div className="composer-control" key={path}>
      <div className="inspector-control-heading"><label htmlFor={`composer-${path.replaceAll('.', '-')}`}>{label}</label>{value !== defaultAtPath(path) && <button type="button" className="inspector-reset" aria-label={`Сбросить ${label.toLocaleLowerCase('ru-RU')}`} onClick={() => { void applyColor(defaultAtPath(path) as string) }}>↺</button>}</div>
      <input id={`composer-${path.replaceAll('.', '-')}`} type="color" value={value} onChange={(event) => { void applyColor(event.target.value) }} />
    </div>
  }
  const font = (scene: 'prologue', label: string) => <FontControl path={`scenes.${scene}.fontFamily`} label={label} value={config.scenes[scene].fontFamily} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
  const title = selected === 'preload' ? '00 · Загрузка' : SCENES[selected].label
  const hasSceneControls = selected === 'preload' || selected === 'prologue'
    || selected === 'growth' || selected === 'bloom' || selected === 'identity' || selected === 'gallery' || selected === 'cosmos'
  const hasOpeningBackgroundControls = selected === 'preload' || selected === 'prologue'
    || selected === 'growth' || selected === 'bloom' || selected === 'identity'
  const currentScope: InspectorScope | undefined = selected === 'cosmos' ? 'galaxy'
    : selected === 'preload' || selected === 'prologue' || selected === 'growth' || selected === 'bloom' || selected === 'identity' || selected === 'gallery'
      ? selected : undefined
  const currentSnapshots = currentScope ? snapshots[currentScope] : undefined
  const remember = (slot: 'A' | 'B') => {
    if (!currentScope) return
    const snapshot = section(getConfig(), currentScope)
    setSnapshots(previous => ({ ...previous, [currentScope]: { ...previous[currentScope], [slot]: snapshot, active: undefined } }))
    setNotice(`Снимок ${slot} сохранён для сцены.`)
  }
  const compare = async (slot: 'A' | 'B') => {
    if (!currentScope || selected !== active || compareBusy.current) return
    if (route !== 'film') { setNotice('Сравнение недоступно во время загрузки.'); return }
    const snapshot = snapshots[currentScope]?.[slot]
    if (!snapshot) return
    let point = snapshots[currentScope]?.point
    if (route === 'film') {
      if (!runtime || state.reading || (state.mode !== 'playing' && state.mode !== 'waiting')) { setNotice('Сравнение недоступно во время перехода или чтения.'); return }
      const time = state.mode === 'playing' ? runtime.time : state.elapsed
      point ??= { scene: state.scene, mode: state.mode, time, revision: state.revision }
      if (!comparisonPointValid(point, state, getSceneDuration(state.scene, config))) {
        setNotice('Эта точка больше недоступна. Выберите новую точку сравнения.')
        return
      }
    }
    compareBusy.current = true
    setComparing(true)
    const before = getConfig()
    try {
      if (point?.mode === 'playing') { dispatch({ type: 'dev-seek', time: point.time }); point = { ...point, revision: state.revision + 1 } }
      if (!state.paused) dispatch({ type: 'toggle-pause' })
      const next = await patchSection(currentScope, snapshot)
      if (!matchesPatch(section(next, currentScope), snapshot)) throw new Error('Settings were not applied')
      recordChange(currentScope, before, next)
      setSnapshots(previous => ({ ...previous, [currentScope]: { ...previous[currentScope], active: slot, point } }))
      setNotice(route === 'film' ? `Снимок ${slot} применён. Фильм остановлен в точке ${point!.time.toFixed(2)} с.` : `Снимок ${slot} применён.`)
    } catch { setNotice('Не удалось применить снимок; текущие параметры сохранены.') }
    finally { compareBusy.current = false; setComparing(false) }
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!(event.ctrlKey || event.metaKey) || event.altKey || target?.isContentEditable || target?.closest('[role="dialog"]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return
      const key = event.key.toLowerCase()
      const direction = key === 'y' || (key === 'z' && event.shiftKey) ? 'redo' : key === 'z' ? 'undo' : null
      if (!direction || !currentScope) return
      event.preventDefault()
      void travelHistory(currentScope, direction)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const historyButtons = (scope: InspectorScope) => <div className="inspector-history" data-history-revision={historyRevision}>
    <button type="button" disabled={!history.canUndo(scope)} onClick={() => { void travelHistory(scope, 'undo') }}>Отменить</button>
    <button type="button" disabled={!history.canRedo(scope)} onClick={() => { void travelHistory(scope, 'redo') }}>Повторить</button>
  </div>

  return (
    <aside id="developer-panel" className="developer-panel" aria-labelledby="developer-title">
      <div className="inspector-heading"><h2 id="developer-title">Scene Inspector</h2><button type="button" aria-pressed={pinned !== null} onClick={() => setPinned(pinned === null ? active : null)}>{pinned === null ? 'Auto' : 'Pin'}</button></div>
      <p className="inspector-follow">{pinned === null ? 'Следует за активной сценой' : 'Панель закреплена'} · {title}</p>
      {fontLoading && <p role="status">Загружаем локальный шрифт…</p>}
      {notice && <p role="status" aria-live="polite">{notice}</p>}
      <details className="inspector-section">
        <summary>Global · общие параметры</summary>
        {historyButtons('global')}
        <div className="inspector-control-heading"><label htmlFor="inspector-quality">Профиль качества</label>{config.global.quality !== defaultAtPath('global.quality') && <button type="button" className="inspector-reset" aria-label="Сбросить качество" onClick={() => { void resetField('global.quality') }}>↺</button>}</div>
        <select id="inspector-quality" value={config.global.quality} onChange={(event) => { void changeField('global.quality', event.target.value) }}><option value="standard">Обычное</option><option value="low">Низкое</option></select>
        {range({ path: 'global.playbackSpeed', label: 'Скорость фильма', unit: '×', min: 0.25, max: 4, step: 0.25 })}
        {range({ path: 'global.dprMin', label: 'Минимум DPR', unit: '×', min: 0.5, max: 1.5, step: 0.05 })}
        {range({ path: 'global.dprMax', label: 'Максимум DPR', unit: '×', min: 1, max: 2, step: 0.05 })}
        <details><summary>Пресеты и конфигурация</summary>
          <label htmlFor="composer-preset">Художественный пресет</label><select id="composer-preset" data-testid="composer-preset" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as ScenePresetId)}>{Object.entries(SCENE_CONFIG_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select>
          <button type="button" onClick={() => { void applyPreset() }}>Применить пресет</button>
          <div className="composer-files"><button type="button" onClick={downloadConfig}>Экспорт JSON</button><label>Импорт JSON<input data-testid="composer-import" type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event) }} /></label></div>
        </details>
        <button type="button" onClick={() => { void resetScope('global') }}>Сбросить Global</button>
      </details>
      <section aria-labelledby="inspector-scene-title" className="inspector-scene">
        <h3 id="inspector-scene-title">{title}</h3>
        {hasOpeningBackgroundControls && <details open><summary>00–04 · Кадрирование фона</summary>
          {historyButtons('openingBackground')}
          {OPENING_BACKGROUND_CONTROLS.map(range)}
          <button type="button" onClick={() => { void resetScope('openingBackground') }}>Сбросить кадрирование фона</button>
        </details>}
        {currentScope && <details className="inspector-compare"><summary>{currentScope === 'gallery' ? 'История параметров' : 'История и сравнение A/B'}</summary>
          {historyButtons(currentScope)}
          {currentScope !== 'gallery' && <>
            <p>Снимки временные и относятся к этой сцене. Сравнение останавливает фильм в текущем кадре.</p>
            <div className="inspector-history"><button type="button" onClick={() => remember('A')}>Сохранить A</button><button type="button" onClick={() => remember('B')}>Сохранить B</button></div>
            <div className="inspector-history"><button type="button" aria-pressed={currentSnapshots?.active === 'A' && !!currentSnapshots.A && matchesPatch(section(config, currentScope), currentSnapshots.A)} disabled={comparing || !currentSnapshots?.A || selected !== active || route !== 'film'} onClick={() => { void compare('A') }}>Показать A</button><button type="button" aria-pressed={currentSnapshots?.active === 'B' && !!currentSnapshots.B && matchesPatch(section(config, currentScope), currentSnapshots.B)} disabled={comparing || !currentSnapshots?.B || selected !== active || route !== 'film'} onClick={() => { void compare('B') }}>Показать B</button></div>
            {comparing && <p role="status">Применяем снимок…</p>}
            {route !== 'film' && <p>Сравнение недоступно во время загрузки.</p>}
            {route === 'film' && currentSnapshots?.point && <p>Точка: {currentSnapshots.point.time.toFixed(2)} с <button type="button" onClick={() => setSnapshots(previous => ({ ...previous, [currentScope]: { ...previous[currentScope], point: undefined, active: undefined } }))}>Новая точка</button></p>}
            {selected !== active && <p>Перейдите в эту сцену для сравнения.</p>}
          </>}
        </details>}
        {selected === 'preload' && <details open><summary>Свечение и движение</summary>{PRELOAD_CONTROLS.map(range)}</details>}
        {selected === 'prologue' && PROLOGUE_GROUPS.map(group => <details key={group.name} open={group.name === 'Typography'}>
          <summary>{group.name}</summary>
          {group.name === 'Typography' && <>
            {font('prologue', 'Шрифт рукописного текста')}
            <div className="composer-control"><div className="inspector-control-heading"><label htmlFor="composer-scenes-prologue-copyVariant">Вторая фраза</label>{config.scenes.prologue.copyVariant !== 'awakening' && <button type="button" className="inspector-reset" aria-label="Сбросить вторую фразу" onClick={() => { void resetField('scenes.prologue.copyVariant') }}>↺</button>}</div>
              <select id="composer-scenes-prologue-copyVariant" value={config.scenes.prologue.copyVariant} onChange={event => { void changeField('scenes.prologue.copyVariant', event.target.value) }}><option value="awakening">Начать с одной маленькой искры</option><option value="legacy">Прежняя формулировка</option></select>
            </div>
          </>}
          {group.controls.map(range)}
        </details>)}
        {selected === 'growth' && <>
          <details open><summary>Формирование семечка</summary>
            <div className="composer-control"><div className="inspector-control-heading"><label htmlFor="composer-scenes-growth-particleQuality">Качество семечка</label>{config.scenes.growth.particleQuality !== defaultAtPath('scenes.growth.particleQuality') && <button type="button" className="inspector-reset" aria-label="Сбросить качество семечка" onClick={() => { void resetField('scenes.growth.particleQuality') }}>↺</button>}</div>
              <select id="composer-scenes-growth-particleQuality" value={config.scenes.growth.particleQuality} onChange={(event) => { void changeField('scenes.growth.particleQuality', event.target.value) }}><option value="low">Низкое · 2304</option><option value="standard">Обычное · 4096</option><option value="high">Высокое · 9216</option></select>
            </div>
            {GROWTH_GROUPS.map(group => <details key={group.name} open={group.name === 'Частицы и формирование'}><summary>{group.name}</summary>{group.controls.map(range)}{group.color && color(group.color.path, group.color.label)}</details>)}
          </details>
          <details open><summary>Lily Growth Particles</summary>
            {LILY_GROWTH_PARTICLE_CONTROLS.map(range)}
            {color('scenes.growth.vfxParticleTint', 'Color / Tint')}
          </details>
          <details open><summary>Lily Growth Pulse</summary>
            <label className="composer-control"><input id="composer-scenes-growth-vfxPulseEnabled" type="checkbox" checked={config.scenes.growth.vfxPulseEnabled} onChange={event => { void changeField('scenes.growth.vfxPulseEnabled', event.target.checked) }} /> Enable Pulse</label>
            {LILY_GROWTH_PULSE_CONTROLS.map(range)}
            {color('scenes.growth.vfxPulseColor', 'Pulse Color / Tint')}
          </details>
          <p>Обе длительности анимации цветка настраиваются здесь и в сцене раскрытия.</p>
          <details><summary>Палитра частиц</summary>
            {color('scenes.growth.pearlColor', 'Жемчужный')}
            {color('scenes.growth.roseColor', 'Розовый')}
            {color('scenes.growth.lavenderColor', 'Лавандовый')}
          </details>
        </>}
        {selected === 'bloom' && <details open><summary>Анимация раскрытия</summary>
          <details open><summary>Камера · CameraDirector</summary>{BLOOM_CONTROLS.map(range)}</details>
          <p>Раскрытие начинается автоматически после короткой паузы роста. Камера плавно приближается к цветку.</p>
        </details>}
        {selected === 'identity' && <>
          <details open><summary>Растворение лилии и вихрь</summary>{DISSOLVE_CONTROLS.map(range)}</details>
          <details open><summary>Сборка портрета из частиц</summary>{PORTRAIT_CONTROLS.map(range)}</details>
          <details open><summary>Камера · кадр и отъезд</summary>
            {IDENTITY_CAMERA_CONTROLS.map(range)}
            <p>Наклон взгляда задаётся высотой камеры, дистанцией и точкой фокуса. Параметры кадра общие с концом сцены 03, поэтому первый кадр сцены 04 остаётся непрерывным.</p>
          </details>
        </>}
        {selected === 'gallery' && <details open><summary>Scene 05 — Лунная галерея</summary>
          {color('scenes.gallery.moonLightColor', 'Цвет лунного света')}
          <details open><summary>Колонны и геометрия галереи</summary>
            <div className="composer-control"><div className="inspector-control-heading"><label htmlFor="composer-scenes-gallery-columnVisible">Показывать колонны</label>{config.scenes.gallery.columnVisible !== defaultAtPath('scenes.gallery.columnVisible') && <button type="button" className="inspector-reset" aria-label="Сбросить видимость колонн" onClick={() => { void resetField('scenes.gallery.columnVisible') }}>↺</button>}</div><input id="composer-scenes-gallery-columnVisible" data-testid="composer-scenes-gallery-columnVisible" type="checkbox" checked={config.scenes.gallery.columnVisible} onChange={(event) => { void changeField('scenes.gallery.columnVisible', event.target.checked) }} /></div>
            {GALLERY_LAYOUT_CONTROLS.map(range)}
          </details>
          <details open><summary>Компоновка картин A/B</summary>
            <div className="composer-control">
              <div className="inspector-control-heading"><label htmlFor="composer-scenes-gallery-galleryLayoutVariant">Вариант расположения картин</label></div>
              <select id="composer-scenes-gallery-galleryLayoutVariant" data-testid="composer-scenes-gallery-galleryLayoutVariant" value={config.scenes.gallery.galleryLayoutVariant} onChange={(event) => { void changeField('scenes.gallery.galleryLayoutVariant', event.target.value) }}>
                <option value="on-columns">A · На колоннах</option>
                <option value="between-columns">B · Между колоннами</option>
              </select>
            </div>
            {config.scenes.gallery.galleryLayoutVariant === 'between-columns' && <p>Настройки ниже относятся к B и сохраняются отдельно. Для X минус приближает обе стороны к центру, плюс отдаляет.</p>}
            {config.scenes.gallery.galleryLayoutVariant === 'between-columns' && <>
              {range({ path: 'scenes.gallery.galleryPhotoFacingMaxDegrees', label: 'Максимальный разворот картин к зрителю', unit: '°', min: 0, max: 45, step: 1 })}
              <p>Разворот плавно уменьшается по мере приближения и уходит в ноль при фокусе на фотографии.</p>
            </>}
            {config.scenes.gallery.galleryLayoutVariant === 'on-columns' && <p>Настройки ниже относятся к A и сохраняются отдельно от B.</p>}
            {galleryPhotoLayoutControls(config.scenes.gallery.galleryLayoutVariant === 'on-columns' ? 'A' : 'B').map(range)}
          </details>
          <details open><summary>Арка у Луны</summary>
            <div className="composer-control"><div className="inspector-control-heading"><label htmlFor="composer-scenes-gallery-archVisible">Показывать арку</label>{config.scenes.gallery.archVisible !== defaultAtPath('scenes.gallery.archVisible') && <button type="button" className="inspector-reset" aria-label="Сбросить видимость арки" onClick={() => { void resetField('scenes.gallery.archVisible') }}>↺</button>}</div><input id="composer-scenes-gallery-archVisible" data-testid="composer-scenes-gallery-archVisible" type="checkbox" checked={config.scenes.gallery.archVisible} onChange={(event) => { void changeField('scenes.gallery.archVisible', event.target.checked) }} /></div>
            {GALLERY_ARCH_CONTROLS.map(range)}
          </details>
          {GALLERY_CLOUD_GROUPS.map(group => <details key={group.name} open={group.name.startsWith('Near Low') || group.name.startsWith('Waterline') || group.name.startsWith('Moon Clouds')}><summary>{group.name}</summary>
            {group.controls.map(range)}
            {group.name.startsWith('Waterline') && <p>Счётчик управляет только этой группой; количество других облаков на него не влияет.</p>}
          </details>)}
          {GALLERY_CONTROLS.map(range)}
        </details>}
        {selected === 'cosmos' && <>
          <details open><summary>Scene 07 — Galaxy</summary>
            {GALAXY_SELECTS.map((control) => <SelectConfigControl key={control.path} control={control} value={valueAtPath(config, control.path) as string} onChange={(path, value) => { void (path === 'scenes.galaxy.palette' ? changeGalaxyPalette(value as GalaxyPalette) : changeField(path, value)) }} onReset={(path) => { void resetField(path) }} />)}
            <div className="composer-control"><div className="inspector-control-heading"><label htmlFor="composer-scenes-galaxy-seed">Seed генерации</label>{config.scenes.galaxy.seed !== defaultAtPath('scenes.galaxy.seed') && <button type="button" className="inspector-reset" aria-label="Сбросить seed генерации" onClick={() => { void resetField('scenes.galaxy.seed') }}>↺</button>}</div><input id="composer-scenes-galaxy-seed" data-testid="composer-scenes-galaxy-seed" type="text" maxLength={64} value={config.scenes.galaxy.seed} onChange={(event) => { void changeField('scenes.galaxy.seed', event.target.value) }} /></div>
            <label className="composer-control"><input type="checkbox" checked={config.scenes.galaxy.nebulaEnabled} onChange={(event) => { void changeField('scenes.galaxy.nebulaEnabled', event.target.checked) }} /> Газовая туманность</label>
            <label className="composer-control"><input type="checkbox" checked={config.scenes.galaxy.blackHoleEnabled} onChange={(event) => { void changeField('scenes.galaxy.blackHoleEnabled', event.target.checked) }} /> Чёрный центр</label>
            {GALAXY_GROUPS.map((group) => <details key={group.name} open={group.name.startsWith('Galaxy Geometry')}><summary>{group.name}</summary>{group.controls.map(range)}</details>)}
            <details><summary>Colors & Light · live</summary>
              {color('scenes.galaxy.coreColor', 'Цвет ядра')}
              {color('scenes.galaxy.innerColor', 'Цвет внутреннего диска')}
              {color('scenes.galaxy.armColor', 'Цвет спиральных рукавов')}
              {color('scenes.galaxy.nebulaColor', 'Цвет туманности')}
              {color('scenes.galaxy.brightColor', 'Цвет ярких звёзд')}
              {color('scenes.galaxy.backgroundColor', 'Цвет фона')}
              {range({ path: 'scenes.galaxy.exposure', label: 'Экспозиция', unit: '×', min: 0.3, max: 1.8, step: 0.05 })}
              {range({ path: 'scenes.galaxy.coreGlow', label: 'Свечение ядра', unit: '×', min: 0, max: 2, step: 0.05 })}
            </details>
            <button type="button" onClick={() => { void resetScope('galaxy') }}>Сбросить Galaxy</button>
          </details>
        </>}
        {currentScope && <ScenePresetControls scope={currentScope as ScenePresetScope} capture={(name) => captureScenePreset(getConfig(), currentScope as ScenePresetScope, name)} onApply={async (preset) => {
          const scope = currentScope as ScenePresetScope
          const before = getConfig()
          const next = await updateConfig(scenePresetPatch(preset, scope))
          if (preset.openingBackground) history.recordPreset(scope, section(before, scope), section(next, scope), before.scenes.openingBackground, next.scenes.openingBackground)
          else history.record(scope, section(before, scope), section(next, scope))
          setHistoryRevision(value => value + 1)
        }} />}
        {hasSceneControls ? <button type="button" onClick={() => { void resetScope(selected === 'cosmos' ? 'galaxy' : selected as 'preload' | 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery') }}>Сбросить сцену</button> : <p>Для этой сцены пока нет связанных параметров.</p>}
      </section>
      <details className="inspector-section"><summary>Диагностика</summary>
        <div className="dev-actions"><button type="button" data-testid="dev-preload" onClick={onPreload}>Проверить загрузку</button></div>
        <dl><dt>Сцена / режим</dt><dd>{state.scene} / {state.mode}</dd><dt>Пауза / чтение</dt><dd>{String(state.paused)} / {String(state.reading)}</dd><dt>Revision / карточка</dt><dd>{state.revision} / {state.galleryIndex + 1}</dd><dt>Качество / движение</dt><dd>{state.quality} / {reducedMotion ? 'reduced' : 'normal'}</dd><dt>Примерный rAF FPS</dt><dd>{fps ?? 'измеряется…'}</dd></dl><p>rAF FPS — частота кадров браузера, не WebGL.</p>
      </details>
    </aside>
  )
}

