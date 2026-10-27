import type { FilmState, SceneId } from './film'
export type { SceneId } from './film'

export const SCENE_ORDER = ['prologue', 'growth', 'bloom', 'identity', 'gallery', 'eye', 'cosmos', 'greeting', 'ending'] as const satisfies readonly SceneId[]

export const TIMING = {
  prologue: { duration: 16, seed: [0, 3], first: [3, 8], second: [8.7, 14.7], prompt: 16 },
  growth: { duration: 23, seed: [0, 4], fall: [4, 7], awakening: [7, 11], stem: [11, 18], settle: [18, 23] },
  bloom: { duration: 22, opening: [0, 16], contemplate: [16, 22] },
  identity: { duration: 34, flower: [0, 4], particles: [4, 8], name: [8, 13], morph: [13, 17], portrait: [17, 23], photo: [23, 34], caption: [28, 34] },
  gallery: { duration: 0, move: 1.2 },
  eye: { duration: 18, approach: [15, 18] },
  cosmos: { duration: 26, iris: [0, 5], particles: [5, 11], spiral: [11, 15], bouquet: [15, 22], settle: [22, 26] },
  greeting: { duration: 50, reveal: [0, 12], credits: [12, 50] },
  ending: { duration: 0 }, transition: 0.7,
  camera: { bloom: 16, gallery: 1.2, eye: 3, cosmos: 26 },
} as const

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
  prologueSecond: 'И решил, что ты заслуживаешь чего-то особенного:',
  seedPrompt: 'Прикоснись к точке', flowerPrompt: 'Прикоснись к бутону', name: 'ВАСИЛИСА',
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
