import { getBloomSceneFrames, getGreetingFrames, getGrowthSceneFrames, getPrologueFrames, getSceneDuration, TIMING, type SceneId } from '../engine/filmConfig'
import { getGalaxyRevealState } from '../scenes/galaxy/animation'
import type { FilmState } from '../engine/film'
import type { SceneComposerConfig } from '../systems/scene-config/config'

export interface TimelineFrame { label: string; start: number }

/** Only boundaries represented by the current film timing model. */
export function timelineFrames(scene: SceneId, config: SceneComposerConfig, creditsScrollDuration?: number | null, letterOnly = false): TimelineFrame[] {
  const p = getPrologueFrames(config.scenes.prologue)
  const g = getGrowthSceneFrames(config.scenes.growth)
  switch (scene) {
    case 'prologue': return [
      { label: '01.1 Первый свет', start: 0 }, { label: '01.2 Первая фраза', start: p.first[0] },
      { label: '01.3 Вторая фраза', start: p.second[0] }, { label: '01.4 Распад', start: p.dissolve[0] },
      { label: '01.5 Ожидание', start: p.prompt },
    ]
    case 'growth': return [
      { label: '02.1 Формирование семечка', start: g.formation[0] },
      { label: '02.2 Падение', start: g.fall[0] },
      { label: '02.3 Удар и искры', start: g.landing[0] },
      { label: '02.3 Лунный свет', start: g.moonlight[0] },
      { label: '02.4 Рост и передача', start: g.handoff[0] },
      { label: '02.5 Завершение роста', start: g.settle[0] },
    ]
    case 'bloom': return [{ label: '03 Ожидание / раскрытие', start: 0 }, { label: '03.6 Созерцание', start: getBloomSceneFrames(config.scenes.bloom).contemplate[0] }]
    case 'identity': return [{ label: '04.1 Растворение лилии', start: 0 }]
    case 'gallery': return [{ label: '05 Галерея · свободный просмотр', start: 0 }]
    case 'eye': return [{ label: '06 Голубой глаз', start: 0 }, { label: '06.5 Приближение', start: TIMING.eye.approach[0] }]
    case 'cosmos': return [
      { label: '07.1 Радужка', start: 0 }, { label: '07.2 Галактика', start: TIMING.cosmos.particles[0] },
      { label: '07.3 Космос', start: TIMING.cosmos.spiral[0] }, { label: '07.4 Плавное замедление', start: getGalaxyRevealState(0, config.scenes.galaxy).settleStart },
      { label: '07.5 Финальный ракурс', start: TIMING.cosmos.duration - 0.01 },
    ]
    case 'greeting': {
      const greeting = getGreetingFrames(config.scenes.prologue)
      const crawlDuration = typeof creditsScrollDuration === 'number' && Number.isFinite(creditsScrollDuration)
        ? creditsScrollDuration : Math.max(0, greeting.completion - greeting.credits[0])
      const creditsComplete = Math.min(greeting.completion, greeting.credits[0] + crawlDuration)
      if (letterOnly) return [
        { label: '08.6 Повторное письмо', start: 0 },
        { label: '08.7 Завершение титров', start: Math.min(greeting.completion, crawlDuration) },
        { label: '09 Постоянный финал', start: Math.min(greeting.completion, crawlDuration) },
      ]
      return [
        { label: '08.1 Первая фраза', start: greeting.first[0] },
        { label: '08.2 Вторая фраза', start: greeting.second[0] },
        { label: '08.3 Чтение', start: greeting.reading[0] },
        { label: '08.4 Растворение первой', start: greeting.firstDissolve[0] },
        { label: '08.5 Растворение второй', start: greeting.secondDissolve[0] },
        { label: '08.6 Начало письма', start: greeting.credits[0] },
        { label: '08.7 Завершение титров', start: creditsComplete },
        { label: '09 Постоянный финал', start: creditsComplete },
      ]
    }
    case 'ending': return [{ label: '09 Финал', start: 0 }]
  }
}

export function canSeekTimeline(state: FilmState, filmVisible: boolean, config?: SceneComposerConfig): boolean {
  return filmVisible && getSceneDuration(state.scene, config) > 0 && state.mode !== 'ready' && state.mode !== 'transitioning'
    && !(state.scene === 'bloom' && state.mode === 'waiting') && !state.reading
}

export function activeFrameIndex(frames: TimelineFrame[], elapsed: number): number {
  return frames.reduce((index, frame, i) => frame.start <= elapsed + 0.0001 ? i : index, 0)
}
