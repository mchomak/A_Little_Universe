import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, type Points, type ShaderMaterial } from 'three'
import photoUrl from '../assets/start_img.jpg'
import matteUrl from '../assets/start_img.matte.png'
import { createLilyDissolveUniforms, createLilyParticleMaterial, updateLilyPortraitAppearance, type LilyDissolveUniforms } from '../scenes/lily/dissolve'
import { sampleStarPortraitTargets, type StarPortraitPoint, type StarPortraitSource } from '../scenes/lily/starPortraitTargets'
import {
  copyParticlePortraitSettings,
  DEFAULT_PARTICLE_PORTRAIT_SETTINGS,
  loadParticlePortraitSettings,
  saveParticlePortraitSettings,
  serializeParticlePortraitSettings,
  setParticlePortraitSetting,
  type ParticlePortraitSettingKey,
  type ParticlePortraitSettings,
} from './config'
import './particle-portrait-lab.css'

const FRAME_ASPECT = 4 / 3
const CAMERA_DISTANCE = 5.6
const CAMERA_FOV = 38
const FRAME_WORLD_HEIGHT = 2 * CAMERA_DISTANCE * Math.tan(CAMERA_FOV * Math.PI / 360)
const FRAME_WORLD_WIDTH = FRAME_WORLD_HEIGHT * FRAME_ASPECT

type SourceImage = StarPortraitSource & { photoUrl: string }
type ViewMode = 'particles' | 'photo'

function readPixels(image: HTMLImageElement, width = image.naturalWidth, height = image.naturalHeight) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Не удалось прочитать изображение в браузере.')
  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height).data
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось загрузить исходное фото или маску.'))
    image.src = src
  })
}

async function loadPortraitSource(): Promise<SourceImage> {
  const [photo, matte] = await Promise.all([loadImage(photoUrl), loadImage(matteUrl)])
  const width = photo.naturalWidth
  const height = photo.naturalHeight
  if (!width || !height || !matte.naturalWidth || !matte.naturalHeight) throw new Error('Фото или маска пусты.')
  return {
    width,
    height,
    photoRgba: readPixels(photo),
    matteRgba: readPixels(matte, width, height),
    photoUrl,
  }
}

function createPortraitGeometry(points: readonly StarPortraitPoint[], imageAspect: number) {
  const geometry = new BufferGeometry()
  const fitWidth = imageAspect <= FRAME_ASPECT ? FRAME_WORLD_HEIGHT * imageAspect : FRAME_WORLD_WIDTH
  const fitHeight = fitWidth / imageAspect
  const positions = new Float32Array(points.length * 3)
  const parts = new Float32Array(points.length)
  const seeds = new Float32Array(points.length)
  const targets = new Float32Array(points.length * 4)
  const motion = new Float32Array(points.length * 4)
  const colors = new Float32Array(points.length * 3)

  points.forEach((point, index) => {
    const x = (point.u - 0.5) * fitWidth
    const y = (0.5 - point.v) * fitHeight
    const positionOffset = index * 3
    const vectorOffset = index * 4
    positions.set([x, y, 0], positionOffset)
    targets.set([x, y, 0, 0], vectorOffset)
    motion.set([0, 0.05, point.tone, 1 + point.contrast], vectorOffset)
    seeds[index] = point.seed
    colors.set(point.photoColorLinear, positionOffset)
  })

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPart', new BufferAttribute(parts, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aPortraitTarget', new BufferAttribute(targets, 4))
  geometry.setAttribute('aPortraitMotion', new BufferAttribute(motion, 4))
  geometry.setAttribute('aPortraitSourceColor', new BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function PortraitPoints({ points, source, settings }: { points: readonly StarPortraitPoint[]; source: SourceImage; settings: ParticlePortraitSettings }) {
  const pointsRef = useRef<Points | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const dpr = useThree((state) => state.viewport.dpr)
  const material = useMemo(() => createLilyParticleMaterial(createLilyDissolveUniforms()), [])
  const geometry = useMemo(() => createPortraitGeometry(points, source.width / source.height), [points, source.height, source.width])
  const offsetX = settings.offsetX * FRAME_WORLD_WIDTH
  const offsetY = -settings.offsetY * FRAME_WORLD_HEIGHT

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const liveMaterial = pointsRef.current?.material as ShaderMaterial | undefined
    if (!liveMaterial) return
    const uniforms = liveMaterial.uniforms as unknown as LilyDissolveUniforms
    updateLilyPortraitAppearance(uniforms, {
      photoColorMix: settings.photoColorMix,
      opacity: settings.opacity,
      glow: settings.glow,
      minSize: settings.minSize,
      maxSize: settings.maxSize,
    })
    uniforms.uLilyPortraitBrightness.value = settings.brightness
    uniforms.uLilyPortraitSize.value = 1
    uniforms.uLilyPortraitStart.value = 0
    uniforms.uLilyPortraitDuration.value = 1
    uniforms.uLilySceneTime.value = 100
    uniforms.uLilyParticleBrightness.value = 1
    uniforms.uLilySize.value = 1
    uniforms.uLilyDpr.value = dpr
  })

  useLayoutEffect(() => {
    invalidate()
  }, [dpr, invalidate, settings.brightness, settings.glow, settings.maxSize, settings.minSize, settings.opacity, settings.photoColorMix])

  return (
    <group position={[offsetX, offsetY, 0]} scale={settings.scale}>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}

type RangeControlProps = {
  label: string
  setting: ParticlePortraitSettingKey
  settings: ParticlePortraitSettings
  min: number
  max: number
  step: number
  onChange: (setting: ParticlePortraitSettingKey, value: number) => void
}

function RangeControl({ label, setting, settings, min, max, step, onChange }: RangeControlProps) {
  const value = settings[setting]
  const display = setting === 'count' ? Math.round(value).toLocaleString('ru-RU') : value.toFixed(2)
  return (
    <label className="ppl-control">
      <span>{label}<output>{display}</output></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(setting, Number(event.target.value))} />
    </label>
  )
}

const initialSettingsState = loadParticlePortraitSettings()

export function ParticlePortraitLab() {
  const [settings, setSettings] = useState<ParticlePortraitSettings>(() => ({ ...initialSettingsState.settings }))
  const settingsRef = useRef(settings)
  const [storageAvailable, setStorageAvailable] = useState(initialSettingsState.storageAvailable)
  const [invalidStoredValue, setInvalidStoredValue] = useState(initialSettingsState.invalidStoredValue)
  const [source, setSource] = useState<SourceImage | null>(null)
  const [sourceError, setSourceError] = useState('')
  const [mode, setMode] = useState<ViewMode>('particles')
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 850px) and (orientation: landscape)').matches)
  const [webglError, setWebglError] = useState('')
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [fallbackJson, setFallbackJson] = useState('')
  const [copying, setCopying] = useState(false)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    void loadPortraitSource().then((loaded) => {
      if (active) setSource(loaded)
    }).catch((error: unknown) => {
      if (active) setSourceError(error instanceof Error ? error.message : 'Предпросмотр фото недоступен.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!canvasElement) return
    const onContextLost = (event: Event) => {
      event.preventDefault()
      setWebglError('WebGL-контекст потерян. Предпросмотр недоступен; настройки и обычная навигация остаются доступны.')
    }
    canvasElement.addEventListener('webglcontextlost', onContextLost)
    return () => canvasElement.removeEventListener('webglcontextlost', onContextLost)
  }, [canvasElement])

  const sampling = useMemo(() => {
    if (!source) return { points: [] as StarPortraitPoint[], error: '' }
    try {
      return {
        points: sampleStarPortraitTargets(source, {
          count: settings.count,
          detailBoost: settings.detailBoost,
          fillDensity: settings.fillDensity,
          contrast: settings.contrast,
          backgroundThreshold: settings.backgroundThreshold,
          irregularity: settings.irregularity,
        }),
        error: '',
      }
    } catch (error) {
      return { points: [] as StarPortraitPoint[], error: error instanceof Error ? error.message : 'Не удалось создать выборку портрета.' }
    }
  }, [settings.backgroundThreshold, settings.contrast, settings.count, settings.detailBoost, settings.fillDensity, settings.irregularity, source])

  const samplingError = sampling.error

  const commitSettings = useCallback((next: ParticlePortraitSettings) => {
    settingsRef.current = next
    setSettings(next)
    setStorageAvailable(saveParticlePortraitSettings(next))
  }, [])

  const update = useCallback((setting: ParticlePortraitSettingKey, value: number) => {
    commitSettings(setParticlePortraitSetting(settingsRef.current, setting, value))
    setInvalidStoredValue(false)
    setCopyMessage('')
    setFallbackJson('')
  }, [commitSettings])

  const reset = useCallback(() => {
    commitSettings({ ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS })
    setInvalidStoredValue(false)
    setCopyMessage('Параметры по умолчанию восстановлены.')
    setFallbackJson('')
  }, [commitSettings])

  const copySettings = useCallback(async () => {
    setCopying(true)
    const result = await copyParticlePortraitSettings(settings)
    setCopying(false)
    if (result.copied) {
      setCopyMessage('JSON скопирован в буфер обмена.')
      setFallbackJson('')
    } else {
      setCopyMessage('Буфер обмена недоступен. Выделите JSON ниже и скопируйте вручную.')
      setFallbackJson(result.json)
      queueMicrotask(() => fallbackRef.current?.focus())
    }
  }, [settings])

  const imageTransform = `translate(${settings.offsetX * 100}%, ${settings.offsetY * 100}%) scale(${settings.scale})`
  const unavailable = sourceError || samplingError || webglError

  return (
    <div className="particle-portrait-lab">
      <header className="ppl-topbar">
        <a className="ppl-back" href="/" aria-label="Вернуться к фильму">← К фильму</a>
        <div className="ppl-title"><span className="ppl-kicker">A LITTLE UNIVERSE / DEV</span><h1>Звёздный портрет</h1></div>
        <div className="ppl-toolbar">
          <div className="ppl-view-switch" role="group" aria-label="Режим предпросмотра">
            <button type="button" aria-pressed={mode === 'particles'} onClick={() => setMode('particles')}>Частицы</button>
            <button type="button" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>Фото</button>
          </div>
          <button className="ppl-panel-toggle" type="button" aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? 'Скрыть параметры' : 'Параметры'}</button>
        </div>
      </header>

      <main className={`ppl-layout${panelOpen ? ' ppl-layout--panel-open' : ''}`}>
        <section className="ppl-stage" aria-label="Предпросмотр портрета">
          <div className="ppl-stage-content">
            <div className="ppl-frame">
              {source && !sourceError && (
                <Canvas
                  className="ppl-canvas"
                  frameloop="demand"
                  dpr={[1, 1.5]}
                  camera={{ position: [0, 0, CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 100 }}
                  gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
                  onCreated={({ gl }) => { setCanvasElement(gl.domElement); setWebglError('') }}
                  fallback={<div className="ppl-unavailable" role="alert">Предпросмотр недоступен: браузер не смог создать WebGL-контекст.</div>}
                >
                  {!webglError && !samplingError && <PortraitPoints points={sampling.points} source={source} settings={settings} />}
                </Canvas>
              )}
              {mode === 'photo' && source && !sourceError && <div className="ppl-photo-layer" style={{ transform: imageTransform }}>
                <img src={source.photoUrl} alt="Оригинальная фотография Василисы" onError={() => setSourceError('Исходное фото недоступно.')} />
              </div>}
              {!source && !sourceError && <div className="ppl-loading" role="status">Загружаю фото и маску…</div>}
              {unavailable && <div className="ppl-unavailable" role="alert">{unavailable}</div>}
            </div>
            <div className="ppl-preview-caption"><span>{mode === 'particles' ? 'СТАТИЧНЫЕ ЧАСТИЦЫ' : 'ИСХОДНОЕ ФОТО'}</span><span>4:3 · {sampling.points.length.toLocaleString('ru-RU')} точек</span></div>
          </div>
        </section>

        {panelOpen && <aside className="ppl-panel" aria-label="Настройки портрета">
          <div className="ppl-panel-heading"><div><span className="ppl-kicker">LOOK DEVELOPMENT</span><h2>Параметры</h2></div><button type="button" className="ppl-reset" onClick={reset}>Сбросить</button></div>
          <details className="ppl-group" open>
            <summary>01 · Частицы</summary><div className="ppl-controls">
              <RangeControl label="Количество" setting="count" settings={settings} min={4_000} max={32_000} step={1_000} onChange={update} />
              <RangeControl label="Минимальный размер" setting="minSize" settings={settings} min={0.4} max={1.6} step={0.05} onChange={update} />
              <RangeControl label="Максимальный размер" setting="maxSize" settings={settings} min={0.8} max={3} step={0.05} onChange={update} />
              <RangeControl label="Яркость" setting="brightness" settings={settings} min={0.2} max={2} step={0.05} onChange={update} />
              <RangeControl label="Прозрачность" setting="opacity" settings={settings} min={0.2} max={1} step={0.01} onChange={update} />
              <RangeControl label="Мягкое свечение" setting="glow" settings={settings} min={0} max={2} step={0.01} onChange={update} />
            </div>
          </details>
          <details className="ppl-group" open>
            <summary>02 · Детализация</summary><div className="ppl-controls">
              <RangeControl label="Усиление деталей" setting="detailBoost" settings={settings} min={0.5} max={2} step={0.01} onChange={update} />
              <RangeControl label="Заполнение полутонов" setting="fillDensity" settings={settings} min={0.3} max={2} step={0.01} onChange={update} />
              <RangeControl label="Контраст" setting="contrast" settings={settings} min={0.5} max={1.8} step={0.01} onChange={update} />
              <RangeControl label="Порог фона" setting="backgroundThreshold" settings={settings} min={0.05} max={0.4} step={0.01} onChange={update} />
              <RangeControl label="Нерегулярность" setting="irregularity" settings={settings} min={0} max={1} step={0.01} onChange={update} />
            </div>
          </details>
          <details className="ppl-group">
            <summary>03 · Цвет</summary><div className="ppl-controls">
              <RangeControl label="Цвет фото ↔ палитра" setting="photoColorMix" settings={settings} min={0} max={1} step={0.01} onChange={update} />
              <p className="ppl-hint">Жемчужный, мягкий розовый и приглушённый золотой.</p>
            </div>
          </details>
          <details className="ppl-group">
            <summary>04 · Композиция</summary><div className="ppl-controls">
              <RangeControl label="Масштаб" setting="scale" settings={settings} min={0.6} max={1.2} step={0.01} onChange={update} />
              <RangeControl label="Положение X" setting="offsetX" settings={settings} min={-0.5} max={0.5} step={0.01} onChange={update} />
              <RangeControl label="Положение Y" setting="offsetY" settings={settings} min={-0.5} max={0.5} step={0.01} onChange={update} />
            </div>
          </details>
          <div className="ppl-export">
            <button type="button" className="ppl-copy" onClick={() => void copySettings()} disabled={copying}>{copying ? 'Копирую…' : 'Копировать настройки'}</button>
            <div className="ppl-messages" aria-live="polite">
              {!storageAvailable && <p role="status">Хранилище недоступно: настройки сохраняются только до закрытия вкладки.</p>}
              {invalidStoredValue && <p role="status">Сохранённые параметры повреждены; применены значения по умолчанию.</p>}
              {copyMessage && <p role="status">{copyMessage}</p>}
            </div>
            {fallbackJson && <textarea ref={fallbackRef} className="ppl-json-fallback" aria-label="JSON настроек для ручного копирования" readOnly value={fallbackJson} onFocus={(event) => event.currentTarget.select()} />}
            <span className="ppl-schema">JSON · schema v1 · {serializeParticlePortraitSettings(settings).length.toLocaleString('ru-RU')} знаков</span>
          </div>
        </aside>}
      </main>
    </div>
  )
}
