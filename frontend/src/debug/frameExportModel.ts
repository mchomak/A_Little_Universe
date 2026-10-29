import { getPrologueFrames, SCENES, type SceneId } from '../engine/filmConfig'
import type { SceneComposerConfig } from '../systems/scene-config/config'
import { timelineFrames } from './timelineModel'

export interface FrameExportCheckpoint {
  sceneId: SceneId
  label: string
  time: number
}

/** Captures authored beat boundaries, with denser samples for prologue lettering and dissolve. */
export function frameExportCheckpoints(sceneId: SceneId, config: SceneComposerConfig): FrameExportCheckpoint[] {
  const duration = SCENES[sceneId].duration
  const frames = timelineFrames(sceneId, config)

  if (duration === 0) {
    return [{ sceneId, label: frames[0]?.label ?? SCENES[sceneId].label, time: 0 }]
  }

  const timedFrames = frames.filter(frame => frame.start < duration)
  const authored = timedFrames.flatMap((frame, index) => {
    const nextTime = timedFrames[index + 1]?.start ?? duration
    const midpoint = (frame.start + nextTime) / 2
    return [
      { sceneId, label: `${frame.label} · начало`, time: frame.start },
      ...(nextTime - frame.start >= 1 ? [{ sceneId, label: `${frame.label} · середина`, time: midpoint }] : []),
    ]
  })

  if (sceneId !== 'prologue') return authored

  const prologueFrames = getPrologueFrames(config.scenes.prologue)
  const animatedWindows = [
    { label: '01.2 Первая фраза · написание', range: prologueFrames.first },
    { label: '01.3 Вторая фраза · написание', range: prologueFrames.second },
    { label: '01.4 Распад фраз', range: prologueFrames.dissolve },
  ]
  const dense = animatedWindows.flatMap(({ label, range: [start, end] }) => {
    const duration = end - start
    const points: FrameExportCheckpoint[] = []
    const steps = Math.ceil(duration / 0.5)
    for (let step = 1; step <= steps; step++) {
      const offset = Math.min(step * 0.5, duration)
      const time = Number((start + offset).toFixed(3))
      points.push({ sceneId, label: `${label} · ${offset.toFixed(1)} с`, time })
    }
    return points
  })
  const unique = new Map<number, FrameExportCheckpoint>()
  for (const checkpoint of [...authored, ...dense]) unique.set(Number(checkpoint.time.toFixed(3)), checkpoint)
  return [...unique.values()].sort((left, right) => left.time - right.time)
}
