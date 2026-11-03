import type { FilmState, SceneId } from './film'
import { getConfig, type SceneComposerConfig } from '../systems/scene-config/config'
export type { SceneId } from './film'

export const SCENE_ORDER = ['prologue', 'growth', 'bloom', 'identity', 'gallery', 'eye', 'cosmos', 'greeting', 'ending'] as const satisfies readonly SceneId[]

export const TIMING = {
  prologue: { duration: 18, seed: [0, 2], first: [2, 5.5], second: [7, 10.5], hold: [10.5, 12.5], dissolve: [12.5, 16], prompt: 18 },
  growth: { duration: 22.8, formation: [0, 3.2], fall: [3.2, 11.2], landing: [11.2, 11.7], moonlight: [11.7, 13.2], handoff: [11.9, 12.65], sprout: [12.65, 20.9], stem: [16.7, 20.9], settle: [20.9, 22.8] },
  bloom: { duration: 22, opening: [0, 16], contemplate: [16, 22] },
  identity: { duration: 34, flower: [0, 4], particles: [4, 8], name: [8, 13], morph: [13, 17], portrait: [17, 23], photo: [23, 34], caption: [28, 34] },
  gallery: { duration: 0, move: 1.2 },
  eye: { duration: 18, approach: [15, 18] },
  cosmos: { duration: 26, iris: [0, 5], particles: [5, 11], spiral: [11, 15], settle: [22, 26] },
  greeting: { duration: 300, crawlSpeed: 26, postDissolvePause: 1 },
  ending: { duration: 0 }, transition: 0.7,
  camera: { bloom: 16, gallery: 1.2, eye: 3, cosmos: 26 },
} as const

export interface GrowthSceneFrames {
  duration: number
  formation: readonly [number, number]
  fall: readonly [number, number]
  islandReveal: readonly [number, number]
  landing: readonly [number, number]
  moonlight: readonly [number, number]
  handoff: readonly [number, number]
  sprout: readonly [number, number]
  stem: readonly [number, number]
  settle: readonly [number, number]
  model: readonly [number, number]
}

export interface BloomSceneFrames {
  duration: number
  opening: readonly [number, number]
  contemplate: readonly [number, number]
}

const LILY_GROWTH_SETTLE_DURATION = 1.9
const LILY_BLOOM_CONTEMPLATE_DURATION = TIMING.bloom.duration - TIMING.bloom.opening[1]
const clamp = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const round = (value: number) => Number(value.toFixed(2))

/** Model growth begins with the seed-to-sprout handoff; the existing settle beat remains after the GLB clip. */
export function getGrowthSceneFrames(settings: SceneComposerConfig['scenes']['growth'] = getConfig().scenes.growth): GrowthSceneFrames {
  const formationEnd = round(clamp(settings.formationDuration, 2.5, 3.5, 3.2))
  const fallEnd = round(formationEnd + clamp(settings.seedFallDuration, 1.8, 20, 8))
  const islandRevealDuration = clamp(settings.islandRevealDuration, 0.4, 3, 1.5)
  const modelStart = round(fallEnd + 0.7)
  const handoffEnd = round(fallEnd + 1.45)
  const modelEnd = round(modelStart + clamp(settings.flowerGrowthDuration, 4, 14, 9))
  const duration = round(modelEnd + LILY_GROWTH_SETTLE_DURATION)
  return {
    duration,
    formation: [0, formationEnd],
    fall: [formationEnd, fallEnd],
    islandReveal: [round(Math.max(0, fallEnd - islandRevealDuration)), fallEnd],
    landing: [fallEnd, round(fallEnd + 0.5)],
    moonlight: [round(fallEnd + 0.5), round(fallEnd + 2)],
    handoff: [modelStart, handoffEnd],
    sprout: [handoffEnd, modelEnd],
    stem: [round(modelEnd - 4.2), modelEnd],
    settle: [modelEnd, duration],
    model: [modelStart, modelEnd],
  }
}

export function getBloomSceneFrames(settings: SceneComposerConfig['scenes']['bloom'] = getConfig().scenes.bloom): BloomSceneFrames {
  const openingDuration = clamp(settings.flowerBloomDuration, 6, 24, 16)
  return {
    duration: openingDuration + LILY_BLOOM_CONTEMPLATE_DURATION,
    opening: [0, openingDuration],
    contemplate: [openingDuration, openingDuration + LILY_BLOOM_CONTEMPLATE_DURATION],
  }
}

export function getSceneDuration(scene: SceneId, config: SceneComposerConfig = getConfig()): number {
  if (scene === 'growth') return getGrowthSceneFrames(config.scenes.growth).duration
  if (scene === 'bloom') return getBloomSceneFrames(config.scenes.bloom).duration
  return SCENES[scene].duration
}

/** Remaps a live duration edit to the same seed phase or animation progress without a pose jump. */
export function retimeSceneElapsed(
  scene: SceneId,
  elapsed: number,
  previous: SceneComposerConfig,
  next: SceneComposerConfig,
  mode: FilmState['mode'],
): number {
  if (!Number.isFinite(elapsed)) return 0
  if (scene === 'growth') {
    const before = getGrowthSceneFrames(previous.scenes.growth)
    const after = getGrowthSceneFrames(next.scenes.growth)
    if (elapsed < before.formation[1]) return remapRange(elapsed, [0, before.formation[1]], [0, after.formation[1]])
    if (elapsed < before.fall[1]) return remapRange(elapsed, before.fall, after.fall)
    if (elapsed < before.handoff[0]) return remapRange(elapsed, [before.fall[1], before.handoff[0]], [after.fall[1], after.handoff[0]])
    if (elapsed < before.handoff[1]) return remapRange(elapsed, before.handoff, after.handoff)
    if (elapsed < before.model[1]) return remapRange(elapsed, [before.handoff[1], before.model[1]], [after.handoff[1], after.model[1]])
    return Math.min(after.duration, after.model[1] + elapsed - before.model[1])
  }
  if (scene === 'bloom') {
    if (mode === 'waiting') return 0
    const before = getBloomSceneFrames(previous.scenes.bloom)
    const after = getBloomSceneFrames(next.scenes.bloom)
    if (elapsed <= before.opening[1]) return remapRange(elapsed, before.opening, after.opening)
    return Math.min(after.duration, after.opening[1] + elapsed - before.opening[1])
  }
  return Math.max(0, elapsed)
}

function remapRange(value: number, before: readonly [number, number], after: readonly [number, number]): number {
  const progress = Math.min(1, Math.max(0, (value - before[0]) / Math.max(0.001, before[1] - before[0])))
  return after[0] + (after[1] - after[0]) * progress
}

export type PrologueFrameSettings = Pick<SceneComposerConfig['scenes']['prologue'],
  'handwritingDuration' | 'interphraseInterval' | 'readableHold' | 'fractureDuration' | 'particleDuration'>

export interface PrologueFrames {
  duration: number
  seed: readonly [number, number]
  first: readonly [number, number]
  second: readonly [number, number]
  hold: readonly [number, number]
  dissolve: readonly [number, number]
  firstDissolve: readonly [number, number]
  secondDissolve: readonly [number, number]
  prompt: number
  particleTravelDuration: number
}

export interface GreetingFrames extends PrologueFrames {
  reading: readonly [number, number]
  credits: readonly [number, number]
  completion: number
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
  const waveDuration = Math.min(bounded(settings.fractureDuration, 0.8, 4, 1.5), (dissolveEnd - dissolveStart) / 1.5)
  const firstDissolve: readonly [number, number] = [dissolveStart, dissolveStart + waveDuration]
  const secondDissolveStart = dissolveStart + waveDuration * 0.5
  const secondDissolve: readonly [number, number] = [secondDissolveStart, secondDissolveStart + waveDuration]
  const particleTravelDuration = Math.min(bounded(settings.particleDuration, 0.1, 20, 2.2), dissolveEnd - dissolveStart)

  return {
    duration,
    seed: TIMING.prologue.seed,
    first: [firstStart, firstEnd],
    second: [secondStart, secondEnd],
    hold: [secondEnd, dissolveStart],
    dissolve: [dissolveStart, dissolveEnd],
    firstDissolve,
    secondDissolve,
    prompt: TIMING.prologue.prompt,
    particleTravelDuration,
  }
}

/** Reuses the prologue's handwriting and dissolve controls for the two final phrases. */
export function getGreetingFrames(settings: PrologueFrameSettings): GreetingFrames {
  const handwriting = bounded(settings.handwritingDuration, 0.5, 3.5, 3.5)
  const interval = bounded(settings.interphraseInterval, 0.4, 2.5, 1.35)
  const first: readonly [number, number] = [1, 1 + handwriting]
  const secondStart = first[0] + interval
  const secondDuration = bounded(handwriting * 2.05, 4.5, 8, 7.2)
  const second: readonly [number, number] = [secondStart, secondStart + secondDuration]
  const readStart = second[1]
  const readDuration = Math.max(6, bounded(settings.readableHold, 0, 30, 2))
  const dissolveStart = readStart + readDuration
  const dissolveDuration = bounded(settings.fractureDuration, 0.8, 4, 1.5)
  const firstDissolve: readonly [number, number] = [dissolveStart, dissolveStart + dissolveDuration]
  const secondDissolve: readonly [number, number] = [dissolveStart + dissolveDuration * 0.5, dissolveStart + dissolveDuration * 1.5]
  const particleTravelDuration = bounded(settings.particleDuration, 0.1, 20, 2.2)
  const dissolve: readonly [number, number] = [dissolveStart, secondDissolve[1] + particleTravelDuration]
  const creditsStart = dissolve[1] + TIMING.greeting.postDissolvePause
  return {
    duration: TIMING.greeting.duration,
    seed: [0, 0], first, second, reading: [readStart, dissolveStart], hold: [readStart, dissolveStart],
    dissolve, firstDissolve, secondDissolve, prompt: creditsStart, particleTravelDuration,
    credits: [creditsStart, TIMING.greeting.duration], completion: TIMING.greeting.duration,
  }
}

/** Scrolls the whole letter past both viewport edges at a constant, readable pixel speed. */
export function getCreditsScrollDuration(contentHeight: number, viewportHeight: number, speed: number = TIMING.greeting.crawlSpeed): number {
  const height = Number.isFinite(contentHeight) ? Math.max(0, contentHeight) : 0
  const viewport = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0
  const pixelsPerSecond = bounded(speed, 8, 80, TIMING.greeting.crawlSpeed)
  return (height + viewport + 80) / pixelsPerSecond
}

export function getCreditsScrollProgress(time: number, start: number, duration: number): number {
  if (![time, start, duration].every(Number.isFinite) || duration <= 0) return 0
  return Math.min(1, Math.max(0, (time - start) / duration))
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
  credits: 'Lily: “White lily” by Nmn9 · Blend Swap #74582 · CC BY 3.0 · modified for A Little Universe for You · blendswap.com/blends/view/74582 · creativecommons.org/licenses/by/3.0/', ending: 'Маленькая вселенная для тебя',
} as const

export function getPrologueCopy(settings: Pick<SceneComposerConfig['scenes']['prologue'], 'copyVariant'>) {
  return { first: COPY.prologueFirst, second: settings.copyVariant === 'legacy' ? COPY.prologueSecondLegacy : COPY.prologueSecond }
}

// Only supplied memories enter navigation. Eye close-ups belong to scene 06.
export const MEMORIES = [
  { id: 'memory-1', index: 0, title: 'Знакомство', caption: COPY.photoCaption, placeholder: false },
]
