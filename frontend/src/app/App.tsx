import { lazy, Suspense, useState } from 'react'
import { FilmCanvas } from '../engine/FilmCanvas'
import { useFilm } from '../engine/useFilm'
import { useReducedMotion } from '../engine/useReducedMotion'
import { SceneOverlay } from '../components/SceneOverlay'
import { ReadingPanel } from '../components/ReadingPanel'
import { useGallerySwipe } from '../components/useGallerySwipe'

// Vite removes this import and all developer controls from production.
const DeveloperPanel = import.meta.env.DEV
  ? lazy(() => import('../debug/DeveloperPanel'))
  : null

export function App() {
  const { state, dispatch, runtime } = useFilm()
  const reducedMotion = useReducedMotion()
  const [debug, setDebug] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug'))
  const swipe = useGallerySwipe(state.scene === 'gallery' && !state.reading, dispatch)
  const ready = state.mode === 'ready'

  return (
    <main className="universe" data-scene={state.scene} data-mode={state.mode} data-reading={state.reading} data-paused={state.paused}>
      <div className="film-surface" {...swipe}>
        <div className="viewport" role="region" aria-label="Интерактивный фильм · все объекты временные placeholders">
          <FilmCanvas state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />
        </div>
        <header className="page-header">
          <span className="dedication">Для Василисы</span>
          <span className="build-label">Технический прототип</span>
        </header>
        {ready ? (
          <section className="start-screen" aria-labelledby="experience-title">
            <h1 id="experience-title">{import.meta.env.VITE_APP_TITLE?.trim() || 'A Little Universe for You'}</h1>
            <p>Маленькая вселенная для тебя.</p>
            <p className="prototype-note">Все девять сцен доступны. Объекты, фотографии и письмо пока заменены временными placeholders.</p>
            <button className="primary-button" data-testid="start" type="button" onClick={() => dispatch({ type: 'start' })}>Открыть подарок</button>
          </section>
        ) : <SceneOverlay key={`${state.scene}:${state.revision}`} state={state} dispatch={dispatch} runtime={runtime} reducedMotion={reducedMotion} />}
      </div>
      <footer className="page-footer" aria-label="Управление фильмом">
        <span className="film-status">{state.paused ? 'На паузе' : reducedMotion ? 'Уменьшенное движение' : 'Все изображения — placeholders'}</span>
        <div className="playback-controls">
          {!ready && state.mode !== 'ended' && <button type="button" data-testid="pause" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button>}
          <label className="quality-control">Качество
            <select aria-label="Качество графики" value={state.quality} onChange={(event) => dispatch({ type: 'set-quality', quality: event.target.value === 'low' ? 'low' : 'standard' })}>
              <option value="standard">Обычное</option><option value="low">Низкое</option>
            </select>
          </label>
        </div>
      </footer>
      {state.reading && <ReadingPanel dispatch={dispatch} />}
      {import.meta.env.DEV && <button className="debug-toggle" type="button" aria-expanded={debug} aria-controls="developer-panel" onClick={() => setDebug((value) => !value)}>DEV</button>}
      {import.meta.env.DEV && debug && DeveloperPanel && <Suspense fallback={<p className="debug-loading">Загрузка Developer Mode…</p>}><DeveloperPanel state={state} dispatch={dispatch} reducedMotion={reducedMotion} /></Suspense>}
    </main>
  )
}
