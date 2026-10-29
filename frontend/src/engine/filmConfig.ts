import type { FilmState, SceneId } from './film'
import { getConfig, type SceneComposerConfig } from '../systems/scene-config/config'
export type { SceneId } from './film'

export const SCENE_ORDER = ['prologue', 'growth', 'bloom', 'identity', 'gallery', 'eye', 'cosmos', 'greeting', 'ending'] as const satisfies readonly SceneId[]

export const TIMING = {
  prologue: { duration: 18, seed: [0, 2], first: [2, 5.5], second: [7, 10.5], hold: [10.5, 12.5], dissolve: [12.5, 16], prompt: 18 },
  growth: { duration: 23, formation: [0, 2.8], fall: [2.8, 4.45], landing: [4.45, 5.15], moonlight: [4.95, 6.65], handoff: [5.65, 6.4], sprout: [5.65, 18], stem: [11, 18], settle: [18, 23] },
  bloom: { duration: 22, opening: [0, 16], contemplate: [16, 22] },
  identity: { duration: 34, flower: [0, 4], particles: [4, 8], name: [8, 13], morph: [13, 17], portrait: [17, 23], photo: [23, 34], caption: [28, 34] },
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
  const firstWrite = bounded(settings.handwritingDuration, 0.5, 3.5, 3.5)
  const firstEnd = firstStart + firstWrite
  const secondStart = Math.min(firstEnd + bounded(settings.interphraseInterval, 0, 8, 1.5), 10.5)
  const secondWrite = Math.min(firstWrite, 11.5 - secondStart)
  const secondEnd = secondStart + secondWrite
  const dissolveEnd = TIMING.prologue.dissolve[1]
  const dissolveStart = Math.min(14, secondEnd + bounded(settings.readableHold, 0, 30, 2))
  const particleTravelDuration = Math.min(bounded(settings.particleDuration, 0.1, 20, 2.2), dissolveEnd - dissolveStart)

  return {
    duration,
    seed: TIMING.prologue.seed,
    first: [firstStart, firstEnd],
    second: [secondStart, secondEnd],
    hold: [secondEnd, dissolveStart],
    dissolve: [dissolveStart, dissolveEnd],
    prompt: TIMING.prologue.prompt,
    particleTravelDuration,
  }
}

function bounded(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** Captured on deliberate touch so a live composer edit cannot shorten an active reaction. */
export function getPrologueTouchDuration(settings = getConfig().scenes.prologue): number {
  return bounded(settings.touchDuration, 0.7, 1, 0.85)
}

/** Keeps the shared points layer visible only while the configured dissolve is in flight. */
export function getPrologueParticleOpacity(time: number, frames: PrologueFrames, reducedMotion: boolean): number {
  if (!Number.isFinite(time) || reducedMotion || time < frames.dissolve[0] || time >= frames.dissolve[1]) return 0
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
  identity: { id: 'identity', label: 'Василиса', duration: TIMING.identity.duration, entryMode: 'playing' },
  gallery: { id: 'gallery', label: 'Галерея', duration: TIMING.gallery.duration, entryMode: 'exploring' },
  eye: { id: 'eye', label: 'Глаз', duration: TIMING.eye.duration, entryMode: 'playing' },
  cosmos: { id: 'cosmos', label: 'Космос', duration: TIMING.cosmos.duration, entryMode: 'playing' },
  greeting: { id: 'greeting', label: 'Поздравление', duration: TIMING.greeting.duration, entryMode: 'playing' },
  ending: { id: 'ending', label: 'Конец', duration: TIMING.ending.duration, entryMode: 'ended' },
}

export const COPY = {
  prologueFirst: 'Я долго думал, что тебе подарить…',
  prologueSecond: 'И решил начать с одной маленькой искры.',
  prologueSecondLegacy: 'И решил, что ты заслуживаешь чего-то особенного:',
  seedPrompt: 'Прикоснись к свету', flowerPrompt: 'Прикоснись к бутону', name: 'ВАСИЛИСА',
  portrait: 'Портрет — временный placeholder', photo: 'Фотография — временный placeholder',
  photoCaption: 'С этого всё началось', greetingTitle: 'С днём рождения, Василиса!',
  greetingWish: 'Пусть в твоей жизни всегда будет место для чего-то по-настоящему волшебного',
  letterTitle: 'Временный текст поздравления',
  letter: 'Здесь появится личное письмо. Сейчас это обозначенное место для будущего текста.',
  credits: 'A Little Universe for You · Development placeholders', ending: 'Маленькая вселенная для тебя',
} as const

export function getPrologueCopy(settings: Pick<SceneComposerConfig['scenes']['prologue'], 'copyVariant'>) {
  return { first: COPY.prologueFirst, second: settings.copyVariant === 'legacy' ? COPY.prologueSecondLegacy : COPY.prologueSecond }
}

// Only supplied memories enter navigation. Eye close-ups belong to scene 06.
export const MEMORIES = [
  { id: 'memory-1', index: 0, title: 'Знакомство', caption: COPY.photoCaption, placeholder: false },
]
