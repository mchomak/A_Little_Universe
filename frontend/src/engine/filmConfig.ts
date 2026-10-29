import type { FilmState, SceneId } from './film'
import { DEFAULT_SCENE_COMPOSER_CONFIG, type SceneComposerConfig } from '../systems/scene-config/config'
export type { SceneId } from './film'

export const SCENE_ORDER = ['prologue', 'growth', 'bloom', 'identity', 'gallery', 'eye', 'cosmos', 'greeting', 'ending'] as const satisfies readonly SceneId[]

export const TIMING = {
  prologue: { duration: 21, seed: [0, 3], first: [3, 7], second: [10, 15], hold: [15, 16], dissolve: [16, 21], prompt: 21 },
  growth: { duration: 23, seed: [0, 4], fall: [4, 7], awakening: [7, 11], stem: [11, 18], settle: [18, 23] },
  bloom: { duration: 22, opening: [0, 16], contemplate: [16, 22] },
  identity: {
    duration: 21,
    dissolve: [0, 3.5], gather: [3.5, 7.5], portrait: [7.5, 10.5],
    portraitUnderlay: [7, 7.5], portraitUnderlayOpacity: 0.38,
    photo: [10.5, 13.5], frame: [13.5, 15], caption: [14.25, 15.75], cameraSettle: 3.5,
  },
  gallery: { duration: 0, move: 1.2 },
  eye: { duration: 18, approach: [15, 18] },
  cosmos: { duration: 26, iris: [0, 5], particles: [5, 11], spiral: [11, 15], bouquet: [15, 22], settle: [22, 26] },
  greeting: { duration: 50, reveal: [0, 12], credits: [12, 50] },
  ending: { duration: 0 }, transition: 0.7,
  camera: { bloom: 16, gallery: 1.2, eye: 3, cosmos: 26 },
} as const

export type PrologueFrameSettings = Pick<SceneComposerConfig['scenes']['prologue'],
  'handwritingDuration' | 'interphraseInterval' | 'readableHold' | 'particleDuration'>

export interface PrologueFrames {
  duration: number
  seed: readonly [number, number]
  first: readonly [number, number]
  second: readonly [number, number]
  hold: readonly [number, number]
  dissolve: readonly [number, number]
  prompt: number
  particleTravelDuration: number
}

export interface HandwritingStep {
  glyph: string
  start: number
  duration: number
}

/** Stable per-grapheme beats give glyphs a drawn-on rhythm without a typewriter cursor. */
export function createHandwritingSchedule(text: string, duration: number, rhythm: number): HandwritingStep[] {
  const glyphs = Array.from(text)
  if (glyphs.length === 0) return []

  const variation = Math.min(3, Math.max(0.1, Number.isFinite(rhythm) ? rhythm : 1))
  const weights = glyphs.map((glyph, index) => {
    const contour = ((index * 7) % 5 - 2) / 2
    const kindWeight = /^\s$/u.test(glyph) ? 0.42
      : /[.,:;!?…—]/u.test(glyph) ? 1.8
        : /[ЖжЗзШшЩщЧчЦцФф]/u.test(glyph) ? 1.14 : 1
    return kindWeight * (1 + contour * 0.12 * variation)
  })
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const totalDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  let start = 0
  return glyphs.map((glyph, index) => {
    const beat = totalWeight === 0 ? 0 : totalDuration * (weights[index] ?? 0) / totalWeight
    const step = { glyph, start, duration: beat }
    start += beat
    return step
  })
}

/** Fits configured reveal beats inside the fixed scene gate and its seek bounds. */
export function getPrologueFrames(settings: PrologueFrameSettings): PrologueFrames {
  const duration = TIMING.prologue.duration
  const firstStart = TIMING.prologue.first[0]
  const firstWrite = Math.min(settings.handwritingDuration, TIMING.prologue.first[1] - firstStart)
  const firstEnd = firstStart + firstWrite
  const defaultInterval = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.interphraseInterval
  const storyboardGap = TIMING.prologue.second[0] - TIMING.prologue.first[1]
  const desiredSecondStart = firstEnd + storyboardGap + settings.interphraseInterval - defaultInterval
  const secondStart = Math.min(
    Math.max(firstEnd + settings.interphraseInterval, desiredSecondStart),
    TIMING.prologue.second[1] - 0.5,
  )
  const secondWrite = Math.min(settings.handwritingDuration,
    TIMING.prologue.second[1] - TIMING.prologue.second[0], TIMING.prologue.second[1] - secondStart)
  const secondEnd = secondStart + secondWrite
  const particleTravelDuration = Math.min(settings.particleDuration, TIMING.prologue.dissolve[1] - TIMING.prologue.dissolve[0])
  const latestDissolveStart = duration - particleTravelDuration
  const storyboardHold = TIMING.prologue.hold[1] - TIMING.prologue.hold[0]
  const configBaselineOffset = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.readableHold - storyboardHold
  const desiredDissolveStart = TIMING.prologue.hold[0] + Math.max(0, settings.readableHold - configBaselineOffset)
  const dissolveStart = Math.max(secondEnd, Math.min(desiredDissolveStart, latestDissolveStart))

  return {
    duration,
    seed: TIMING.prologue.seed,
    first: [firstStart, firstEnd],
    second: [secondStart, secondEnd],
    hold: [secondEnd, dissolveStart],
    dissolve: [dissolveStart, duration],
    prompt: TIMING.prologue.prompt,
    particleTravelDuration,
  }
}

/** Keeps the shared points layer visible only while the configured dissolve is in flight. */
export function getPrologueParticleOpacity(time: number, frames: PrologueFrames, reducedMotion: boolean): number {
  if (!Number.isFinite(time) || reducedMotion || time < frames.dissolve[0] || time >= frames.duration) return 0
  return Math.min(1, Math.max(0, (time - frames.dissolve[0]) * 4))
}

export interface SceneConfig {
  id: SceneId
  label: string
  duration: number
  entryMode: FilmState['mode']
}

export const SCENES: Record<SceneId, SceneConfig> = {
  prologue: { id: 'prologue', label: 'Пролог', duration: TIMING.prologue.duration, entryMode: 'playing' },
  growth: { id: 'growth', label: 'Рост', duration: TIMING.growth.duration, entryMode: 'playing' },
  bloom: { id: 'bloom', label: 'Раскрытие', duration: TIMING.bloom.duration, entryMode: 'waiting' },
  identity: { id: 'identity', label: 'Первая фотография', duration: TIMING.identity.duration, entryMode: 'playing' },
  gallery: { id: 'gallery', label: 'Галерея', duration: TIMING.gallery.duration, entryMode: 'exploring' },
  eye: { id: 'eye', label: 'Глаз', duration: TIMING.eye.duration, entryMode: 'playing' },
  cosmos: { id: 'cosmos', label: 'Космос', duration: TIMING.cosmos.duration, entryMode: 'playing' },
  greeting: { id: 'greeting', label: 'Поздравление', duration: TIMING.greeting.duration, entryMode: 'playing' },
  ending: { id: 'ending', label: 'Конец', duration: TIMING.ending.duration, entryMode: 'ended' },
}

export const COPY = {
  prologueFirst: 'Я долго думал, что тебе подарить…',
  prologueSecond: 'И решил, что ты заслуживаешь чего-то особенного:',
  seedPrompt: 'Прикоснись к свету', flowerPrompt: 'Прикоснись к бутону', name: 'ВАСИЛИСА',
  portrait: 'Портрет — временный placeholder', photo: 'Фотография — временный placeholder',
  photoCaption: 'С этого всё началось', greetingTitle: 'С днём рождения, Василиса!',
  greetingWish: 'Пусть в твоей жизни всегда будет место для чего-то по-настоящему волшебного',
  letterTitle: 'Временный текст поздравления',
  letter: 'Здесь появится личное письмо. Сейчас это обозначенное место для будущего текста.',
  credits: 'A Little Universe for You · Development placeholders', ending: 'Маленькая вселенная для тебя',
} as const

export const MEMORIES = Array.from({ length: 6 }, (_, index) => ({
  id: `memory-${index + 1}`, index, title: `Фотография ${index + 1}`,
  caption: 'Место для фотографии и подписи · placeholder', placeholder: true as const,
}))
