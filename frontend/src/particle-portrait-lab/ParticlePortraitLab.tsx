import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, type Points, type ShaderMaterial } from 'three'
import photoUrl from '../assets/start_img.jpg'
import matteUrl from '../assets/start_img.matte.png'
import { createLilyDissolveUniforms, createLilyParticleMaterial, updateLilyPortraitAppearance, type LilyDissolveUniforms } from '../scenes/lily/dissolve'
import type { StarPortraitPoint, StarPortraitSource } from '../scenes/lily/starPortraitTargets'
import { createNeutralImportanceMask, NEUTRAL_IMPORTANCE, paintImportanceMask } from './importanceMask'
import { type HybridPoint, type Stroke } from './hybridPortrait'
import { DEFAULT_PARTICLE_PROFILES, DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, type ParticleKind, type ParticleProfile, type PortraitStructureSettings } from './particleProfiles'
import { parsePortraitProject, serializePortraitProject } from './projectFormat'
import { MAX_PORTRAIT_ZOOM, zoomPortraitViewportAt } from './viewport'
import { canExportPoints, canExportPreview } from './exportAvailability'
import { createScene04PortraitPointExport } from './pointExport'
import {
  copyParticlePortraitSettings,
  DEFAULT_PARTICLE_PORTRAIT_SETTINGS,
  loadParticlePortraitSettings,
  parseParticlePortraitSettings,
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
const SAMPLING_SETTING_KEYS: readonly ParticlePortraitSettingKey[] = [
  'count', 'detailBoost', 'fillDensity', 'contrast', 'backgroundThreshold', 'irregularity', 'seed',
]

type SourceImage = StarPortraitSource & { photoUrl: string }
type EditorTool = 'density' | 'suppression' | 'contour' | 'flow'
type EditorSnapshot = {
  density: Uint8Array; suppression: Uint8Array; strokes: Stroke[]
  settings: ParticlePortraitSettings; profiles: typeof DEFAULT_PARTICLE_PROFILES
  structure: PortraitStructureSettings
  editor: { maskOpacity: number; brushSize: number; brushSoftness: number; brushIntensity: number; brushValue: number; strokeSpacing: number; strokeWidth: number; strokeJitter: number; strokeBrightness: number; strokeSmooth: number; strokeSize: number }
}
type ViewMode = 'compare' | 'particles' | 'photo' | 'mask'

type SamplingState = { points: HybridPoint[]; status: 'loading' | 'ready' | 'error'; error: string }

type SampleWorkerResponse =
  | { kind: 'ready' }
  | { kind: 'result'; id: number; points: HybridPoint[] }
  | { kind: 'failure'; id: number; error: string }

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

function containRect(width: number, height: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / width, boxHeight / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  return { x: (boxWidth - drawWidth) / 2, y: (boxHeight - drawHeight) / 2, width: drawWidth, height: drawHeight }
}

function drawImportanceOverlay(canvas: HTMLCanvasElement, density: Uint8Array, suppression: Uint8Array, width: number, height: number, opacity: number, showDensity: boolean, showSuppression: boolean) {
  // Layout dimensions exclude the CSS zoom; the backing store must not grow 100-fold at 1000% zoom.
  const boxWidth = canvas.clientWidth, boxHeight = canvas.clientHeight
  if (!boxWidth || !boxHeight) return
  const rect = containRect(width, height, boxWidth, boxHeight)
  const dpr = Math.min(4, Math.max(window.devicePixelRatio || 1, width / rect.width, height / rect.height))
  canvas.width = Math.round(boxWidth * dpr)
  canvas.height = Math.round(boxHeight * dpr)
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, boxWidth, boxHeight)
  const pixels = new Uint8ClampedArray(width * height * 4)
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) return
  context.globalAlpha = opacity
  context.imageSmoothingEnabled = false
  if (showDensity) {
    for (let index = 0; index < density.length; index += 1) {
      const offset = index * 4, value = density[index]!
      pixels[offset] = value; pixels[offset + 1] = value; pixels[offset + 2] = value; pixels[offset + 3] = 255
    }
    maskContext.putImageData(new ImageData(pixels, width, height), 0, 0)
    context.drawImage(maskCanvas, rect.x, rect.y, rect.width, rect.height)
  }
  if (showSuppression) {
    for (let index = 0; index < suppression.length; index += 1) {
      const offset = index * 4
      pixels[offset] = 255; pixels[offset + 1] = 80; pixels[offset + 2] = 110; pixels[offset + 3] = suppression[index]!
    }
    maskContext.putImageData(new ImageData(pixels, width, height), 0, 0)
    context.drawImage(maskCanvas, rect.x, rect.y, rect.width, rect.height)
  }
  context.globalAlpha = 1
}

function createGrayMaskPng(mask: Uint8Array, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Не удалось создать PNG маски.'))
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    const value = mask[index]!
    pixels[offset] = value
    pixels[offset + 1] = value
    pixels[offset + 2] = value
    pixels[offset + 3] = 255
  }
  context.putImageData(new ImageData(pixels, width, height), 0, 0)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Браузер не сохранил PNG маски.')), 'image/png'))
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function maskFromImageData(data: ImageData, width: number, height: number) {
  const mask = new Uint8Array(width * height)
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    mask[index] = Math.round(data.data[offset]! * 0.2126 + data.data[offset + 1]! * 0.7152 + data.data[offset + 2]! * 0.0722)
  }
  return mask
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
  const artSize = new Float32Array(points.length)
  const artBrightness = new Float32Array(points.length)

  points.forEach((point, index) => {
    const x = (point.u - 0.5) * fitWidth
    const y = (0.5 - point.v) * fitHeight
    const positionOffset = index * 3
    const vectorOffset = index * 4
    positions.set([x, y, 0], positionOffset)
    targets.set([x, y, 0, 0], vectorOffset)
    motion.set([0, 0.05, point.tone, 1 + point.contrast], vectorOffset)
    seeds[index] = point.seed
    const art = point as StarPortraitPoint & { artSize?: number; artBrightness?: number }
    artSize[index] = art.artSize ?? 1
    artBrightness[index] = art.artBrightness ?? 1
    colors.set(point.photoColorLinear, positionOffset)
  })

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPart', new BufferAttribute(parts, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aArtSize', new BufferAttribute(artSize, 1))
  geometry.setAttribute('aArtBrightness', new BufferAttribute(artBrightness, 1))
  geometry.setAttribute('aPortraitTarget', new BufferAttribute(targets, 4))
  geometry.setAttribute('aPortraitMotion', new BufferAttribute(motion, 4))
  geometry.setAttribute('aPortraitSourceColor', new BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function PortraitPoints({ points, source, settings, previewRevision, onRendered }: {
  points: readonly StarPortraitPoint[]
  source: SourceImage
  settings: ParticlePortraitSettings
  previewRevision: number
  onRendered: (revision: number) => void
}) {
  const pointsRef = useRef<Points | null>(null)
  const lastRenderedRevisionRef = useRef(-1)
  const invalidate = useThree((state) => state.invalidate)
  const dpr = useThree((state) => state.viewport.dpr)
  const material = useMemo(() => {
    const next = createLilyParticleMaterial(createLilyDissolveUniforms())
    next.vertexShader = next.vertexShader.replace('attribute float aPart;', 'attribute float aArtSize; attribute float aArtBrightness; varying float vArtBrightness; attribute float aPart;')
      .replace('gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize);', 'vArtBrightness = aArtBrightness; gl_PointSize = clamp(pointSize * aArtSize, pointMinSize, pointMaxSize);')
    next.fragmentShader = next.fragmentShader.replace('uniform vec3 uPearl;', 'varying float vArtBrightness; uniform vec3 uPearl;')
      .replace('if (glow < 0.004) discard;', 'glow *= vArtBrightness; if (glow < 0.004) discard;')
    return next
  }, [])
  const geometry = useMemo(() => createPortraitGeometry(points, source.width / source.height), [points, source.height, source.width])
  const offsetX = settings.offsetX * FRAME_WORLD_WIDTH
  const offsetY = -settings.offsetY * FRAME_WORLD_HEIGHT
  const onAfterRender = useCallback(() => {
    if (lastRenderedRevisionRef.current === previewRevision) return
    lastRenderedRevisionRef.current = previewRevision
    onRendered(previewRevision)
  }, [onRendered, previewRevision])

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
      minimumBrightness: settings.minimumBrightness,
      contrast: settings.portraitContrast,
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
  }, [dpr, invalidate, points, settings.brightness, settings.glow, settings.maxSize, settings.minSize, settings.minimumBrightness,
    settings.offsetX, settings.offsetY, settings.opacity, settings.photoColorMix, settings.portraitContrast, settings.scale])

  return (
    <group position={[offsetX, offsetY, 0]} scale={settings.scale}>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} onAfterRender={onAfterRender} />
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
  onInteractionStart?: () => void
}

function RangeControl({ label, setting, settings, min, max, step, onChange, onInteractionStart }: RangeControlProps) {
  const value = settings[setting]
  const display = setting === 'count' ? Math.round(value).toLocaleString('ru-RU') : value.toFixed(2)
  return (
    <label className="ppl-control">
      <span>{label}<output>{display}</output></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onPointerDown={onInteractionStart} onKeyDown={onInteractionStart} onChange={(event) => onChange(setting, Number(event.target.value))} />
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
  const [importanceMask, setImportanceMask] = useState<Uint8Array | null>(null)
  const importanceMaskRef = useRef<Uint8Array | null>(null)
  const [suppressionMask, setSuppressionMask] = useState<Uint8Array | null>(null)
  const suppressionMaskRef = useRef<Uint8Array | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  const [profiles, setProfiles] = useState(() => structuredClone(DEFAULT_PARTICLE_PROFILES))
  const [structure, setStructure] = useState<PortraitStructureSettings>(() => ({ ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS }))
  const [tool, setTool] = useState<EditorTool>('density')
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([])
  const draftRef = useRef<{ x: number; y: number }[]>([])
  const [selectedStroke, setSelectedStroke] = useState('')
  const [strokeSpacing, setStrokeSpacing] = useState(8)
  const [strokeWidth, setStrokeWidth] = useState(8)
  const [strokeJitter, setStrokeJitter] = useState(2)
  const [strokeBrightness, setStrokeBrightness] = useState(1.2)
  const [strokeSmooth, setStrokeSmooth] = useState(.5)
  const [strokeSize, setStrokeSize] = useState(1)
  const [showContour, setShowContour] = useState(true)
  const [showFlow, setShowFlow] = useState(true)
  const [showEdges, setShowEdges] = useState(false)
  const [edgeThreshold, setEdgeThreshold] = useState(35)
  const [showDensity, setShowDensity] = useState(true)
  const [showSuppression, setShowSuppression] = useState(true)
  const [previewLayer, setPreviewLayer] = useState<'final' | 'contour' | 'contour-support' | 'fill'>('final')
  const projectInputRef = useRef<HTMLInputElement>(null)
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workerUnavailableRef = useRef(false)
  const latestRequestRef = useRef(0)
  const immediateSampleRef = useRef(false)
  const undoRef = useRef<EditorSnapshot[]>([])
  const redoRef = useRef<EditorSnapshot[]>([])
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null)
  const [workerStatus, setWorkerStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [sampling, setSampling] = useState<SamplingState>({ points: [], status: 'loading', error: '' })
  const [sampleRevision, setSampleRevision] = useState(0)
  const sampleRevisionRef = useRef(0)
  const [completedSampleRevision, setCompletedSampleRevision] = useState(-1)
  const completedSampleRevisionRef = useRef(-1)
  const [previewRevision, setPreviewRevision] = useState(0)
  const previewRevisionRef = useRef(0)
  const [renderedPreviewRevision, setRenderedPreviewRevision] = useState(-1)
  const renderedPreviewRevisionRef = useRef(-1)
  const [history, setHistory] = useState({ undo: 0, redo: 0 })
  const [maskOpacity, setMaskOpacity] = useState(0.42)
  const [brushSize, setBrushSize] = useState(54)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const photoFrameRef = useRef<HTMLDivElement | null>(null)
  const resultFrameRef = useRef<HTMLDivElement | null>(null)
  const spacePressedRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const [brushSoftness, setBrushSoftness] = useState(0.55)
  const [brushIntensity, setBrushIntensity] = useState(0.8)
  const [brushValue, setBrushValue] = useState(220)
  const [erase, setErase] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const drawingRef = useRef(false)
  const [manualTick, setManualTick] = useState(0)
  const [sourceError, setSourceError] = useState('')
  const [mode, setMode] = useState<ViewMode>('compare')
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 850px) and (orientation: landscape)').matches)
  const [webglError, setWebglError] = useState('')
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [fallbackJson, setFallbackJson] = useState('')
  const [copying, setCopying] = useState(false)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const maskInputRef = useRef<HTMLInputElement>(null)
  const settingsInputRef = useRef<HTMLInputElement>(null)
  const showPhotoPane = mode !== 'particles'
  const showResultPane = mode !== 'photo' && mode !== 'mask'
  const showMaskOverlay = mode === 'compare' || mode === 'mask'
  const edgeOverlay = useMemo(() => {
    if (!source || !showEdges) return ''
    const { width, height, photoRgba } = source
    const gray = new Float32Array(width * height)
    const blur = new Float32Array(gray.length)
    for (let i = 0; i < gray.length; i++) gray[i] = photoRgba[i * 4]! * .2126 + photoRgba[i * 4 + 1]! * .7152 + photoRgba[i * 4 + 2]! * .0722
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      let sum = 0
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += gray[(y + j) * width + x + i]!
      blur[y * width + x] = sum / 9
    }
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const i = y * width + x
      const strength = Math.hypot(blur[i + 1]! - blur[i - 1]!, blur[i + width]! - blur[i - width]!)
      if (strength > edgeThreshold) { pixels[i * 4] = 255; pixels[i * 4 + 1] = 200; pixels[i * 4 + 2] = 80; pixels[i * 4 + 3] = 180 }
    }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    canvas.getContext('2d')?.putImageData(new ImageData(pixels, width, height), 0, 0)
    return canvas.toDataURL()
  }, [edgeThreshold, showEdges, source])
  const samplingSettings = useMemo(() => ({
    count: settings.count, detailBoost: settings.detailBoost, fillDensity: settings.fillDensity,
    contrast: settings.contrast, backgroundThreshold: settings.backgroundThreshold,
    irregularity: settings.irregularity, seed: settings.seed,
  }), [settings.backgroundThreshold, settings.contrast, settings.count, settings.detailBoost, settings.fillDensity, settings.irregularity, settings.seed])

  const advanceSampleRevision = useCallback(() => {
    const next = sampleRevisionRef.current + 1
    sampleRevisionRef.current = next
    setSampleRevision(next)
  }, [])

  const advancePreviewRevision = useCallback(() => {
    const next = previewRevisionRef.current + 1
    previewRevisionRef.current = next
    setPreviewRevision(next)
  }, [])

  const markPreviewRendered = useCallback((revision: number) => {
    if (revision !== previewRevisionRef.current) return
    renderedPreviewRevisionRef.current = revision
    setRenderedPreviewRevision(revision)
  }, [])

  const samplingIsCurrent = canExportPoints({
    status: sampling.status,
    revision: sampleRevision,
    completedRevision: completedSampleRevision,
    drawing,
  })

  useEffect(() => {
    let active = true
    void loadPortraitSource().then((loaded) => {
      if (active) {
        const neutralMask = createNeutralImportanceMask(loaded.width, loaded.height)
        importanceMaskRef.current = neutralMask
        suppressionMaskRef.current = new Uint8Array(loaded.width * loaded.height)
        setSuppressionMask(suppressionMaskRef.current)
        setImportanceMask(neutralMask)
        setSource(loaded)
      }
    }).catch((error: unknown) => {
      if (active) setSourceError(error instanceof Error ? error.message : 'Предпросмотр фото недоступен.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!source || !importanceMask || !suppressionMask || drawing) return
    const requestSampleRevision = sampleRevision
    const requestId = ++latestRequestRef.current
    const delay = immediateSampleRef.current ? 0 : 260
    immediateSampleRef.current = false
    const loadingTimer = window.setTimeout(() => {
      setSampling((current) => ({ ...current, status: 'loading', error: '' }))
    }, 0)
    const timer = window.setTimeout(() => {
      window.clearTimeout(loadingTimer)
      if (workerUnavailableRef.current) {
        setSampling({ points: [], status: 'error', error: 'Web Worker недоступен. Портрет не пересчитан, чтобы не блокировать редактор.' })
        return
      }
      try {
        workerRef.current?.terminate()
        const worker = new Worker(new URL('./sampling.worker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker
        worker.addEventListener('message', (event: MessageEvent<SampleWorkerResponse>) => {
          const message = event.data
          if (requestId !== latestRequestRef.current) return
          if (message.kind === 'ready') {
            setWorkerStatus('ready')
            const maskBuffer = importanceMask.slice().buffer as ArrayBuffer
            const suppressionBuffer = suppressionMask.slice().buffer as ArrayBuffer
            worker.postMessage({ kind: 'sample', id: requestId, importanceMask: maskBuffer, suppressionMask: suppressionBuffer, strokes, profiles, structure, settings: samplingSettings }, [maskBuffer, suppressionBuffer])
          } else if (message.kind === 'result') {
            completedSampleRevisionRef.current = requestSampleRevision
            setCompletedSampleRevision(requestSampleRevision)
            setSampling({ points: message.points, status: 'ready', error: '' })
            advancePreviewRevision()
            worker.terminate()
            if (workerRef.current === worker) workerRef.current = null
          } else if (message.kind === 'failure') {
            setSampling({ points: [], status: 'error', error: message.error })
            worker.terminate()
            if (workerRef.current === worker) workerRef.current = null
          }
        })
        worker.addEventListener('error', () => {
          if (requestId !== latestRequestRef.current) return
          workerUnavailableRef.current = true
          setWorkerStatus('unavailable')
          setSampling({ points: [], status: 'error', error: 'Web Worker недоступен. Портрет не пересчитан, чтобы не блокировать редактор.' })
          worker.terminate()
          if (workerRef.current === worker) workerRef.current = null
        })
        const photoBuffer = source.photoRgba.slice().buffer as ArrayBuffer
        const matteBuffer = source.matteRgba.slice().buffer as ArrayBuffer
        worker.postMessage({ kind: 'initialize', width: source.width, height: source.height, photoRgba: photoBuffer, matteRgba: matteBuffer }, [photoBuffer, matteBuffer])
      } catch (error) {
        workerRef.current?.terminate()
        workerRef.current = null
        if (requestId === latestRequestRef.current) {
          workerUnavailableRef.current = true
          setWorkerStatus('unavailable')
          setSampling({ points: [], status: 'error', error: error instanceof Error ? error.message : 'Web Worker недоступен; генерация остановлена без блокировки редактора.' })
        }
      }
    }, delay)
    return () => {
      window.clearTimeout(loadingTimer)
      window.clearTimeout(timer)
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [advancePreviewRevision, drawing, importanceMask, manualTick, profiles, sampleRevision, samplingSettings, source, strokes, structure, suppressionMask])

  useEffect(() => {
    if (!source || !importanceMask || !editorCanvasRef.current) return
    const canvas = editorCanvasRef.current
    const redraw = () => {
      const density = importanceMaskRef.current, suppression = suppressionMaskRef.current
      if (density && suppression) drawImportanceOverlay(canvas, density, suppression, source.width, source.height, maskOpacity, showDensity, showSuppression)
    }
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    redraw()
    return () => observer.disconnect()
  }, [importanceMask, suppressionMask, showDensity, showSuppression, maskOpacity, mode, source])

  useEffect(() => {
    if (!canvasElement) return
    const onContextLost = (event: Event) => {
      event.preventDefault()
      setWebglError('WebGL-контекст потерян. Предпросмотр недоступен; настройки и обычная навигация остаются доступны.')
    }
    canvasElement.addEventListener('webglcontextlost', onContextLost)
    return () => canvasElement.removeEventListener('webglcontextlost', onContextLost)
  }, [canvasElement])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.code === 'Space' && !target?.matches('input, textarea, select, button')) {
        event.preventDefault()
        spacePressedRef.current = true
      }
    }
    const keyUp = (event: KeyboardEvent) => { if (event.code === 'Space') spacePressedRef.current = false }
    const blur = () => { spacePressedRef.current = false; panRef.current = null }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur) }
  }, [])

  useEffect(() => {
    const frames = [photoFrameRef.current, resultFrameRef.current].filter((frame): frame is HTMLDivElement => frame !== null)
    if (!frames.length) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const frame = event.currentTarget as HTMLDivElement
      const rect = frame.getBoundingClientRect()
      const px = event.clientX - rect.left - rect.width / 2
      const py = event.clientY - rect.top - rect.height / 2
      setView((current) => zoomPortraitViewportAt(current, px, py, event.deltaY))
    }
    frames.forEach((frame) => frame.addEventListener('wheel', wheel, { passive: false }))
    return () => frames.forEach((frame) => frame.removeEventListener('wheel', wheel))
  }, [mode, source])

  const selectViewMode = useCallback((nextMode: ViewMode) => {
    if (nextMode === mode) return
    if (!showResultPane || nextMode === 'photo' || nextMode === 'mask') {
      setCanvasElement(null)
      renderedPreviewRevisionRef.current = -1
      setRenderedPreviewRevision(-1)
    }
    advancePreviewRevision()
    setMode(nextMode)
  }, [advancePreviewRevision, mode, showResultPane])

  const samplingError = sampling.error

  const commitSettings = useCallback((next: ParticlePortraitSettings) => {
    const previous = settingsRef.current
    if (SAMPLING_SETTING_KEYS.some((key) => previous[key] !== next[key])) advanceSampleRevision()
    advancePreviewRevision()
    settingsRef.current = next
    setSettings(next)
    setStorageAvailable(saveParticlePortraitSettings(next))
  }, [advancePreviewRevision, advanceSampleRevision])

  const saveMaskSnapshot = useCallback((next: Uint8Array, clearRedo = true) => {
    importanceMaskRef.current = next
    setImportanceMask(next)
    advanceSampleRevision()
    if (clearRedo) redoRef.current = []
  }, [advanceSampleRevision])

  const previewCanvasVisible = Boolean(showResultPane && !webglError && canvasElement?.isConnected
    && canvasElement.getClientRects().length > 0)
  const pointExportAvailable = samplingIsCurrent
  const previewExportAvailable = canExportPreview({
    status: sampling.status,
    revision: sampleRevision,
    completedRevision: completedSampleRevision,
    drawing,
    canvasVisible: previewCanvasVisible,
    previewRevision,
    renderedRevision: renderedPreviewRevision,
  })

  const refreshMaskLayer = useCallback(() => {
    const density = importanceMaskRef.current, suppression = suppressionMaskRef.current
    if (source && density && suppression && editorCanvasRef.current) drawImportanceOverlay(editorCanvasRef.current, density, suppression, source.width, source.height, maskOpacity, showDensity, showSuppression)
  }, [maskOpacity, source, showDensity, showSuppression])

  const maskPointFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!source) return null
    const canvas = editorCanvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    const rect = containRect(source.width, source.height, bounds.width, bounds.height)
    const localX = clientX - bounds.left - rect.x
    const localY = clientY - bounds.top - rect.y
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null
    return { x: localX / rect.width * source.width, y: localY / rect.height * source.height }
  }, [source])

  const paintAt = useCallback((point: { x: number; y: number }) => {
    const mask = tool === 'suppression' ? suppressionMaskRef.current : importanceMaskRef.current
    if (!source || !mask) return
    const prior = lastBrushPointRef.current
    const distance = prior ? Math.hypot(point.x - prior.x, point.y - prior.y) : 0
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, brushSize * 0.22)))
    for (let step = 0; step <= steps; step += 1) {
      const progress = steps === 0 ? 1 : step / steps
      paintImportanceMask(mask, source.width, source.height, {
        x: prior ? prior.x + (point.x - prior.x) * progress : point.x,
        y: prior ? prior.y + (point.y - prior.y) * progress : point.y,
        radius: brushSize / 2,
        value: tool === 'suppression' ? (erase ? 0 : 255) : brushValue,
        softness: brushSoftness,
        intensity: brushIntensity,
        erase: tool === 'suppression' ? false : erase,
      })
    }
    lastBrushPointRef.current = point
    refreshMaskLayer()
  }, [brushIntensity, brushSize, brushSoftness, brushValue, erase, refreshMaskLayer, source, tool])

  const snapshot = useCallback((): EditorSnapshot | null => {
    if (!importanceMaskRef.current || !suppressionMaskRef.current) return null
    return {
      density: importanceMaskRef.current.slice(), suppression: suppressionMaskRef.current.slice(), strokes: structuredClone(strokesRef.current),
      settings: { ...settingsRef.current }, profiles: structuredClone(profiles), structure: { ...structure },
      editor: { maskOpacity, brushSize, brushSoftness, brushIntensity, brushValue, strokeSpacing, strokeWidth, strokeJitter, strokeBrightness, strokeSmooth, strokeSize },
    }
  }, [brushIntensity, brushSize, brushSoftness, brushValue, maskOpacity, profiles, strokeBrightness, strokeJitter, strokeSize, strokeSmooth, strokeSpacing, strokeWidth, structure])
  const restoreSnapshot = useCallback((state: EditorSnapshot) => {
    importanceMaskRef.current = state.density
    suppressionMaskRef.current = state.suppression
    strokesRef.current = state.strokes
    setImportanceMask(state.density)
    setSuppressionMask(state.suppression)
    setStrokes(state.strokes)
    setProfiles(state.profiles)
    setStructure(state.structure)
    commitSettings(state.settings)
    setMaskOpacity(state.editor.maskOpacity)
    setBrushSize(state.editor.brushSize)
    setBrushSoftness(state.editor.brushSoftness)
    setBrushIntensity(state.editor.brushIntensity)
    setBrushValue(state.editor.brushValue)
    setStrokeSpacing(state.editor.strokeSpacing)
    setStrokeWidth(state.editor.strokeWidth)
    setStrokeJitter(state.editor.strokeJitter)
    setStrokeBrightness(state.editor.strokeBrightness)
    setStrokeSmooth(state.editor.strokeSmooth)
    setStrokeSize(state.editor.strokeSize)
    advanceSampleRevision()
  }, [advanceSampleRevision, commitSettings])

  const pushUndo = useCallback(() => {
    const before = snapshot()
    if (before) undoRef.current = [...undoRef.current.slice(-9), before]
    redoRef.current = []
    setHistory({ undo: undoRef.current.length, redo: 0 })
  }, [snapshot])

  const updateEditorControl = useCallback((setter: (value: number) => void, value: number) => {
    setter(value)
  }, [])

  const update = useCallback((setting: ParticlePortraitSettingKey, value: number) => {
    commitSettings(setParticlePortraitSetting(settingsRef.current, setting, value))
    setInvalidStoredValue(false)
    setCopyMessage('')
    setFallbackJson('')
  }, [commitSettings])

  const updateProfile = useCallback((kind: ParticleKind, key: keyof ParticleProfile, value: number) => {
    advanceSampleRevision()
    setProfiles((current) => ({ ...current, [kind]: { ...current[kind], [key]: Math.max(0, Math.min(2, value)) } }))
  }, [advanceSampleRevision])

  const updateStructure = useCallback((key: keyof PortraitStructureSettings, value: number) => {
    advanceSampleRevision()
    setStructure((current) => ({ ...current, [key]: value }))
  }, [advanceSampleRevision])

  const reset = useCallback(() => {
    pushUndo()
    commitSettings({ ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS })
    setInvalidStoredValue(false)
    setCopyMessage('Параметры по умолчанию восстановлены.')
    setFallbackJson('')
  }, [commitSettings, pushUndo])

  const beginPan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 && !(event.button === 0 && spacePressedRef.current)) return false
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { x: event.clientX, y: event.clientY, startX: view.x, startY: view.y }
    return true
  }, [view.x, view.y])

  const beginStroke = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (beginPan(event)) return
    if (event.button !== 0) return
    const point = maskPointFromPointer(event.clientX, event.clientY)
    if (!point || !importanceMaskRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pushUndo()
    drawingRef.current = true
    setDrawing(true)
    lastBrushPointRef.current = null
    if (tool === 'contour' || tool === 'flow') { draftRef.current = [point]; setDraft([point]) }
    else paintAt(point)
  }, [beginPan, maskPointFromPointer, paintAt, pushUndo, tool])

  const continueStroke = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      const pan = panRef.current
      setView((current) => ({ ...current, x: pan.startX + event.clientX - pan.x, y: pan.startY + event.clientY - pan.y }))
      return
    }
    if (!drawing) return
    const point = maskPointFromPointer(event.clientX, event.clientY)
    if (point && (tool === 'contour' || tool === 'flow')) {
      const prior = draftRef.current.at(-1)
      if (!prior || Math.hypot(point.x - prior.x, point.y - prior.y) >= 1) { draftRef.current = [...draftRef.current, point]; setDraft(draftRef.current) }
    } else if (point) paintAt(point)
  }, [drawing, maskPointFromPointer, paintAt, tool])

  const endStroke = useCallback(() => {
    if (panRef.current) { panRef.current = null; return }
    if (!drawing) return
    drawingRef.current = false
    setDrawing(false)
    lastBrushPointRef.current = null
    if (tool === 'contour' || tool === 'flow') {
      if (draftRef.current.length > 1) {
        const next: Stroke[] = [...strokesRef.current, { id: crypto.randomUUID(), kind: tool, points: draftRef.current, spacing: strokeSpacing, width: strokeWidth, jitter: strokeJitter, brightness: strokeBrightness, smooth: strokeSmooth, size: strokeSize }]
        strokesRef.current = next; setStrokes(next); advanceSampleRevision()
      }
      draftRef.current = []; setDraft([])
    } else if (tool === 'suppression') {
      if (suppressionMaskRef.current) { const next = suppressionMaskRef.current.slice(); suppressionMaskRef.current = next; setSuppressionMask(next); advanceSampleRevision() }
    } else if (importanceMaskRef.current) saveMaskSnapshot(importanceMaskRef.current.slice())
  }, [advanceSampleRevision, drawing, saveMaskSnapshot, strokeBrightness, strokeJitter, strokeSize, strokeSmooth, strokeSpacing, strokeWidth, tool])

  const undo = useCallback(() => {
    const prior = undoRef.current.pop(), current = snapshot()
    if (!prior || !current) return
    redoRef.current.push(current); restoreSnapshot(prior)
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length })
  }, [restoreSnapshot, snapshot])
  const redo = useCallback(() => {
    const next = redoRef.current.pop(), current = snapshot()
    if (!next || !current) return
    undoRef.current.push(current); restoreSnapshot(next)
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length })
  }, [restoreSnapshot, snapshot])
  const clearMask = useCallback(() => {
    if (!source) return
    pushUndo()
    if (tool === 'suppression') { const next = new Uint8Array(source.width * source.height); suppressionMaskRef.current = next; setSuppressionMask(next); advanceSampleRevision() }
    else saveMaskSnapshot(createNeutralImportanceMask(source.width, source.height))
  }, [advanceSampleRevision, pushUndo, saveMaskSnapshot, source, tool])

  const importMask = useCallback(async (file: File) => {
    if (!source) throw new Error('Дождитесь загрузки фотографии перед импортом маски.')
    const imageUrl = URL.createObjectURL(file)
    let image: HTMLImageElement
    try {
      image = await loadImage(imageUrl)
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Не удалось прочитать импортированную маску.')
    context.drawImage(image, 0, 0, source.width, source.height)
    const imported = maskFromImageData(context.getImageData(0, 0, source.width, source.height), source.width, source.height)
    if (importanceMaskRef.current) pushUndo()
    saveMaskSnapshot(imported)
  }, [pushUndo, saveMaskSnapshot, source])

  const exportMask = useCallback(async () => {
    if (!source || !importanceMask) return
    saveBlob(await createGrayMaskPng(importanceMask, source.width, source.height), 'portrait-mask.png')
  }, [importanceMask, source])

  const exportSettings = useCallback(() => {
    const payload = {
      format: 'a-little-universe/scene04-portrait-settings', version: 1,
      settings, editor: { maskOpacity, brushSize, brushSoftness, brushIntensity, brushValue },
    }
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'portrait-settings.json')
  }, [brushIntensity, brushSize, brushSoftness, brushValue, maskOpacity, settings])

  const exportPoints = useCallback(() => {
    if (!source || !canExportPoints({
      status: sampling.status,
      revision: sampleRevisionRef.current,
      completedRevision: completedSampleRevisionRef.current,
      drawing: drawingRef.current,
    })) throw new Error('Дождитесь завершения актуального пересчёта перед экспортом точек.')
    const payload = createScene04PortraitPointExport(sampling.points, source.width, source.height, settings)
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'portrait-points.json')
  }, [sampling.points, sampling.status, settings, source])

  const exportPreview = useCallback(async () => {
    const available = canExportPreview({
      status: sampling.status,
      revision: sampleRevisionRef.current,
      completedRevision: completedSampleRevisionRef.current,
      drawing: drawingRef.current,
      canvasVisible: Boolean(showResultPane && !webglError && canvasElement?.isConnected
        && canvasElement.getClientRects().length > 0),
      previewRevision: previewRevisionRef.current,
      renderedRevision: renderedPreviewRevisionRef.current,
    })
    if (!canvasElement || !available) {
      throw new Error('Дождитесь актуального пересчёта и видимого рендера портрета перед экспортом PNG.')
    }
    const preview = document.createElement('canvas')
    preview.width = canvasElement.width
    preview.height = canvasElement.height
    const context = preview.getContext('2d')
    if (!context) throw new Error('Не удалось создать PNG предпросмотра.')
    context.fillStyle = '#080914'
    context.fillRect(0, 0, preview.width, preview.height)
    context.drawImage(canvasElement, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => preview.toBlob((value) => value ? resolve(value) : reject(new Error('Браузер не создал PNG предпросмотра.')), 'image/png'))
    saveBlob(blob, 'portrait-preview.png')
  }, [canvasElement, sampling.status, showResultPane, webglError])

  const importSettings = useCallback(async (file: File) => {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>
    const rawSettings = parsed.settings ?? parsed
    const next = parseParticlePortraitSettings(rawSettings)
    pushUndo()
    commitSettings(next)
    const editor = parsed.editor
    if (editor && typeof editor === 'object') {
      const values = editor as Record<string, unknown>
      if (typeof values.maskOpacity === 'number') setMaskOpacity(Math.min(1, Math.max(0.05, values.maskOpacity)))
      if (typeof values.brushSize === 'number') setBrushSize(Math.min(300, Math.max(1, values.brushSize)))
      if (typeof values.brushSoftness === 'number') setBrushSoftness(Math.min(1, Math.max(0, values.brushSoftness)))
      if (typeof values.brushIntensity === 'number') setBrushIntensity(Math.min(1, Math.max(0.05, values.brushIntensity)))
      if (typeof values.brushValue === 'number') setBrushValue(Math.min(255, Math.max(0, values.brushValue)))
    }
  }, [commitSettings, pushUndo])

  const exportProject = useCallback(() => {
    if (!source || !importanceMaskRef.current || !suppressionMaskRef.current) return
    const project = { width: source.width, height: source.height, settings, density: importanceMaskRef.current,
      suppression: suppressionMaskRef.current, strokes: strokesRef.current, profiles, structure,
      editor: { maskOpacity, brushSize, brushSoftness, brushIntensity, brushValue, strokeSpacing, strokeWidth, strokeJitter, strokeBrightness, strokeSmooth, strokeSize } }
    saveBlob(new Blob([serializePortraitProject(project)], { type: 'application/json' }), 'portrait-project.json')
  }, [brushIntensity, brushSize, brushSoftness, brushValue, maskOpacity, profiles, settings, source, strokeBrightness, strokeJitter, strokeSize, strokeSmooth, strokeSpacing, strokeWidth, structure])
  const importProject = useCallback(async (file: File) => {
    if (!source) throw new Error('Дождитесь загрузки фотографии.')
    const project = parsePortraitProject(JSON.parse(await file.text()), source.width, source.height)
    pushUndo()
    restoreSnapshot({ density: project.density, suppression: project.suppression, strokes: project.strokes,
      settings: project.settings, profiles: project.profiles, structure: project.structure, editor: project.editor })
  }, [pushUndo, restoreSnapshot, source])

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

  const unavailable = sourceError || samplingError || webglError
  const commitImportedMask = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) void importMask(file).then(() => setCopyMessage('Маска загружена.')).catch((error: unknown) => setCopyMessage(error instanceof Error ? error.message : 'Не удалось загрузить маску.'))
    event.currentTarget.value = ''
  }
  const commitImportedSettings = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) void importSettings(file).then(() => setCopyMessage('Настройки восстановлены.')).catch((error: unknown) => setCopyMessage(error instanceof Error ? error.message : 'Не удалось прочитать настройки.'))
    event.currentTarget.value = ''
  }

  return (
    <div className="particle-portrait-lab">
      <header className="ppl-topbar">
        <a className="ppl-back" href="/" aria-label="Вернуться к фильму">← К фильму</a>
        <div className="ppl-title"><span className="ppl-kicker">A LITTLE UNIVERSE / DEV</span><h1>Звёздный портрет</h1></div>
        <div className="ppl-toolbar">
          <div className="ppl-view-switch" role="group" aria-label="Режим предпросмотра">
            <button type="button" aria-pressed={mode === 'compare'} onClick={() => selectViewMode('compare')}>Сравнить</button>
            <button type="button" aria-pressed={mode === 'photo'} onClick={() => selectViewMode('photo')}>Оригинал</button>
            <button type="button" aria-pressed={mode === 'mask'} onClick={() => selectViewMode('mask')}>Маска</button>
            <button type="button" aria-pressed={mode === 'particles'} onClick={() => selectViewMode('particles')}>Результат</button>
          </div>
          <button className="ppl-panel-toggle" type="button" aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? 'Скрыть параметры' : 'Параметры'}</button>
        </div>
      </header>

      <main className={`ppl-layout${panelOpen ? ' ppl-layout--panel-open' : ''}`}>
        <section className={`ppl-stage${mode === 'compare' ? ' ppl-stage--compare' : ''}`} aria-label="Редактор и предпросмотр портрета">
          <div className={`ppl-stage-content${mode !== 'compare' ? ' ppl-stage-content--single' : ''}`}>
            {showPhotoPane && <section className="ppl-preview-pane" aria-label="Фото и grayscale маска">
              <div className="ppl-pane-heading"><span>Исходная фотография</span><span>{source ? `${source.width} × ${source.height}` : 'загрузка'}</span></div>
              <div className="ppl-frame ppl-photo-frame" ref={photoFrameRef}
                onPointerDown={beginStroke} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke}>
                <div className="ppl-photo-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
                {source && !sourceError && <img className="ppl-source-image" src={source.photoUrl} alt="Оригинальная фотография Василисы" draggable={false} onError={() => setSourceError('Исходное фото недоступно.')} />}
                {showMaskOverlay && importanceMask && source && <canvas
                  ref={editorCanvasRef}
                  className={`ppl-mask-canvas${drawing ? ' ppl-mask-canvas--drawing' : ''}`}
                  aria-label="Нарисовать приоритет grayscale-маски поверх фотографии"
                  style={{ pointerEvents: 'auto', touchAction: 'none' }}
                />}
                {edgeOverlay && <img className="ppl-edge-overlay" src={edgeOverlay} alt="" />}
                {source && (showContour || showFlow) && <svg className="ppl-stroke-overlay" viewBox={`0 0 ${source.width} ${source.height}`} preserveAspectRatio="xMidYMid meet">
                  {strokes.filter((stroke) => stroke.kind === 'contour' ? showContour : showFlow).map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={stroke.id === selectedStroke ? '#fff' : stroke.kind === 'contour' ? '#ffb7a4' : '#a7cbff'} strokeWidth="1" />)}
                  {draft.length > 1 && <polyline points={draft.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1" />}
                </svg>}
                </div>
                {!source && !sourceError && <div className="ppl-loading" role="status">Загружаю фотографию…</div>}
                {sourceError && <div className="ppl-unavailable" role="alert">{sourceError}</div>}
              </div>
              <div className="ppl-tool-row" aria-label="Zoom">
                <button type="button" aria-label="Уменьшить масштаб" onClick={() => setView((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.25) }))}>−</button>
                <output>{Math.round(view.zoom * 100)}%</output>
                <button type="button" aria-label="Увеличить масштаб" onClick={() => setView((v) => ({ ...v, zoom: Math.min(MAX_PORTRAIT_ZOOM, v.zoom * 1.25) }))}>+</button>
                <button type="button" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>100%</button>
                <button type="button" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>Вписать изображение</button>
                <span>Пробел или средняя кнопка мыши — перемещение</span>
              </div>
              {showMaskOverlay && <div className="ppl-mask-tools" aria-label="Инструменты маски">
                <div className="ppl-tool-row" role="group" aria-label="Слои редактора">
                  {([['density', 'Density Mask'], ['contour', 'Feature Strokes'], ['flow', 'Flow Strokes'], ['suppression', 'Suppression Mask']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tool === value} onClick={() => setTool(value)}>{label}</button>)}
                  <label><input type="checkbox" checked={showDensity} onChange={(event) => setShowDensity(event.target.checked)} /> Плотность</label>
                  <label><input type="checkbox" checked={showSuppression} onChange={(event) => setShowSuppression(event.target.checked)} /> Подавление</label>
                  <label><input type="checkbox" checked={showContour} onChange={(event) => setShowContour(event.target.checked)} /> Контуры</label>
                  <label><input type="checkbox" checked={showFlow} onChange={(event) => setShowFlow(event.target.checked)} /> Волосы</label>
                  <label><input type="checkbox" checked={showEdges} onChange={(event) => setShowEdges(event.target.checked)} /> Подсказка границ</label>
                  {showEdges && <label>Порог <input type="range" min="5" max="100" value={edgeThreshold} onChange={(event) => setEdgeThreshold(Number(event.target.value))} /></label>}
                </div>
                {(tool === 'contour' || tool === 'flow') && <div className="ppl-brush-grid">
                  {([['Расстояние', strokeSpacing, setStrokeSpacing, 3, 40], ['Ширина потока', strokeWidth, setStrokeWidth, 0, 60], ['Разброс', strokeJitter, setStrokeJitter, 0, 20], ['Яркость', strokeBrightness, setStrokeBrightness, .2, 2], ['Сглаживание', strokeSmooth, setStrokeSmooth, 0, 1], ['Размер', strokeSize, setStrokeSize, .4, 3]] as const).map(([label, value, setter, min, max]) => <label key={label} className="ppl-control"><span>{label} <output>{value}</output></span><input type="range" min={min} max={max} step={max <= 3 ? .05 : 1} value={value} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateEditorControl(setter, Number(event.target.value))} /></label>)}
                  <label>Штрих <select value={selectedStroke} onChange={(event) => setSelectedStroke(event.target.value)}><option value="">Выбрать</option>{strokes.map((stroke, i) => <option key={stroke.id} value={stroke.id}>{stroke.kind === 'contour' ? 'Контур' : 'Волосы'} {i + 1}</option>)}</select></label>
                  <button type="button" disabled={!selectedStroke} onClick={() => { if (!selectedStroke) return; pushUndo(); const next = strokesRef.current.filter((stroke) => stroke.id !== selectedStroke); strokesRef.current = next; setStrokes(next); setSelectedStroke(''); advanceSampleRevision() }}>Удалить штрих</button>
                </div>}
                <div className="ppl-tool-row">
                  <button type="button" aria-pressed={!erase} onClick={() => setErase(false)}>Кисть</button>
                  <button type="button" aria-pressed={erase} onClick={() => setErase(true)}>Ластик</button>
                  <button type="button" onClick={undo} disabled={!history.undo}>Отменить</button>
                  <button type="button" onClick={redo} disabled={!history.redo}>Повторить</button>
                  <button type="button" onClick={clearMask} disabled={!importanceMask}>Нейтральная маска</button>
                </div>
                <div className="ppl-priority-swatches" role="group" aria-label="Готовые уровни приоритета">
                  {[{ label: 'Чёрный · исключить', value: 0 }, { label: 'Тёмный · низкий', value: 64 }, { label: 'Нейтральный', value: NEUTRAL_IMPORTANCE }, { label: 'Светлый · высокий', value: 200 }, { label: 'Белый · максимум', value: 255 }].map((preset) => <button key={preset.value} type="button" className="ppl-swatch" aria-label={preset.label} aria-pressed={brushValue === preset.value} onClick={() => { pushUndo(); updateEditorControl(setBrushValue, preset.value); setErase(false) }}><i style={{ backgroundColor: `rgb(${preset.value} ${preset.value} ${preset.value})` }} /></button>)}
                  <label className="ppl-value-control">Значение <input aria-label="Grayscale значение кисти" type="range" min="0" max="255" value={brushValue} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => { updateEditorControl(setBrushValue, Number(event.target.value)); setErase(false) }} /><output>{brushValue}</output></label>
                </div>
                <div className="ppl-brush-grid">
                  <label className="ppl-control"><span>Размер кисти <output>{brushSize} px</output></span><input aria-label="Размер кисти" type="range" min="1" max="300" step="1" value={brushSize} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateEditorControl(setBrushSize, Number(event.target.value))} /></label>
                  <label className="ppl-control"><span>Мягкость краёв <output>{Math.round(brushSoftness * 100)}%</output></span><input aria-label="Мягкость кисти" type="range" min="0" max="1" step="0.01" value={brushSoftness} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateEditorControl(setBrushSoftness, Number(event.target.value))} /></label>
                  <label className="ppl-control"><span>Интенсивность <output>{Math.round(brushIntensity * 100)}%</output></span><input aria-label="Интенсивность кисти" type="range" min="0.05" max="1" step="0.01" value={brushIntensity} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateEditorControl(setBrushIntensity, Number(event.target.value))} /></label>
                  <label className="ppl-control"><span>Прозрачность наложения <output>{Math.round(maskOpacity * 100)}%</output></span><input aria-label="Прозрачность маски" type="range" min="0.05" max="1" step="0.01" value={maskOpacity} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateEditorControl(setMaskOpacity, Number(event.target.value))} /></label>
                </div>
                <div className="ppl-tool-row">
                  <button type="button" onClick={() => maskInputRef.current?.click()} disabled={!source}>Импорт маски</button>
                  <button type="button" onClick={() => void exportMask().catch((error: unknown) => setCopyMessage(error instanceof Error ? error.message : 'Не удалось сохранить маску.'))} disabled={!importanceMask}>Сохранить PNG маски</button>
                  <input ref={maskInputRef} className="ppl-hidden-input" type="file" accept="image/png,image/*" onChange={commitImportedMask} aria-label="Выбрать PNG grayscale-маску" />
                </div>
              </div>}
            </section>}

            {showResultPane && <section className="ppl-preview-pane" aria-label="Результат звёздного портрета">
              <div className="ppl-pane-heading"><span>Звёздный портрет</span><span>{samplingIsCurrent ? `${sampling.points.length.toLocaleString('ru-RU')} частиц` : 'пересчёт…'}</span></div>
              <div className="ppl-tool-row ppl-layer-preview" role="group" aria-label="Режим предпросмотра частиц">
                {([['contour', 'Contours only'], ['contour-support', 'Contours + Support'], ['fill', 'Fill only'], ['final', 'Final combined']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={previewLayer === value} onClick={() => { setPreviewLayer(value); advancePreviewRevision() }}>{label}</button>)}
              </div>
              <div className="ppl-frame ppl-result-frame" ref={resultFrameRef}
                onPointerDown={beginPan} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke}>
                {source && !sourceError && (
                <div className="ppl-result-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
                <Canvas
                  className="ppl-canvas"
                  frameloop="demand"
                  dpr={[1, 1.5]}
                  camera={{ position: [0, 0, CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 100 }}
                  gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'default' }}
                  onCreated={({ gl }) => { setCanvasElement(gl.domElement); setWebglError('') }}
                  fallback={<div className="ppl-unavailable" role="alert">Предпросмотр недоступен: браузер не смог создать WebGL-контекст.</div>}
                >
                  {!webglError && !samplingError && <PortraitPoints points={sampling.points.filter((point) => previewLayer === 'final'
                    || (previewLayer === 'contour' && point.type === 'contour')
                    || (previewLayer === 'contour-support' && (point.type === 'contour' || point.type === 'support'))
                    || (previewLayer === 'fill' && point.type === 'fill'))} source={source} settings={settings} previewRevision={previewRevision} onRendered={markPreviewRendered} />}
                </Canvas>
                </div>
                )}
                {sampling.status === 'loading' && <div className="ppl-compute-status" role="status"><i />Пересчитываю частицы</div>}
                {!source && !sourceError && <div className="ppl-loading" role="status">Подготавливаю предпросмотр…</div>}
                {unavailable && <div className="ppl-unavailable" role="alert">{unavailable}</div>}
              </div>
              <div className="ppl-preview-caption"><span>ФОН · #080914</span><span>4:3 · normalized UV</span></div>
            </section>}
          </div>
        </section>

        {panelOpen && <aside className="ppl-panel" aria-label="Настройки портрета">
          <div className="ppl-panel-heading"><div><span className="ppl-kicker">LOOK DEVELOPMENT</span><h2>Параметры</h2></div><button type="button" className="ppl-reset" onClick={reset}>Сбросить</button></div>
          <details className="ppl-group" open>
            <summary>Частицы</summary><div className="ppl-controls">
              <label className="ppl-control"><span>Детерминированный seed</span><input aria-label="Детерминированный seed" type="number" min="1" max="4294967295" step="1" value={settings.seed} onChange={(event) => update('seed', Number(event.target.value))} /></label>
              <RangeControl label="Количество" setting="count" settings={settings} min={4_000} max={32_000} step={1_000} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Минимальный размер" setting="minSize" settings={settings} min={0.4} max={1.6} step={0.05} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Максимальный размер" setting="maxSize" settings={settings} min={0.8} max={3} step={0.05} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Яркость" setting="brightness" settings={settings} min={0.2} max={2} step={0.05} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Прозрачность" setting="opacity" settings={settings} min={0.2} max={1} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Мягкое свечение" setting="glow" settings={settings} min={0} max={2} step={0.01} onChange={update} onInteractionStart={pushUndo} />
            </div>
          </details>
          <details className="ppl-group" open>
            <summary>Детализация и распределение</summary><div className="ppl-controls">
              <RangeControl label="Усиление деталей" setting="detailBoost" settings={settings} min={0.5} max={2} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Заполнение полутонов" setting="fillDensity" settings={settings} min={0.3} max={2} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Контраст" setting="contrast" settings={settings} min={0.5} max={1.8} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Порог фона" setting="backgroundThreshold" settings={settings} min={0.05} max={0.4} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Нерегулярность" setting="irregularity" settings={settings} min={0} max={1} step={0.01} onChange={update} onInteractionStart={pushUndo} />
            </div>
          </details>
          {([['contour', 'Контуры'], ['support', 'Support'], ['flow', 'Потоки волос'], ['fill', 'Заливка']] as const).map(([kind, label]) => <details className="ppl-group" key={kind}>
            <summary>{label}: частицы</summary>
            <div className="ppl-controls">
              {([['density', 'Плотность'], ['size', 'Размер'], ['brightness', 'Яркость'], ['jitter', 'Разброс']] as const).map(([key, name]) => <label className="ppl-control" key={key}>
                <span>{name}<output>{profiles[kind][key].toFixed(2)}</output></span>
                <input aria-label={`${label}: ${name}`} type="range" min="0" max="2" step="0.05" value={profiles[kind][key]} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateProfile(kind, key, Number(event.target.value))} />
              </label>)}
              {kind === 'contour' && <label className="ppl-control"><span>Минимальное расстояние между точками <output>{structure.contourMinSpacing.toFixed(0)} px</output></span><input aria-label="Contours: minimum spacing" type="range" min="3" max="40" step="1" value={structure.contourMinSpacing} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateStructure('contourMinSpacing', Number(event.target.value))} /></label>}
              {kind === 'support' && <>
                <label className="ppl-control"><span>Ширина мягкой зоны <output>{structure.supportWidth.toFixed(0)} px</output></span><input aria-label="Support: width" type="range" min="2" max="160" step="1" value={structure.supportWidth} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateStructure('supportWidth', Number(event.target.value))} /></label>
                <label className="ppl-control"><span>Смешивание с заливкой <output>{Math.round(structure.supportMix * 100)}%</output></span><input aria-label="Support: fill mix" type="range" min="0" max="0.7" step="0.01" value={structure.supportMix} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateStructure('supportMix', Number(event.target.value))} /></label>
              </>}
              {kind === 'fill' && <>
                <label className="ppl-control"><span>Подавление возле контура <output>{Math.round(structure.fillSuppression * 100)}%</output></span><input aria-label="Fill: contour suppression" type="range" min="0" max="1" step="0.01" value={structure.fillSuppression} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateStructure('fillSuppression', Number(event.target.value))} /></label>
                <label className="ppl-control"><span>Минимальная плотность лица <output>{Math.round(structure.minFaceFill * 100)}%</output></span><input aria-label="Fill: minimum face density" type="range" min="0" max="1" step="0.01" value={structure.minFaceFill} onPointerDown={pushUndo} onKeyDown={pushUndo} onChange={(event) => updateStructure('minFaceFill', Number(event.target.value))} /></label>
              </>}
              <p className="ppl-hint">Множители для всех частиц этого типа. Параметры отдельных штрихов сохраняются.</p>
            </div>
          </details>)}
          <details className="ppl-group">
            <summary>Свет и цвет</summary><div className="ppl-controls">
              <RangeControl label="Минимальная яркость теней" setting="minimumBrightness" settings={settings} min={0} max={0.7} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Контраст светового портрета" setting="portraitContrast" settings={settings} min={0.5} max={2} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Цвет фото ↔ палитра" setting="photoColorMix" settings={settings} min={0} max={1} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <p className="ppl-hint">Эти параметры меняют свет и тон уже выбранных точек, не их координаты.</p>
            </div>
          </details>
          <details className="ppl-group">
            <summary>Композиция</summary><div className="ppl-controls">
              <RangeControl label="Масштаб" setting="scale" settings={settings} min={0.6} max={1.2} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Положение X" setting="offsetX" settings={settings} min={-0.5} max={0.5} step={0.01} onChange={update} onInteractionStart={pushUndo} />
              <RangeControl label="Положение Y" setting="offsetY" settings={settings} min={-0.5} max={0.5} step={0.01} onChange={update} onInteractionStart={pushUndo} />
            </div>
          </details>
          <div className="ppl-generate">
            <button type="button" className="ppl-regenerate" onClick={() => { immediateSampleRef.current = true; advanceSampleRevision(); setManualTick((value) => value + 1) }}>Перегенерировать</button>
            <p role="status">{workerStatus === 'unavailable' ? 'Web Worker недоступен: генерация остановлена без блокировки страницы.' : samplingIsCurrent ? 'Маска пересчитывается автоматически после паузы в рисовании.' : sampling.status === 'loading' ? 'Пересчёт идёт в фоне; редактор остаётся доступен.' : 'Ожидание актуального пересчёта; экспорт временно заблокирован.'}</p>
          </div>
          <div className="ppl-export">
            <h3>Сохранение</h3>
            <button type="button" onClick={exportProject} disabled={!source}>Скачать проект JSON</button>
            <button type="button" onClick={() => projectInputRef.current?.click()} disabled={!source}>Импорт проекта JSON</button>
            <input ref={projectInputRef} className="ppl-hidden-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importProject(file).then(() => setCopyMessage('Проект загружен.')).catch((error: unknown) => setCopyMessage(error instanceof Error ? error.message : 'Не удалось загрузить проект.')); event.currentTarget.value = '' }} />
            <button type="button" onClick={exportSettings}>Скачать настройки JSON</button>
            <button type="button" onClick={() => { try { exportPoints() } catch (error) { setCopyMessage(error instanceof Error ? error.message : 'Не удалось экспортировать точки.') } }} disabled={!pointExportAvailable}>Скачать координаты точек JSON</button>
            <button type="button" onClick={() => void exportPreview().catch((error: unknown) => setCopyMessage(error instanceof Error ? error.message : 'Не удалось сохранить PNG предпросмотра.'))} disabled={!previewExportAvailable}>Скачать PNG-превью</button>
            <button type="button" onClick={() => settingsInputRef.current?.click()}>Импорт настроек JSON</button>
            <input ref={settingsInputRef} className="ppl-hidden-input" type="file" accept="application/json,.json" onChange={commitImportedSettings} aria-label="Выбрать JSON настроек" />
            <button type="button" className="ppl-copy" onClick={() => void copySettings()} disabled={copying}>{copying ? 'Копирую…' : 'Скопировать параметры'}</button>
            <div className="ppl-messages" aria-live="polite">
              {!storageAvailable && <p role="status">Хранилище недоступно: настройки сохраняются только до закрытия вкладки.</p>}
              {invalidStoredValue && <p role="status">Сохранённые параметры повреждены; применены значения по умолчанию.</p>}
              {sampling.error && <p role="alert">{sampling.error}</p>}
              {copyMessage && <p role="status">{copyMessage}</p>}
            </div>
            {fallbackJson && <textarea ref={fallbackRef} className="ppl-json-fallback" aria-label="JSON настроек для ручного копирования" readOnly value={fallbackJson} onFocus={(event) => event.currentTarget.select()} />}
            <span className="ppl-schema">JSON · schema v{settings.version} · {serializeParticlePortraitSettings(settings).length.toLocaleString('ru-RU')} знаков</span>
          </div>
        </aside>}
      </main>
    </div>
  )
}
