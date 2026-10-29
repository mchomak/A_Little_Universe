import { getPrologueFrames, SCENES, TIMING, type SceneId } from '../engine/filmConfig'
import type { FilmState } from '../engine/film'
import type { SceneComposerConfig } from '../systems/scene-config/config'

export interface TimelineFrame { label: string; start: number }

/** Only boundaries represented by the current film timing model. */
export function timelineFrames(scene: SceneId, config: SceneComposerConfig): TimelineFrame[] {
  const p = getPrologueFrames(config.scenes.prologue)
  switch (scene) {
    case 'prologue': return [
      { label: '01.1 Первый свет', start: 0 }, { label: '01.2 Первая фраза', start: p.first[0] },
      { label: '01.3 Вторая фраза', start: p.second[0] }, { label: '01.4 Распад', start: p.dissolve[0] },
      { label: '01.5 Ожидание', start: p.prompt },
    ]
    case 'growth': return [
      { label: '02.1 Формирование семечка', start: TIMING.growth.formation[0] },
      { label: '02.2 Падение', start: TIMING.growth.fall[0] },
      { label: '02.3 Остановка и импульс', start: TIMING.growth.landing[0] },
      { label: '02.4 Рост и передача', start: TIMING.growth.handoff[0] },
      { label: '02.5 Завершение роста', start: TIMING.growth.settle[0] },
    ]
    case 'bloom': return [{ label: '03 Ожидание / раскрытие', start: 0 }, { label: '03.6 Созерцание', start: TIMING.bloom.contemplate[0] }]
    case 'identity': return [
      { label: '04.1 Лилия', start: 0 }, { label: '04.2 Спираль', start: TIMING.identity.particles[0] },
      { label: '04.3 Имя', start: TIMING.identity.name[0] }, { label: '04.4 Превращение', start: TIMING.identity.morph[0] },
      { label: '04.5 Портрет', start: TIMING.identity.portrait[0] }, { label: '04.6 Фотография', start: TIMING.identity.photo[0] },
      { label: '04.7 Воспоминание', start: TIMING.identity.caption[0] },
    ]
    case 'gallery': return [{ label: '05 Галерея · свободный просмотр', start: 0 }]
    case 'eye': return [{ label: '06 Голубой глаз', start: 0 }, { label: '06.5 Приближение', start: TIMING.eye.approach[0] }]
    case 'cosmos': return [
      { label: '07.1 Радужка', start: 0 }, { label: '07.2 Галактика', start: TIMING.cosmos.particles[0] },
      { label: '07.3 Космос', start: TIMING.cosmos.spiral[0] }, { label: '07.4 Букет', start: TIMING.cosmos.bouquet[0] },
      { label: '07.5 Завершение', start: TIMING.cosmos.settle[0] },
    ]
    case 'greeting': return [{ label: '08 Поздравление', start: 0 }, { label: '08 Титры', start: TIMING.greeting.credits[0] }]
    case 'ending': return [{ label: '09 Финал', start: 0 }]
  }
}

export function canSeekTimeline(state: FilmState, filmVisible: boolean): boolean {
  return filmVisible && SCENES[state.scene].duration > 0 && state.mode !== 'ready' && state.mode !== 'transitioning'
    && !(state.scene === 'bloom' && state.mode === 'waiting') && !state.reading
}

export function activeFrameIndex(frames: TimelineFrame[], elapsed: number): number {
  return frames.reduce((index, frame, i) => frame.start <= elapsed + 0.0001 ? i : index, 0)
}
