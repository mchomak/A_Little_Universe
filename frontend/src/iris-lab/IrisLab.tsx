import { useCallback, useEffect, useRef, useState } from 'react'
import { EyeViewport } from './EyeViewport'
import { resolveIrisPhotoSource } from './assets'
import { applyViewMode, builtInPresets, cameraViews, defaults, identifyIrisGradingPreset, irisGradingPresets, isPhotoIrisMode, parseConfig, toggleIrisPreview, updateGradingColor, updateGradingSetting } from './config'
import type { CameraConfig, IrisColorGrading, IrisPreviewState, LabConfig, LabStats } from './config'
import { IrisMaskEditor } from './PhotoMaskEditorView'
import './iris-lab.css'

type Group = Exclude<keyof LabConfig, 'version'>
type Control = { key: string; label: string; min?: number; max?: number; step?: number; options?: string[] }
const groups: { id: Group; title: string; controls: Control[] }[] = [
  { id: 'display', title: '00  View mode & layers', controls: [
    { key: 'mode', label: 'View mode', options: ['Original', 'Memory Signal', 'Memory Signal Baseline', 'Blue Particle Eye', 'Cinematic Fiber Iris', 'Run 017 Blue Fibers', 'Fire Eye Fibers', 'Hybrid'] }, { key: 'showModel', label: 'Original eye model' }, { key: 'modelOpacity', label: 'Model opacity', min: 0, max: 1, step: 0.01 }, { key: 'particleOpacity', label: 'Memory Signal opacity', min: 0, max: 1, step: 0.01 }, { key: 'fiberOpacity', label: 'Procedural fiber opacity', min: 0, max: 1, step: 0.01 },
  ] },
  { id: 'blueEye', title: '01  Photo iris mask & color', controls: [
    { key: 'irisCenterX', label: 'Iris center X', min: 0, max: 1, step: 0.001 }, { key: 'irisCenterY', label: 'Iris center Y', min: 0, max: 1, step: 0.001 }, { key: 'irisRadiusX', label: 'Iris radius X', min: 0.08, max: 0.5, step: 0.001 }, { key: 'irisRadiusY', label: 'Iris radius Y', min: 0.08, max: 0.5, step: 0.001 }, { key: 'irisRotation', label: 'Iris ellipse rotation', min: -1.57, max: 1.57, step: 0.01 },
    { key: 'pupilCenterX', label: 'Pupil center X', min: 0, max: 1, step: 0.001 }, { key: 'pupilCenterY', label: 'Pupil center Y', min: 0, max: 1, step: 0.001 }, { key: 'pupilRadiusX', label: 'Pupil radius X', min: 0.01, max: 0.12, step: 0.001 }, { key: 'pupilRadiusY', label: 'Pupil radius Y', min: 0.01, max: 0.12, step: 0.001 }, { key: 'pupilRotation', label: 'Pupil ellipse rotation', min: -1.57, max: 1.57, step: 0.01 },
    { key: 'irisFocus', label: 'Iris Focus', min: 0, max: 1, step: 0.01 }, { key: 'outerEyeFade', label: 'Outer Eye Fade', min: 0, max: 1, step: 0.01 }, { key: 'irisColorStrength', label: 'Iris Color Strength', min: 0, max: 1, step: 0.01 }, { key: 'pupilDarkness', label: 'Pupil Darkness', min: 0, max: 1, step: 0.01 }, { key: 'particleDepth', label: 'Particle Depth', min: 0, max: 0.3, step: 0.005 },
    { key: 'particleDensity', label: 'Photo particle density', min: 0.02, max: 1, step: 0.01 }, { key: 'particleSize', label: 'Photo particle size', min: 0.1, max: 2, step: 0.01 }, { key: 'particleOpacity', label: 'Photo particle opacity', min: 0, max: 1, step: 0.01 }, { key: 'particleBrightness', label: 'Photo particle brightness', min: 0, max: 2, step: 0.01 }, { key: 'particleScatter', label: 'Photo particle scatter', min: 0, max: 0.03, step: 0.001 }, { key: 'bloomStrength', label: 'Photo Bloom strength', min: 0, max: 0.8, step: 0.01 },
    { key: 'fiberDensity', label: 'Cinematic fiber density', min: 0, max: 1, step: 0.01 }, { key: 'fiberLength', label: 'Cinematic fiber length', min: 0.2, max: 2, step: 0.01 }, { key: 'fiberCurvature', label: 'Cinematic fiber curvature', min: 0, max: 1, step: 0.01 }, { key: 'fiberThickness', label: 'Cinematic fiber width', min: 0.1, max: 3, step: 0.05 }, { key: 'fiberBrightness', label: 'Cinematic fiber brightness', min: 0, max: 2, step: 0.01 }, { key: 'fiberOpacity', label: 'Cinematic fiber opacity', min: 0, max: 1, step: 0.01 }, { key: 'fiberNoiseScale', label: 'Cinematic fiber noise scale', min: 1, max: 16, step: 0.1 }, { key: 'fiberDepth', label: 'Cinematic layer separation', min: 0, max: 0.6, step: 0.005 }, { key: 'fiberAnimationSpeed', label: 'Cinematic fiber speed', min: 0, max: 0.25, step: 0.001 },
    { key: 'showSourceParticles', label: 'Source photo particles' }, { key: 'showFiberRibbons', label: '3D fiber ribbons' }, { key: 'showFiberSparks', label: 'Fiber-linked particles' },
  ] },
  { id: 'camera', title: '01  Camera & composition', controls: [
    { key: 'distance', label: 'Distance', min: 1.3, max: 8, step: 0.05 }, { key: 'azimuth', label: 'Horizontal angle', min: -1, max: 1, step: 0.01 }, { key: 'elevation', label: 'Vertical angle', min: -0.8, max: 0.8, step: 0.01 }, { key: 'fov', label: 'Field of view', min: 20, max: 75, step: 1 }, { key: 'targetX', label: 'Target X', min: -1, max: 1, step: 0.01 }, { key: 'targetY', label: 'Target Y', min: -1, max: 1, step: 0.01 }, { key: 'autoRotate', label: 'Auto rotation' }, { key: 'autoSpeed', label: 'Rotation speed', min: 0, max: 1, step: 0.01 }, { key: 'locked', label: 'Lock camera' },
  ] },
  { id: 'eye', title: '02  Eye geometry', controls: [
    { key: 'scale', label: 'Eyeball scale', min: 0.7, max: 1.3, step: 0.01 }, { key: 'irisRadius', label: 'Iris radius', min: 0.4, max: 0.7, step: 0.01 }, { key: 'pupilRadius', label: 'Pupil radius', min: 0.08, max: 0.3, step: 0.005 }, { key: 'irisDepth', label: 'Iris depth', min: -0.1, max: 0.1, step: 0.005 }, { key: 'corneaScale', label: 'Cornea scale', min: 0.8, max: 1.2, step: 0.01 }, { key: 'corneaCurvature', label: 'Cornea curvature', min: 0.5, max: 1.5, step: 0.01 },
  ] },
  { id: 'material', title: '03  Eye materials', controls: [
    { key: 'scleraTint', label: 'Sclera tint' }, { key: 'roughness', label: 'Sclera roughness', min: 0, max: 1, step: 0.01 }, { key: 'reflection', label: 'Reflection', min: 0, max: 2, step: 0.01 }, { key: 'corneaOpacity', label: 'Cornea opacity', min: 0, max: 0.8, step: 0.01 }, { key: 'corneaRoughness', label: 'Cornea roughness', min: 0, max: 1, step: 0.01 }, { key: 'irisBrightness', label: 'Iris brightness', min: 0.2, max: 2, step: 0.01 }, { key: 'irisContrast', label: 'Iris contrast', min: 0.2, max: 2, step: 0.01 }, { key: 'irisSaturation', label: 'Iris saturation', min: 0, max: 2, step: 0.01 }, { key: 'irisDetail', label: 'Texture detail', min: 0, max: 2, step: 0.01 },
  ] },
  { id: 'lighting', title: '04  Lighting', controls: [
    { key: 'key', label: 'Key intensity', min: 0, max: 5, step: 0.05 }, { key: 'keyColor', label: 'Key color' }, { key: 'keyX', label: 'Key X', min: -8, max: 8, step: 0.1 }, { key: 'keyY', label: 'Key Y', min: -8, max: 8, step: 0.1 }, { key: 'fill', label: 'Fill', min: 0, max: 3, step: 0.05 }, { key: 'rim', label: 'Rim', min: 0, max: 3, step: 0.05 }, { key: 'ambient', label: 'Ambient', min: 0, max: 2, step: 0.05 }, { key: 'environment', label: 'Environment reflections', min: 0, max: 2, step: 0.01 }, { key: 'background', label: 'Background' },
  ] },
  { id: 'particles', title: '05  Particles', controls: [
    { key: 'density', label: 'Density', min: 0, max: 1, step: 0.01 }, { key: 'size', label: 'Size', min: 0.1, max: 4, step: 0.05 }, { key: 'sizeVariation', label: 'Size variation', min: 0, max: 1, step: 0.01 }, { key: 'glow', label: 'Particle glow', min: 0, max: 2, step: 0.01 }, { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 }, { key: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.01 }, { key: 'depth', label: 'Depth spread', min: 0, max: 0.2, step: 0.005 }, { key: 'movement', label: 'Movement', min: 0, max: 0.2, step: 0.005 }, { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05 }, { key: 'twinkle', label: 'Twinkle', min: 0, max: 1, step: 0.01 },
  ] },
  { id: 'fibers', title: '06  Fibers', controls: [
    { key: 'density', label: 'Density (procedural + geometry)', min: 0, max: 1, step: 0.01 }, { key: 'secondaryDensity', label: 'Secondary geometry density', min: 0, max: 1, step: 0.01 }, { key: 'length', label: 'Length (procedural + geometry)', min: 0.2, max: 2, step: 0.01 }, { key: 'secondaryLength', label: 'Secondary geometry length', min: 0.2, max: 2, step: 0.01 }, { key: 'thickness', label: 'Primary geometry thickness', min: 0.1, max: 3, step: 0.05 }, { key: 'secondaryThickness', label: 'Secondary geometry thickness', min: 0.1, max: 3, step: 0.05 }, { key: 'curvature', label: 'Curvature (procedural + geometry)', min: 0, max: 1, step: 0.01 }, { key: 'secondaryCurvature', label: 'Secondary geometry curvature', min: 0, max: 1, step: 0.01 }, { key: 'brightness', label: 'Primary brightness', min: 0, max: 2, step: 0.01 }, { key: 'secondaryBrightness', label: 'Secondary brightness', min: 0, max: 2, step: 0.01 }, { key: 'branching', label: 'Branching (procedural + geometry)', min: 0, max: 1, step: 0.01 }, { key: 'glow', label: 'Primary glow', min: 0, max: 2, step: 0.01 }, { key: 'secondaryGlow', label: 'Secondary glow', min: 0, max: 2, step: 0.01 }, { key: 'colorVariation', label: 'Primary color variation', min: 0, max: 1, step: 0.01 }, { key: 'secondaryColorVariation', label: 'Secondary color variation', min: 0, max: 1, step: 0.01 }, { key: 'movement', label: 'Primary movement', min: 0, max: 1, step: 0.01 }, { key: 'secondaryMovement', label: 'Secondary movement', min: 0, max: 1, step: 0.01 }, { key: 'opacity', label: 'Procedural fiber opacity', min: 0, max: 1, step: 0.01 }, { key: 'noiseScale', label: 'Noise scale', min: 1, max: 16, step: 0.1 }, { key: 'fineFrequency', label: 'Fine fiber frequency', min: 12, max: 160, step: 1 }, { key: 'coarseFrequency', label: 'Coarse fiber frequency', min: 3, max: 40, step: 1 }, { key: 'radialAlignment', label: 'Radial alignment', min: 0, max: 1, step: 0.01 }, { key: 'depth', label: 'Fiber depth', min: 0, max: 0.08, step: 0.001 }, { key: 'animationSpeed', label: 'Fiber animation speed', min: 0, max: 0.25, step: 0.001 },
  ] },
  { id: 'memorySignal', title: '07  Memory Signal capture', controls: [
    { key: 'maxPoints', label: 'Maximum sampled particles', min: 50000, max: 400000, step: 10000 }, { key: 'zRelief', label: 'Brightness Z-relief', min: 0, max: 0.4, step: 0.005 }, { key: 'noiseStrength', label: 'Curl noise strength', min: 0, max: 0.2, step: 0.001 }, { key: 'edgeDiffusion', label: 'Edge diffusion', min: 0, max: 2, step: 0.01 }, { key: 'brightnessThreshold', label: 'Brightness threshold', min: 0, max: 0.6, step: 0.005 }, { key: 'backgroundThreshold', label: 'Edge background tolerance', min: 0, max: 1, step: 0.01 }, { key: 'alphaThreshold', label: 'Alpha cutoff', min: 0, max: 1, step: 0.01 }, { key: 'colorIntensity', label: 'Color intensity', min: 0, max: 2, step: 0.01 }, { key: 'scatter', label: 'Particle scatter', min: 0, max: 0.2, step: 0.001 },
  ] },
  { id: 'effects', title: '07  Effects & performance', controls: [
    { key: 'mix', label: 'Natural → Cinematic', min: 0, max: 1, step: 0.01 }, { key: 'glow', label: 'Glow', min: 0, max: 2, step: 0.01 }, { key: 'glowColor', label: 'Glow color' }, { key: 'bloomThreshold', label: 'Bloom threshold', min: 0, max: 2, step: 0.01 }, { key: 'bloomRadius', label: 'Bloom radius', min: 0, max: 1, step: 0.01 }, { key: 'exposure', label: 'Exposure', min: 0.3, max: 2, step: 0.01 }, { key: 'toneMapping', label: 'Tone mapping (0 None / 1 Reinhard / 2 ACES)', min: 0, max: 2, step: 1 }, { key: 'antialias', label: 'Antialiasing' }, { key: 'dpr', label: 'DPR limit', min: 0.5, max: 2, step: 0.1 }, { key: 'paused', label: 'Pause motion' },
  ] },
  { id: 'layers', title: '08  Layer visibility', controls: [
    { key: 'eyeball', label: 'Eyeball' }, { key: 'iris', label: 'Iris texture' }, { key: 'pupil', label: 'Pupil' }, { key: 'cornea', label: 'Cornea' }, { key: 'eyelids', label: 'Eyelids' }, { key: 'eyelashes', label: 'Eyelashes' }, { key: 'primaryFibers', label: 'Primary fibers' }, { key: 'secondaryFibers', label: 'Secondary fibers' }, { key: 'microParticles', label: 'Legacy eye particles' }, { key: 'highlightParticles', label: 'Highlight particles' }, { key: 'atmosphericGlow', label: 'Atmospheric glow' }, { key: 'memorySignal', label: 'Memory Signal particles' }, { key: 'proceduralFibers', label: 'Fire Eye fBm fibers' }, { key: 'bloom', label: 'Bloom' },
  ] },
  { id: 'colorGrading', title: '09 Iris Color Grading', controls: [
    { key: 'enabled', label: 'Enable Color Grading' }, { key: 'strength', label: 'Grading Strength', min: 0, max: 1, step: 0.01 },
    { key: 'mainBlueColor', label: 'Main Blue' }, { key: 'targetBlueHue', label: 'Target Blue Hue', min: 0, max: 360, step: 1 }, { key: 'blueChroma', label: 'Blue Chroma', min: 0, max: 0.4, step: 0.001 },
    { key: 'grayRecolorStrength', label: 'Gray Recolor Strength', min: 0, max: 1, step: 0.01 }, { key: 'lightnessPreservation', label: 'Original Lightness Preservation', min: 0, max: 1, step: 0.01 },
    { key: 'brightness', label: 'Brightness', min: -0.25, max: 0.25, step: 0.005 }, { key: 'contrast', label: 'Contrast', min: 0.5, max: 1.5, step: 0.01 },
    { key: 'innerZoneRadius', label: 'Inner Zone Radius', min: 0.08, max: 0.45, step: 0.005 }, { key: 'amberColor', label: 'Amber' },
    { key: 'amberHue', label: 'Amber Hue', min: 0, max: 360, step: 1 }, { key: 'amberChroma', label: 'Amber Chroma', min: 0, max: 0.4, step: 0.001 },
    { key: 'amberPreservation', label: 'Amber Preservation', min: 0, max: 1, step: 0.01 }, { key: 'amberTransitionWidth', label: 'Amber Transition Width', min: 0.04, max: 0.16, step: 0.005 },
    { key: 'middleBlueHue', label: 'Middle Blue Hue', min: 0, max: 360, step: 1 }, { key: 'middleBlueChroma', label: 'Middle Blue Chroma', min: 0, max: 0.4, step: 0.001 },
    { key: 'middleColorStrength', label: 'Middle Color Strength', min: 0, max: 1, step: 0.01 },
    { key: 'outerZoneStart', label: 'Outer Zone Start', min: 0.45, max: 0.98, step: 0.005 }, { key: 'outerBlueColor', label: 'Outer Blue' },
    { key: 'outerBlueHue', label: 'Outer Blue Hue', min: 0, max: 360, step: 1 }, { key: 'outerBlueChroma', label: 'Outer Blue Chroma', min: 0, max: 0.4, step: 0.001 },
    { key: 'outerColorStrength', label: 'Outer Color Strength', min: 0, max: 1, step: 0.01 }, { key: 'darkRimColor', label: 'Dark Rim' },
    { key: 'limbalRingHue', label: 'Limbal Ring Hue', min: 0, max: 360, step: 1 }, { key: 'limbalRingChroma', label: 'Limbal Ring Chroma', min: 0, max: 0.4, step: 0.001 },
    { key: 'limbalRingDarkness', label: 'Limbal Ring Darkness', min: 0, max: 0.5, step: 0.01 },
    { key: 'fiberArtisticColor', label: 'Fiber Artistic Color' }, { key: 'fiberArtisticMix', label: 'Fiber Artistic Mix', min: 0, max: 1, step: 0.01 },
  ] },
]
const CONFIG_KEY = 'iris-lab-config-v1'
const PRESETS_KEY = 'iris-lab-presets-v1'
const BLUE_MASK_KEY = 'iris-lab-blue-mask-v1'
function readConfig(): LabConfig {
  try { const raw = localStorage.getItem(CONFIG_KEY); return raw ? parseConfig(JSON.parse(raw)) : structuredClone(defaults) } catch { return structuredClone(defaults) }
}
function readPresets(): Record<string, LabConfig> {
  try {
    const source: unknown = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}')
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
    return Object.fromEntries(Object.entries(source).map(([name, value]) => [name, parseConfig(value)]))
  } catch { return {} }
}
const initialStats: LabStats = { fps: 0, drawCalls: 0, particles: 0, geometries: 0, textures: 0, dpr: 1, status: 'Loading assets…' }
export function IrisLab() {
  const [config, setConfig] = useState(readConfig)
  const [presets, setPresets] = useState(readPresets)
  const [selected, setSelected] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState(initialStats)
  const [diagnostic, setDiagnostic] = useState<'eye' | 'color' | 'authentic' | 'confidence' | 'particles'>('eye')
  const [photoSource, setPhotoSource] = useState<string | null>(null)
  const [memoryCount, setMemoryCount] = useState(0)
  const [gradingPreset, setGradingPreset] = useState(() => identifyIrisGradingPreset(config.colorGrading))
  const [preview, setPreview] = useState<IrisPreviewState>({ previewGrading: true, albedoOnly: false })
  const importRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const maskImageSource = resolveIrisPhotoSource(config.display.mode, photoSource, import.meta.env.DEV)
  const cameraReader = useRef<(() => CameraConfig) | null>(null)
  const currentConfigRef = useRef(config)
  useEffect(() => { currentConfigRef.current = config }, [config])
  useEffect(() => {
    const saveOnPageHide = () => { try { const current = currentConfigRef.current; localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, camera: cameraReader.current?.() ?? current.camera })) } catch { /* Storage may be unavailable during page teardown. */ } }
    window.addEventListener('pagehide', saveOnPageHide)
    return () => window.removeEventListener('pagehide', saveOnPageHide)
  }, [])
  const registerCameraReader = useCallback((reader: (() => CameraConfig) | null) => { cameraReader.current = reader }, [])
  const currentConfig = (): LabConfig => ({ ...config, camera: cameraReader.current?.() ?? config.camera })
  useEffect(() => { let active = true; try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch { queueMicrotask(() => { if (active) setMessage('Local storage unavailable: export settings to keep them.') }) } return () => { active = false } }, [config])
  useEffect(() => { let active = true; try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)) } catch { queueMicrotask(() => { if (active) setMessage('Could not save presets in local storage.') }) } return () => { active = false } }, [presets])
  const apply = (next: LabConfig) => { setConfig(structuredClone(next)); setGradingPreset(identifyIrisGradingPreset(next.colorGrading)); setRevision((n) => n + 1) }
  const changeMode = (mode: LabConfig['display']['mode']) => setConfig((old) => applyViewMode(old, mode))
  const update = (group: Group, key: string, value: string | number | boolean) => {
    if (group === 'display' && key === 'mode') { changeMode(value as LabConfig['display']['mode']); return }
    if (group === 'colorGrading') {
      setConfig((old) => ({
        ...old,
        colorGrading: typeof value === 'string'
          ? updateGradingColor(old.colorGrading, key as Parameters<typeof updateGradingColor>[1], value)
          : updateGradingSetting(old.colorGrading, key as keyof IrisColorGrading, value),
      }))
      setGradingPreset('Manual')
      return
    }
    setConfig((old) => ({ ...old, [group]: { ...old[group], [key]: value } }))
    if (group === 'camera') setRevision((n) => n + 1)
  }
  const changeCamera = (camera: CameraConfig) => setConfig((old) => ({ ...old, camera }))
  const download = (name: string, blob: Blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  const save = () => { const name = window.prompt('Preset name'); if (!name?.trim()) return; if (name.trim() in builtInPresets) { setMessage('Choose a different name; built-in presets are protected.'); return }; setPresets((old) => ({ ...old, [name.trim()]: structuredClone(currentConfig()) })); setSelected(name.trim()); setMessage('Preset saved locally.') }
  const saveBlueMask = () => { try { localStorage.setItem(BLUE_MASK_KEY, JSON.stringify(config.blueEye)); setMessage('Iris and pupil masks saved locally.') } catch { setMessage('Could not save iris masks in local storage.') } }
  const loadBlueMask = () => { try { const raw = localStorage.getItem(BLUE_MASK_KEY); if (!raw) throw new Error('No saved iris mask'); const next = parseConfig({ ...config, blueEye: JSON.parse(raw) }); setConfig(next); setMessage('Saved iris and pupil masks restored.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Mask restore failed') } }
  useEffect(() => () => { if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current) }, [])
  const chooseImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage('Choose a PNG, JPEG, or WebP image.'); return }
    if (file.size > 40 * 1024 * 1024) { setMessage('Image is larger than 40 MB.'); return }
    const url = URL.createObjectURL(file)
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = url; setPhotoSource(url); setMessage('Image loaded locally. It is not uploaded or saved with presets.')
  }
  return <div className="iris-lab">
    <header className="lab-topbar"><div><span className="lab-kicker">A LITTLE UNIVERSE / DEV</span><h1>Iris Visual Lab</h1></div>
      <div className="lab-actions"><select aria-label="Preset" value={selected} onChange={(event) => { const name = event.target.value; setSelected(name); const preset = presets[name] ?? builtInPresets[name]; if (preset) apply(preset) }}><option value="">Presets</option>{Object.keys(builtInPresets).map((name) => <option key={name}>{name}</option>)}{Object.keys(presets).map((name) => <option key={name}>{name}</option>)}</select>
        <button disabled={config.display.mode === 'Run 017 Blue Fibers'} onClick={() => imageRef.current?.click()}>{config.display.mode === 'Run 017 Blue Fibers' ? 'Run 017 iris source' : photoSource ? 'Change image' : 'Load eye image'}</button><input ref={imageRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = '' }} />{photoSource && config.display.mode !== 'Run 017 Blue Fibers' && <button onClick={() => { if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current); photoUrlRef.current = null; setPhotoSource(null); setMessage('The bundled eye photo is available in photo-iris modes; Original uses the 3D model.') }}>Use default source</button>}
        <button onClick={save}>Save preset</button><button onClick={() => { try { localStorage.setItem("iris-lab-camera-v1", JSON.stringify(currentConfig().camera)); setMessage("Camera saved locally.") } catch { setMessage("Could not save camera locally.") } }}>Save camera</button><button onClick={() => { try { const raw = localStorage.getItem("iris-lab-camera-v1"); if (!raw) throw new Error("No saved camera"); const next = parseConfig({ ...config, camera: JSON.parse(raw) }); apply(next); setMessage("Camera restored.") } catch (error) { setMessage(error instanceof Error ? error.message : "Camera restore failed") } }}>Load camera</button><button onClick={() => { apply(defaults); setGradingPreset('Original'); setSelected(''); setMessage('Defaults restored.') }}>Reset</button><button onClick={() => download('iris-lab-settings.json', new Blob([JSON.stringify(currentConfig(), null, 2)], { type: 'application/json' }))}>Export</button><button onClick={() => importRef.current?.click()}>Import</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { apply(parseConfig(JSON.parse(await file.text()))); setMessage('Settings imported.') } catch (error) { setMessage(`Import failed: ${error instanceof Error ? error.message : 'invalid JSON'}`) } event.target.value = '' }} />
        <button onClick={() => { const canvas = document.querySelector<HTMLCanvasElement>('.lab-viewport canvas'); if (!canvas) { setMessage('Viewport unavailable.'); return } canvas.toBlob((blob) => { if (blob) download('iris-lab.png', blob); else setMessage('Screenshot unavailable.') }, 'image/png') }}>Screenshot</button><button aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? 'Hide controls' : 'Show controls'}</button></div>
    </header>
    <main className="lab-layout"><section className="lab-stage"><div className="lab-viewport"><EyeViewport config={config} cameraView={revision} diagnostic={diagnostic} previewGrading={preview.previewGrading} albedoOnly={preview.albedoOnly} imageSource={photoSource} onMemorySignalCount={setMemoryCount} onBaselineStatus={setMessage} onCameraChange={changeCamera} onCameraReader={registerCameraReader} onStats={setStats} /></div>
      {!isPhotoIrisMode(config.display.mode) && <select className="lab-diagnostic" aria-label="Diagnostic view" value={diagnostic} onChange={(event) => setDiagnostic(event.target.value as typeof diagnostic)}><option value="eye">Eye model</option><option value="color">Color texture</option><option value="authentic">Authentic texture</option><option value="confidence">Confidence map</option><option value="particles">Raw particles</option></select>}<div className="lab-stage-top"><span>{isPhotoIrisMode(config.display.mode) ? config.display.mode.toUpperCase() : 'RUN_017 / VASILISA'}</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
      <div className="lab-views">{Object.entries(cameraViews).map(([name, view]) => <button key={name} onClick={() => { setConfig((old) => ({ ...old, camera: { ...view } })); setRevision((n) => n + 1) }}>{name}</button>)}<button onClick={() => changeMode(config.display.mode === 'Hybrid' ? 'Original' : 'Hybrid')}>Original ↔ Hybrid</button></div>
      <div className="lab-status" aria-live="polite"><span>{stats.status}</span><span>{stats.fps.toFixed(0)} FPS</span><span>{stats.drawCalls} draws</span><span>{stats.particles.toLocaleString()} visible particles</span><span>{memoryCount.toLocaleString()} source photo points</span><span>{stats.geometries} geometries · {stats.textures} textures</span><span>DPR {stats.dpr.toFixed(1)}</span></div>
      {message && <div role="status" className="lab-message">{message}<button aria-label="Dismiss" onClick={() => setMessage('')}>×</button></div>}
    </section>{panelOpen && <aside className="lab-panel"><div className="lab-panel-heading"><div><span className="lab-kicker">LOOK DEVELOPMENT</span><h2>Parameters</h2></div><span>01 / 11</span></div>
      {groups.map((group, index) => <details key={group.id} open={index === 0 || group.id === 'blueEye' || index === 9 || index === 10}><summary>{group.title}</summary><div className="lab-controls">
        {group.id === 'colorGrading' && <>
          <label className="lab-control"><span>Grading preset</span><select aria-label="Iris grading preset" value={gradingPreset} onChange={(event) => { const name = event.target.value as keyof typeof irisGradingPresets | 'Manual'; setGradingPreset(name); if (name !== 'Manual') setConfig((old) => ({ ...old, colorGrading: { ...irisGradingPresets[name] } })) }}><option>Manual</option>{Object.keys(irisGradingPresets).map((name) => <option key={name}>{name}</option>)}</select></label>
          <div className="lab-preview-toggles">
            <button type="button" aria-pressed={!preview.previewGrading} onClick={() => setPreview((state) => toggleIrisPreview(state, 'previewGrading'))}>Before / After <strong>{preview.previewGrading ? 'After' : 'Before'}</strong></button>
            <button type="button" aria-pressed={preview.albedoOnly} onClick={() => setPreview((state) => toggleIrisPreview(state, 'albedoOnly'))}>{preview.albedoOnly ? 'Full Eye' : 'Albedo Only / Color Inspection'}</button>
          </div>
        </>}
        {group.id === 'effects' && <label className="lab-control"><span>Quality profile</span><select aria-label="Quality profile" defaultValue="" onChange={(event) => { const quality = event.target.value; if (!quality) return; const values = quality === 'Low' ? [0.8, 0.25, 0.25] : quality === 'High' ? [2, 1, 1] : [1.5, 0.5, 0.5]; setConfig((old) => ({ ...old, effects: { ...old.effects, dpr: values[0]! }, particles: { ...old.particles, density: values[1]! }, fibers: { ...old.fibers, density: values[2]!, secondaryDensity: values[2]! } })) }}><option value="">Custom</option><option>Low</option><option>Standard</option><option>High</option></select></label>}
        {group.id === 'blueEye' && <>
          {isPhotoIrisMode(config.display.mode) && <IrisMaskEditor source={maskImageSource} settings={config.blueEye} onChange={(blueEye) => setConfig((old) => ({ ...old, blueEye }))} />}
          <div className="lab-preview-toggles"><button type="button" onClick={saveBlueMask}>Save iris mask</button><button type="button" onClick={loadBlueMask}>Load iris mask</button></div>
        </>}
        <button className="lab-reset" onClick={() => { setConfig((old) => ({ ...old, [group.id]: group.id === 'colorGrading' ? structuredClone(irisGradingPresets.Original) : structuredClone(defaults[group.id]) })); if (group.id === 'camera') setRevision((n) => n + 1); if (group.id === 'colorGrading') setGradingPreset('Original') }}>{group.id === 'colorGrading' ? 'Reset Color Grading' : 'Reset group'}</button>
        {group.controls.map((control) => {
          const value = (config[group.id] as unknown as Record<string, string | number | boolean>)[control.key]
          const isPercent = group.id === 'colorGrading' && ['strength', 'grayRecolorStrength', 'lightnessPreservation', 'amberPreservation', 'middleColorStrength', 'outerColorStrength', 'fiberArtisticMix'].includes(control.key)
          const isHue = group.id === 'colorGrading' && control.key.toLowerCase().includes('hue')
          const isChroma = group.id === 'colorGrading' && control.key.toLowerCase().includes('chroma')
          const min = group.id === 'colorGrading' && control.key === 'outerZoneStart'
            ? Math.max(control.min ?? 0, config.colorGrading.innerZoneRadius + config.colorGrading.amberTransitionWidth * 2)
            : control.min
          const displayValue = typeof value !== 'number' ? '' : isPercent ? `${Math.round(value * 100)}%` : isHue ? `${value.toFixed(0)}°` : isChroma ? value.toFixed(3) : (control.step ?? 0) >= 1 ? value.toFixed(0) : value.toFixed(2)
          return <label key={control.key} className="lab-control"><span>{control.label}</span>{typeof value === 'boolean' ? <input type="checkbox" checked={value} onChange={(event) => update(group.id, control.key, event.target.checked)} /> : typeof value === 'string' && control.options ? <select aria-label={control.label} value={value} onChange={(event) => update(group.id, control.key, event.target.value)}>{control.options.map((option) => <option key={option}>{option}</option>)}</select> : typeof value === 'string' ? <input aria-label={control.label} type="color" value={value} onChange={(event) => update(group.id, control.key, event.target.value)} /> : <div className="lab-range"><input aria-label={control.label} type="range" min={min} max={control.max} step={control.step} value={value} onChange={(event) => update(group.id, control.key, Number(event.target.value))} /><output>{displayValue}</output></div>}</label>
        })}
      </div></details>)}
    </aside>}</main>
  </div>
}


