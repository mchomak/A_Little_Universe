import { useEffect, useState, type Dispatch } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import { MEMORIES, SCENES, SCENE_ORDER, type SceneId } from '../engine/filmConfig'

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

export default function DeveloperPanel({ state, dispatch, reducedMotion }: {
  state: FilmState
  dispatch: Dispatch<FilmAction>
  reducedMotion: boolean
}) {
  const [selected, setSelected] = useState<SceneId>(state.scene)
  const fps = useApproximateRafFps()
  const duration = SCENES[state.scene].duration
  const canInteract = state.mode === 'waiting' && (state.scene === 'bloom' || state.scene === 'prologue')
  const canSeek = duration > 0 && !(state.scene === 'bloom' && state.mode === 'waiting')
  return (
    <aside id="developer-panel" className="developer-panel" aria-labelledby="developer-title">
      <h2 id="developer-title">Developer Mode</h2>
      <p>Все сцены — технические placeholders.</p>
      <label>Сцена<select data-testid="dev-scene" value={selected} onChange={(event) => setSelected(event.target.value as SceneId)}>{SCENE_ORDER.map((scene) => <option key={scene} value={scene}>{SCENES[scene].label}</option>)}</select></label>
      <div className="dev-actions"><button type="button" data-testid="dev-run" onClick={() => dispatch({ type: 'dev-jump', scene: selected })}>Запустить сцену</button><button type="button" onClick={() => dispatch({ type: 'dev-restart' })}>Перезапустить</button></div>
      <div className="dev-actions"><button type="button" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button><button type="button" disabled={state.scene === 'ending'} onClick={() => dispatch({ type: 'dev-skip' })}>Пропустить сцену</button></div>
      <label>Скорость · {state.speed.toFixed(2)}×<input data-testid="dev-speed" aria-label="Скорость фильма" type="range" min="0.25" max="4" step="0.25" value={state.speed} onChange={(event) => dispatch({ type: 'set-speed', speed: Number(event.target.value) })} /></label>
      <label>Время · {state.elapsed.toFixed(1)} / {duration} с<input data-testid="dev-seek" aria-label="Время сцены" type="range" min="0" max={duration || 1} step="0.1" value={state.elapsed} disabled={!canSeek} onChange={(event) => dispatch({ type: 'dev-seek', time: Number(event.target.value) })} /></label>
      <button type="button" disabled={!canInteract} onClick={() => dispatch({ type: 'interact' })}>Имитировать прикосновение</button>
      <div className="dev-actions"><button type="button" disabled={state.scene !== 'gallery' || state.galleryIndex === 0} onClick={() => dispatch({ type: 'gallery-step', direction: -1 })}>Фото назад</button><button type="button" disabled={state.scene !== 'gallery' || state.galleryIndex === MEMORIES.length - 1} onClick={() => dispatch({ type: 'gallery-step', direction: 1 })}>Фото вперёд</button></div>
      <dl><dt>Сцена / режим</dt><dd>{state.scene} / {state.mode}</dd><dt>Ручная пауза / чтение</dt><dd>{String(state.paused)} / {String(state.reading)}</dd><dt>Revision / карточка</dt><dd>{state.revision} / {state.galleryIndex + 1}</dd><dt>Качество / движение</dt><dd>{state.quality} / {reducedMotion ? 'reduced' : 'normal'}</dd><dt>Примерный rAF FPS</dt><dd>{fps ?? 'измеряется…'}</dd></dl>
      <p>rAF FPS — частота браузерных кадров, не WebGL FPS. Canvas при ожидании может не рисовать. Физический планшет ещё не проверен.</p>
    </aside>
  )
}
