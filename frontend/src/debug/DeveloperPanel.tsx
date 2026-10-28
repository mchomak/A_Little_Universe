import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type Dispatch, type ReactNode } from 'react'
import type { FilmAction, FilmState } from '../engine/film'
import { MEMORIES, SCENES, SCENE_ORDER, type SceneId } from '../engine/filmConfig'
import {
  DEFAULT_SCENE_COMPOSER_CONFIG,
  SCENE_CONFIG_PRESETS,
  getConfig,
  subscribeConfig,
  type QualityProfile,
  type SceneComposerConfig,
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

type NumericControl = {
  path: ComposerFieldPath
  label: string
  unit: string
  min: number
  max: number
  step: number
  displayScale?: number
}

type ComposerSectionId = 'global' | 'preload' | 'preparation' | 'prologue'

const PRELOAD_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.preload.glow', label: 'Свечение', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.preload.particleCount', label: 'Частицы', unit: 'шт.', min: 40, max: 300, step: 1 },
  { path: 'scenes.preload.movementSpeed', label: 'Скорость движения', unit: '×', min: 0.1, max: 4, step: 0.1 },
  { path: 'scenes.preload.collapseDuration', label: 'Длительность схлопывания', unit: 'с', min: 0, max: 4, step: 0.1 },
]

const PREPARATION_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.preparation.spacing', label: 'Отступы карточек', unit: 'px', min: 0, max: 64, step: 1 },
  { path: 'scenes.preparation.entranceDuration', label: 'Появление интерфейса', unit: 'с', min: 0, max: 5, step: 0.1 },
  { path: 'scenes.preparation.typeScale', label: 'Масштаб заголовка', unit: '%', min: 90, max: 110, step: 5, displayScale: 100 },
  { path: 'scenes.preparation.lineHeight', label: 'Межстрочный интервал заголовка', unit: '×', min: 0.9, max: 1.5, step: 0.01 },
  { path: 'scenes.preparation.cardOpacity', label: 'Непрозрачность поверхности', unit: '%', min: 85, max: 100, step: 1, displayScale: 100 },
]

const PROLOGUE_CONTROLS: readonly NumericControl[] = [
  { path: 'scenes.prologue.fontSize', label: 'Размер шрифта', unit: 'px', min: 16, max: 160, step: 1 },
  { path: 'scenes.prologue.lineHeight', label: 'Высота строки', unit: '×', min: 0.8, max: 2.5, step: 0.05 },
  { path: 'scenes.prologue.positionY', label: 'Положение текста', unit: '%', min: 10, max: 80, step: 1 },
  { path: 'scenes.prologue.handwritingDuration', label: 'Рукописное появление', unit: 'с', min: 0.5, max: 20, step: 0.1 },
  { path: 'scenes.prologue.promptHandwritingDuration', label: 'Рукописное появление подсказки', unit: 'с', min: 0.2, max: 0.8, step: 0.05 },
  { path: 'scenes.prologue.handwritingRhythm', label: 'Ритм письма', unit: '×', min: 0.1, max: 3, step: 0.1 },
  { path: 'scenes.prologue.interphraseInterval', label: 'Пауза между фразами', unit: 'с', min: 0, max: 8, step: 0.1 },
  { path: 'scenes.prologue.readableHold', label: 'Время на чтение', unit: 'с', min: 0, max: 30, step: 0.1 },
  { path: 'scenes.prologue.particleCount', label: 'Частицы пепла', unit: 'шт.', min: 300, max: 6000, step: 1 },
  { path: 'scenes.prologue.windStrength', label: 'Ветер', unit: '×', min: 0.2, max: 3, step: 0.05 },
  { path: 'scenes.prologue.turbulence', label: 'Турбулентность', unit: '×', min: 0, max: 1, step: 0.05 },
  { path: 'scenes.prologue.fractureWidth', label: 'Ширина фронта', unit: '%', min: 0, max: 18, step: 1, displayScale: 100 },
  { path: 'scenes.prologue.fractureDuration', label: 'Длительность фронта', unit: 'с', min: 0.8, max: 4, step: 0.1 },
  { path: 'scenes.prologue.particleDuration', label: 'Длительность движения частиц', unit: 'с', min: 0.1, max: 20, step: 0.1 },
  { path: 'scenes.prologue.particleFadeDuration', label: 'Длительность затухания пепла', unit: 'с', min: 0.5, max: 4, step: 0.1 },
  { path: 'scenes.prologue.glow', label: 'Свечение', unit: '×', min: 0, max: 2, step: 0.05 },
  { path: 'scenes.prologue.pulseAmplitude', label: 'Амплитуда пульсации', unit: '×', min: 0, max: 1, step: 0.01 },
  { path: 'scenes.prologue.pulseFrequency', label: 'Частота пульсации', unit: 'Гц', min: 0, max: 5, step: 0.1 },
  { path: 'scenes.prologue.seed', label: 'Seed частиц', unit: '', min: 0, max: 2_147_483_647, step: 1 },
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

function RangeControl({ control, value, onChange, onReset }: {
  control: NumericControl
  value: number
  onChange(value: number): void
  onReset(): void
}) {
  const id = `composer-${control.path.replaceAll('.', '-')}`
  return (
    <div className="composer-control">
      <label htmlFor={id}>{control.label} · {formatted(value)} {control.unit}</label>
      <input id={id} data-testid={id} type="range" min={control.min} max={control.max} step={control.step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>Допустимый диапазон: {formatted(control.min)}–{formatted(control.max)} {control.unit}</small>
      <button type="button" onClick={onReset}>Сбросить параметр</button>
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
  return <RangeControl control={control} value={typeof value === 'number' ? value * scale : control.min} onChange={(next) => onChange(control.path, next / scale)} onReset={() => onReset(control.path)} />
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
      <label htmlFor={id}>{label}</label>
      <select id={id} data-testid={id} value={value} onChange={(event) => onChange(path, event.target.value as ArtFontId)}>
        {ART_FONT_CATALOG.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
      </select>
      <button type="button" onClick={() => onReset(path)}>Сбросить параметр</button>
    </div>
  )
}

function ComposerSection({ sectionId, title, open, onToggle, children }: {
  sectionId: ComposerSectionId
  title: string
  open: boolean
  onToggle(sectionId: string, open: boolean): void
  children: ReactNode
}) {
  return <details open={open} onToggle={(event) => onToggle(sectionId, event.currentTarget.open)}><summary>{title}</summary>{children}</details>
}

export default function DeveloperPanel({ state, dispatch, reducedMotion, onPreload, onPermissions }: {
  state: FilmState
  dispatch: Dispatch<FilmAction>
  reducedMotion: boolean
  onPreload(): void
  onPermissions(): void
}) {
  const [selected, setSelected] = useState<SceneId>(state.scene)
  const [selectedPreset, setSelectedPreset] = useState<ScenePresetId>(() => getConfig().preset)
  const [notice, setNotice] = useState('')
  const [fontLoading, setFontLoading] = useState(false)
  const fontRequest = useRef(0)
  const [openSections, setOpenSections] = useState<Record<ComposerSectionId, boolean>>(() => ({
    global: true,
    preload: state.scene === 'prologue',
    preparation: false,
    prologue: state.scene === 'prologue',
  }))
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const fps = useApproximateRafFps()
  const duration = SCENES[state.scene].duration
  const canInteract = state.mode === 'waiting' && (state.scene === 'bloom' || state.scene === 'prologue')
  const canSeek = duration > 0 && !(state.scene === 'bloom' && state.mode === 'waiting')

  const syncFilmGlobals = (next: SceneComposerConfig) => {
    dispatch({ type: 'set-speed', speed: next.global.playbackSpeed })
    dispatch({ type: 'set-quality', quality: next.global.quality })
  }

  const changeField = async (path: ComposerFieldPath, value: unknown) => {
    const isFont = path === 'scenes.preparation.fontFamily' || path === 'scenes.prologue.fontFamily'
    const requestId = isFont ? ++fontRequest.current : 0
    if (isFont) setFontLoading(true)
    setNotice('')
    try {
      const next = await setComposerField(path, value)
      if (path === 'global.playbackSpeed') dispatch({ type: 'set-speed', speed: Number(value) })
      if (path === 'global.quality') dispatch({ type: 'set-quality', quality: value as QualityProfile })
      if (isFont) {
        const fontPath = path.endsWith('preparation.fontFamily') ? next.scenes.preparation.fontFamily : next.scenes.prologue.fontFamily
        if (fontPath !== value) setNotice('Шрифт не загрузился; сохранён прежний.')
      }
    } catch {
      setNotice('Не удалось применить настройку. Текущее значение сохранено.')
    } finally {
      if (isFont && requestId === fontRequest.current) setFontLoading(false)
    }
  }

  const resetField = async (path: ComposerFieldPath) => changeField(path, defaultAtPath(path))

  const resetScope = async (scope: 'global' | 'preload' | 'preparation' | 'prologue') => {
    const result = await resetComposerScope(scope)
    if (!result.ok) {
      setNotice('Шрифт не загрузился; сброс не применён. Текущие настройки сохранены.')
      return
    }
    const next = result.config
    if (scope === 'global') syncFilmGlobals(next)
    setNotice('Параметры сброшены.')
  }

  const applyPreset = async () => {
    const next = await applyComposerPreset(selectedPreset)
    setSelectedPreset(next.preset)
    setNotice(`Применён пресет «${SCENE_CONFIG_PRESETS[next.preset].label}».`)
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
          version: 'Поддерживаются schemaVersion 1 и 2. Текущие настройки сохранены.',
          font: 'Шрифт не загрузился; настройки из JSON не применены. Текущие настройки сохранены.',
        }
        setNotice(errors[result.reason])
        return
      }
      syncFilmGlobals(result.config)
      setSelectedPreset(result.config.preset)
      setNotice('Настройки из JSON применены.')
    } catch {
      setNotice('Не удалось прочитать файл. Текущие настройки сохранены.')
    }
  }

  const launchSelected = () => dispatch({ type: 'dev-jump', scene: selected })
  const restartSelected = () => dispatch(selected === state.scene ? { type: 'dev-restart' } : { type: 'dev-jump', scene: selected })
  const toggleSection = (sectionId: ComposerSectionId, open: boolean) => setOpenSections((current) => ({ ...current, [sectionId]: open }))

  return (
    <aside id="developer-panel" className="developer-panel" aria-labelledby="developer-title">
      <h2 id="developer-title">Scene Composer</h2>
      <p>Настройки 00, 00.1 и 01 используют общее время фильма. Для сцен 02–09 доступны только воспроизведение и переход.</p>
      <div className="dev-actions">
        <button type="button" data-testid="dev-preload" onClick={onPreload}>00 · Проверить загрузку</button>
        <button type="button" data-testid="dev-permissions" onClick={onPermissions}>00.1 · Настройки заново</button>
      </div>
      {fontLoading && <p role="status">Загружаем локальный шрифт…</p>}
      {notice && <p role="status" aria-live="polite">{notice}</p>}

      <ComposerSection sectionId="global" title="Global · общие параметры" open={openSections.global} onToggle={toggleSection}>
        <label>Профиль качества
          <select aria-label="Профиль качества" value={config.global.quality} onChange={(event) => { void changeField('global.quality', event.target.value) }}>
            <option value="standard">Обычное</option><option value="low">Низкое</option>
          </select>
        </label>
        <button type="button" onClick={() => { void resetField('global.quality') }}>Сбросить параметр</button>
        <RangeControl control={{ path: 'global.playbackSpeed', label: 'Скорость фильма', unit: '×', min: 0.25, max: 4, step: 0.25 }} value={state.speed} onChange={(value) => { void changeField('global.playbackSpeed', value) }} onReset={() => { void resetField('global.playbackSpeed') }} />
        <ConfigRange control={{ path: 'global.dprMin', label: 'Минимум DPR', unit: '×', min: 0.5, max: 1.5, step: 0.05 }} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
        <ConfigRange control={{ path: 'global.dprMax', label: 'Максимум DPR', unit: '×', min: 1, max: 2, step: 0.05 }} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
        <div className="composer-presets">
          <label htmlFor="composer-preset">Художественный пресет</label>
          <select id="composer-preset" data-testid="composer-preset" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as ScenePresetId)}>
            {Object.entries(SCENE_CONFIG_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select>
          <p>Сравнение: Moonlit Letter — мягкое свечение, 1 800 частиц; Stardust — яркое свечение, 2 600 частиц.</p>
          <button type="button" onClick={() => { void applyPreset() }}>Применить пресет</button>
        </div>
        <div className="composer-files">
          <button type="button" onClick={downloadConfig}>Экспорт JSON</button>
          <label>Импорт JSON
            <input data-testid="composer-import" type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event) }} />
          </label>
        </div>
        <button type="button" onClick={() => { void resetScope('global') }}>Сбросить Global</button>
      </ComposerSection>

      <ComposerSection sectionId="preload" title="00 · Загрузка" open={openSections.preload} onToggle={toggleSection}>
        {PRELOAD_CONTROLS.map((control) => <ConfigRange key={control.path} control={control} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />)}
        <button type="button" onClick={() => { void resetScope('preload') }}>Сбросить параметры 00</button>
      </ComposerSection>

      <ComposerSection sectionId="preparation" title="00.1 · Подготовка" open={openSections.preparation} onToggle={toggleSection}>
        <FontControl path="scenes.preparation.fontFamily" label="Художественный шрифт" value={config.scenes.preparation.fontFamily} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
        {PREPARATION_CONTROLS.map((control) => <ConfigRange key={control.path} control={control} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />)}
        <button type="button" onClick={() => { void resetScope('preparation') }}>Сбросить параметры 00.1</button>
      </ComposerSection>

      <ComposerSection sectionId="prologue" title="01 · Пролог" open={openSections.prologue} onToggle={toggleSection}>
        <FontControl path="scenes.prologue.fontFamily" label="Шрифт рукописного текста" value={config.scenes.prologue.fontFamily} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />
        {PROLOGUE_CONTROLS.map((control) => <ConfigRange key={control.path} control={control} config={config} onChange={(path, value) => { void changeField(path, value) }} onReset={(path) => { void resetField(path) }} />)}
        <button type="button" onClick={() => { void resetScope('prologue') }}>Сбросить параметры 01</button>
      </ComposerSection>

      <section aria-labelledby="dev-playback-title">
        <h3 id="dev-playback-title">Воспроизведение</h3>
        <label htmlFor="dev-scene">Сцена</label>
        <select id="dev-scene" data-testid="dev-scene" value={selected} onChange={(event) => setSelected(event.target.value as SceneId)}>
          {SCENE_ORDER.map((scene) => <option key={scene} value={scene}>{SCENES[scene].label}</option>)}
        </select>
        <div className="dev-actions">
          <button type="button" data-testid="dev-run" onClick={launchSelected}>Запустить сцену</button>
          <button type="button" data-testid="dev-restart" onClick={restartSelected}>Перезапустить выбранную</button>
        </div>
        <div className="dev-actions">
          <button type="button" aria-pressed={state.paused} onClick={() => dispatch({ type: 'toggle-pause' })}>{state.paused ? 'Продолжить' : 'Пауза'}</button>
          <button type="button" disabled={state.scene === 'ending'} onClick={() => dispatch({ type: 'dev-skip' })}>Пропустить сцену</button>
        </div>
        <label htmlFor="dev-seek">Время · {state.elapsed.toFixed(1)} / {duration} с</label>
        <input id="dev-seek" data-testid="dev-seek" aria-label="Время сцены" type="range" min="0" max={duration || 1} step="0.1" value={state.elapsed} disabled={!canSeek} onChange={(event) => dispatch({ type: 'dev-seek', time: Number(event.target.value) })} />
        <button type="button" disabled={!canInteract} onClick={() => dispatch({ type: 'interact' })}>Имитировать прикосновение</button>
        <div className="dev-actions">
          <button type="button" disabled={state.scene !== 'gallery' || state.galleryIndex === 0} onClick={() => dispatch({ type: 'gallery-step', direction: -1 })}>Фото назад</button>
          <button type="button" disabled={state.scene !== 'gallery' || state.galleryIndex === MEMORIES.length - 1} onClick={() => dispatch({ type: 'gallery-step', direction: 1 })}>Фото вперёд</button>
        </div>
      </section>

      <dl>
        <dt>Сцена / режим</dt><dd>{state.scene} / {state.mode}</dd>
        <dt>Пауза / чтение</dt><dd>{String(state.paused)} / {String(state.reading)}</dd>
        <dt>Revision / карточка</dt><dd>{state.revision} / {state.galleryIndex + 1}</dd>
        <dt>Качество / движение</dt><dd>{state.quality} / {config.global.quality} / {reducedMotion ? 'reduced' : 'normal'}</dd>
        <dt>Примерный rAF FPS</dt><dd>{fps ?? 'измеряется…'}</dd>
      </dl>
      <p>rAF FPS — частота кадров браузера, не WebGL. Физический планшет не тестировался.</p>
    </aside>
  )
}
