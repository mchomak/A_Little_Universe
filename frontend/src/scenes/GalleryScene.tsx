import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { galleryColumnOpacity, galleryDistanceOpacity, galleryFocusOpacity, galleryFocusedPhotoDistanceOpacity } from './gallery/visibility'
import { galleryPhotoBlurAtFocus, galleryPhotoLightAtFocus } from './gallery/artDirection'
import { createFrameParticleGeometry } from './gallery/frameParticles'
import { getGalleryCaptionLayout, GALLERY_CAPTION_CANVAS_WIDTH, GALLERY_CAPTION_GAP, GALLERY_CAPTION_HORIZONTAL_PADDING, GALLERY_CAPTION_PLANE_WIDTH, type GalleryCaptionLayout } from './gallery/captionLayout'
import { createGalleryDustGeometry, getGalleryDustCount } from './gallery/dust'
import type { GalleryArtSettings } from './gallery/reflections'
import { createMemoryThreadAccentGeometry, createMemoryThreadGeometry, createMemoryThreadMaterial, createMemoryThreadPaths, GALLERY_MEMORY_RENDER_ORDER, GALLERY_THREAD_RENDER_ORDER, memoryThreadOpacity, updateMemoryThreadMaterial } from './gallery/threads'
import { GALLERY_WORLD } from './gallery/world'
import { createGalleryWaterReflectionBackplate } from './gallery/galleryBackplate'
import { getMoonFrameTintStrength, getMoonPhotoIllumination } from './gallery/moonLighting'
import { advanceCollageRevealPlayback, createCollageRevealGeometry, createCollageRevealGeometryFromSignal, createCollageRevealPlayback, DEFAULT_COLLAGE_REVEAL_SETTINGS, getCollageParticleRasterDimensions, getCollageRevealPlaybackFrame, getFocusedGalleryCollagePhotos, getGalleryCollagePhotoLayout, markCollageRevealTextureReady, type CollageRevealPlayback, type CollageRevealSettings } from './gallery/collage'
import { getGalleryCollageConfig } from './gallery/galleryCollageConfig'
import { setGalleryPhotoAspect } from './gallery/galleryCameraFit'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, DataTexture, DoubleSide, Group, LinearFilter, Material, Mesh, MeshBasicMaterial, NoColorSpace, Points, PointsMaterial, RedFormat, SRGBColorSpace, Texture, TextureLoader, UnsignedByteType, Vector2, Vector3, ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { useSyncExternalStore } from 'react'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { GALLERY, GALLERY_MEMORIES, PLANETARIUM_GALLERY_EVENT_ID, galleryColumnPositions, galleryPhotoApproachYaw, galleryPhotoYaw, gallerySupportColumnOffsetX, gallerySupportGroupScale, gallerySupportLocalPositions, type GalleryMemory } from './gallery/content'
import { getGalleryPhotoPosition } from './gallery/archPlacement'
import { GalleryColumn } from './gallery/GalleryColumn'
import { GalleryArch } from './gallery/GalleryArch'
import { galleryFocus, galleryMotion, galleryPhotoRaycast, gallerySnapshot, resetGallery, subscribeGallery } from './gallery/controller'
import { bindGalleryGestures } from './gallery/gestures'
import { MoonlitWorld } from './gallery/MoonlitWorld'
import { createProgressivePhotoRevealMap, progressivePhotoRevealGLSL } from './shared/progressivePhotoReveal'
import { processMemorySignalBaselinePixels, type MemorySignalBaselineSample } from '../iris-lab/memorySignalBaseline'
import firstPhotoUrl from '../assets/start_img.jpg'
import { ART_FONT_CATALOG, loadArtFont } from '../systems/scene-config/fontCatalog'
import type { ArtFontId } from '../systems/scene-config/fontIds'
import { capturePlanetariumPhotoRect, registerPlanetariumPhotoTexture, releasePlanetariumPhotoTexture } from './gallery/planetariumTransition'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 768, h = 768) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!; draw(ctx, w, h)
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture
}
function captionTexture(layout: GalleryCaptionLayout, titleFontFamily: string) {
  return canvasTexture((ctx, width) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let y = layout.verticalPadding
    if (layout.titleLines.length) {
      ctx.fillStyle = '#d8c5b7'
      ctx.font = `400 ${layout.titleFontSize}px "${titleFontFamily}", Georgia, serif`
      for (const line of layout.titleLines) {
        ctx.fillText(line, width / 2, y, width - GALLERY_CAPTION_HORIZONTAL_PADDING * 2)
        y += layout.titleLineHeight
      }
    }
    if (layout.captionLines.length) {
      if (layout.titleLines.length) y += layout.sectionGap
      ctx.fillStyle = '#f5dbc9'
      ctx.font = `${layout.bodyFontSize}px Georgia, serif`
      for (const line of layout.captionLines) {
        ctx.fillText(line, width / 2, y, width - GALLERY_CAPTION_HORIZONTAL_PADDING * 2)
        y += layout.bodyLineHeight
      }
    }
  }, GALLERY_CAPTION_CANVAS_WIDTH, layout.canvasHeight)
}
function setColorSpace(texture: Texture) { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true }
function getFocusedGalleryOrder() { return gallerySnapshot().focus }
function getServerFocusedGalleryOrder() { return null }
function setShaderUniform(material: ShaderMaterial | null, name: string, value: unknown) {
  const uniform = material?.uniforms[name]
  if (uniform) uniform.value = value
}
const FRAME_CONTOUR_BASE_COLOR = new Color('#f4dcc0')
const FRAME_HALO_BASE_COLOR = new Color('#efcba8')
const photoVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const photoFragmentShader = `
  uniform sampler2D map;
  uniform float uAlpha;
  uniform float uBlur;
  uniform float uLight;
  uniform float uMoonIllumination;
  uniform vec3 uMoonColor;
  varying vec2 vUv;
  void main() {
    vec2 blur = vec2(0.0065 * uBlur);
    vec4 sharp = texture2D(map, vUv);
    vec4 soft = sharp * 4.0;
    soft += texture2D(map, vUv + vec2(blur.x, 0.0));
    soft += texture2D(map, vUv - vec2(blur.x, 0.0));
    soft += texture2D(map, vUv + vec2(0.0, blur.y));
    soft += texture2D(map, vUv - vec2(0.0, blur.y));
    soft += texture2D(map, vUv + blur * 0.72);
    soft += texture2D(map, vUv - blur * 0.72);
    soft /= 10.0;
    vec4 photo = mix(sharp, soft, uBlur);
    vec2 spotUv = vec2((vUv.x - 0.5) / 0.72, (vUv.y - 0.68) / 0.88);
    float spot = pow(max(0.0, 1.0 - dot(spotUv, spotUv)), 2.0);
    photo.rgb *= 1.0 + spot * uLight;
    vec3 lunarTint = mix(vec3(1.0), uMoonColor, 0.28);
    photo.rgb = mix(photo.rgb, photo.rgb * lunarTint, clamp(uMoonIllumination * 0.65, 0.0, 0.22));
    photo.rgb *= 1.0 + uMoonIllumination;
    gl_FragColor = vec4(photo.rgb, uAlpha);
    #include <colorspace_fragment>
  }
`
const frameVertexShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFocus;
  attribute vec2 normal2d;
  attribute float size;
  attribute float phase;
  attribute float speed;
  attribute float particleAlpha;
  attribute float mobility;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 moved = position;
    moved.xy += normal2d * sin(uTime * speed + phase) * 0.016 * mobility;
    vec4 view = modelViewMatrix * vec4(moved, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = size * 300.0 / max(1.0, -view.z);
    float shimmer = 0.68 + 0.32 * sin(uTime * speed + phase);
    vColor = color;
    vAlpha = particleAlpha * shimmer * (1.0 + 0.16 * uFocus) * uOpacity;
  }
`
const frameFragmentShader = `
  uniform float uMoonTintStrength;
  uniform vec3 uMoonColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5);
    float point = 1.0 - smoothstep(0.12, 0.5, radius);
    vec3 color = mix(vColor, uMoonColor, uMoonTintStrength);
    gl_FragColor = vec4(color, point * vAlpha);
  }
`
function photoShaderMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, uAlpha: { value: 1 }, uBlur: { value: 0 }, uLight: { value: 0.04 }, uMoonIllumination: { value: 0 }, uMoonColor: { value: new Color('#C3D8F2') } },
    vertexShader: photoVertexShader,
    fragmentShader: photoFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}
const collageParticleVertexShader = `
  uniform sampler2D uPhoto;
  uniform sampler2D uRevealMap;
  uniform float uTime;
  uniform float uReveal;
  uniform float uPhotoReveal;
  uniform float uAlpha;
  uniform float uParticleSize;
  uniform float uNoiseStrength;
  uniform float uDpr;
  uniform vec2 uBounds;
  attribute vec3 targetPosition;
  attribute float size;
  attribute float phase;
  attribute vec2 photoUv;
  attribute float edgeFactor;
  varying vec2 vPhotoUv;
  varying vec3 vPhotoColor;
  varying float vBrightness;
  varying float vAlpha;
  ${progressivePhotoRevealGLSL}
  void main() {
    float reveal = smoothstep(0.0, 1.0, uReveal);
    vec3 moved = mix(position, targetPosition, reveal);
    float phaseTime = uTime * 1.7 + phase;
    vec2 flow = vec2(
      sin(phaseTime + targetPosition.y * 1.4),
      cos(phaseTime * 0.83 + targetPosition.x * 1.1)
    );
    flow += 0.35 * vec2(
      cos(phaseTime * 0.47 + targetPosition.y * 0.8),
      sin(phaseTime * 0.61 + targetPosition.x * 1.3)
    );
    float motion = uNoiseStrength * (0.45 + edgeFactor) * mix(1.0, 0.5, reveal);
    vec2 drift = flow * motion;
    moved.xy = clamp(moved.xy + drift, -uBounds * 0.5, uBounds * 0.5);
    moved.z += sin(phaseTime * 0.7 + targetPosition.x * 0.9) * motion * 0.22;
    vec3 photoColor = texture2D(uPhoto, photoUv).rgb;
    float brightness = dot(photoColor, vec3(0.2126, 0.7152, 0.0722));
    float arrival = texture2D(uRevealMap, photoUv).r;
    float particleVisibility = progressivePhotoParticleOpacity(uPhotoReveal, arrival);
    vPhotoUv = photoUv;
    vPhotoColor = photoColor;
    vBrightness = brightness;
    vec4 view = modelViewMatrix * vec4(moved, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uParticleSize * uDpr * size * mix(0.62, 1.32, brightness);
    vAlpha = uAlpha * smoothstep(0.005, 0.055, brightness) * particleVisibility;
  }
`
const collageParticleFragmentShader = `
  uniform sampler2D uPhoto;
  uniform float uGlow;
  varying vec2 vPhotoUv;
  varying vec3 vPhotoColor;
  varying float vBrightness;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5);
    float point = 1.0 - smoothstep(0.08, 0.5, radius);
    vec3 sampledColor = texture2D(uPhoto, vPhotoUv).rgb;
    vec3 color = mix(vPhotoColor, sampledColor, 0.5) * (0.75 + uGlow * 0.45);
    gl_FragColor = vec4(color, point * vAlpha * mix(0.2, 1.0, vBrightness));
    #include <colorspace_fragment>
  }
`
function collageParticleMaterial(map: Texture, bounds: Vector2) {
  return new ShaderMaterial({
    uniforms: {
      uPhoto: { value: map }, uRevealMap: { value: null }, uTime: { value: 0 }, uReveal: { value: 0 }, uPhotoReveal: { value: 0 }, uAlpha: { value: 0 },
      uParticleSize: { value: DEFAULT_COLLAGE_REVEAL_SETTINGS.particleSize },
      uNoiseStrength: { value: DEFAULT_COLLAGE_REVEAL_SETTINGS.noiseStrength },
      uDpr: { value: 1 }, uBounds: { value: bounds }, uGlow: { value: DEFAULT_COLLAGE_REVEAL_SETTINGS.glow },
    },
    vertexShader: collageParticleVertexShader,
    fragmentShader: collageParticleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}
const collagePhotoFragmentShader = `
  uniform sampler2D uPhoto;
  uniform sampler2D uRevealMap;
  uniform float uAlpha;
  uniform float uReveal;
  varying vec2 vUv;
  ${progressivePhotoRevealGLSL}
  void main() {
    vec3 original = texture2D(uPhoto, vUv).rgb;
    vec3 photo = progressivePhotoCellColor(vUv, uReveal, original);
    float arrival = texture2D(uRevealMap, vUv).r;
    float coverage = progressivePhotoRevealCoverage(uReveal, arrival);
    gl_FragColor = vec4(photo, uAlpha * progressivePhotoRevealAlpha(uReveal) * coverage);
    #include <colorspace_fragment>
  }
`
function collagePhotoMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: { uPhoto: { value: map }, uRevealMap: { value: null }, uAlpha: { value: 0 }, uReveal: { value: 0 } },
    vertexShader: photoVertexShader,
    fragmentShader: collagePhotoFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}
function CollageExtraPhoto({ memoryId, url, slot, side, mainWidth, mainHeight, fallback, focusVisual, seed, photoScale, photoGap, layoutVariant, settings = DEFAULT_COLLAGE_REVEAL_SETTINGS, reducedMotion, paused }: {
  memoryId: string
  url: string
  slot: 2 | 3 | 4
  side: -1 | 1
  mainWidth: number
  mainHeight: number
  fallback: Texture
  focusVisual: RefObject<{ alpha: number; focusAmount: number; timelineDirection: -1 | 0 | 1 }>
  seed: number
  photoScale: number
  photoGap: number
  layoutVariant: 'on-columns' | 'between-columns'
  settings?: Readonly<CollageRevealSettings>
  reducedMotion: boolean
  paused: boolean
}) {
  const [aspect, setAspect] = useState(1)
  const photoSession = useMemo(() => ({ url, fallback }), [fallback, url])
  const [photoResult, setPhotoResult] = useState<{ session: object; failed: boolean } | null>(null)
  const [particleSignal, setParticleSignal] = useState<{ session: object; sample: MemorySignalBaselineSample | null } | null>(null)
  const dpr = useThree((state) => state.viewport.dpr)
  const backplateMaterial = useRef<MeshBasicMaterial>(null)
  const layout = useMemo(() => getGalleryCollagePhotoLayout(slot, side, mainWidth, mainHeight, aspect, {
    photoScale,
    photoGap,
  }, layoutVariant), [aspect, layoutVariant, mainHeight, mainWidth, photoGap, photoScale, side, slot])
  const revealMap = useMemo(() => {
    const size = 128
    const texture = new DataTexture(createProgressivePhotoRevealMap(size, aspect), size, size, RedFormat, UnsignedByteType)
    texture.colorSpace = NoColorSpace
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  }, [aspect])
  const photoMaterial = useMemo(() => collagePhotoMaterial(fallback), [fallback])
  const particlesEnabled = settings.particleEnabled && !reducedMotion
  const particleCount = settings.particleCount
  const particleSampleReady = photoResult?.session === photoSession && photoResult.failed
    || particleSignal?.session === photoSession
  const photoReady = photoResult?.session === photoSession && (!particlesEnabled || particleSampleReady)
  const signalSample = particleSampleReady ? particleSignal?.sample ?? null : null
  const particleGeometrySettings = useMemo(() => ({ depth: settings.depth }), [settings.depth])
  const particles = useMemo(() => {
    if (!particlesEnabled) return new BufferGeometry()
    if (!particleSampleReady) return new BufferGeometry()
    return signalSample
      ? createCollageRevealGeometryFromSignal(signalSample, layout.width, layout.height, seed, particleGeometrySettings, particleCount)
      : createCollageRevealGeometry(layout.width, layout.height, seed, particleCount, particleGeometrySettings)
  }, [layout.height, layout.width, particleCount, particleGeometrySettings, particleSampleReady, particlesEnabled, seed, signalSample])
  const bounds = useMemo(() => new Vector2(), [])
  const revealMaterial = useMemo(() => particlesEnabled ? collageParticleMaterial(fallback, bounds) : null, [bounds, fallback, particlesEnabled])
  const revealMaterialRef = useRef<ShaderMaterial | null>(null)
  const loadedPhoto = useRef<Texture>(fallback)
  const initialPlayback = useMemo(() => createCollageRevealPlayback(photoSession), [photoSession])
  const playback = useRef<CollageRevealPlayback>(initialPlayback)
  const previousFilmTime = useRef(galleryMotion.time)

  useEffect(() => {
    revealMaterialRef.current = revealMaterial
    setShaderUniform(revealMaterial, 'uPhoto', loadedPhoto.current)
    setShaderUniform(revealMaterial, 'uRevealMap', revealMap)
    return () => { if (revealMaterialRef.current === revealMaterial) revealMaterialRef.current = null }
  }, [revealMap, revealMaterial])
  useEffect(() => { setShaderUniform(photoMaterial, 'uRevealMap', revealMap) }, [photoMaterial, revealMap])

  useEffect(() => {
    let active = true
    let loaded: Texture | null = null
    let request: Texture | null = null
    let disposed = false
    const disposeRequest = () => {
      if (disposed) return
      disposed = true
      request?.dispose()
    }
    loadedPhoto.current = fallback
    setShaderUniform(photoMaterial, 'uPhoto', fallback)
    setShaderUniform(revealMaterialRef.current, 'uPhoto', fallback)
    request = new TextureLoader().load(url, (value) => {
      if (!active) { disposeRequest(); return }
      loaded = value
      loadedPhoto.current = value
      setColorSpace(value)
      setShaderUniform(photoMaterial, 'uPhoto', value)
      setShaderUniform(revealMaterialRef.current, 'uPhoto', value)
      const image = value.image as HTMLImageElement
      if (image.naturalWidth && image.naturalHeight) {
        const loadedAspect = image.naturalWidth / image.naturalHeight
        setAspect(loadedAspect)
        setGalleryPhotoAspect(memoryId, slot, loadedAspect)
      }
      playback.current = markCollageRevealTextureReady(playback.current, photoSession, 'loaded')
      setPhotoResult({ session: photoSession, failed: false })
    }, undefined, () => {
      disposeRequest()
      if (active) {
        setShaderUniform(photoMaterial, 'uPhoto', fallback)
        setShaderUniform(revealMaterialRef.current, 'uPhoto', fallback)
        loadedPhoto.current = fallback
        playback.current = markCollageRevealTextureReady(playback.current, photoSession, 'error')
        setPhotoResult({ session: photoSession, failed: true })
      }
    })
    if (disposed) request.dispose()
    return () => {
      active = false
      disposeRequest()
      if (loadedPhoto.current === loaded) {
        loadedPhoto.current = fallback
        setShaderUniform(photoMaterial, 'uPhoto', fallback)
        setShaderUniform(revealMaterialRef.current, 'uPhoto', fallback)
      }
    }
  }, [fallback, memoryId, photoMaterial, photoSession, slot, url])
  useEffect(() => {
    if (!particlesEnabled || photoResult?.session !== photoSession) return
    if (photoResult.failed) return

    let active = true
    try {
      const image = loadedPhoto.current.image as HTMLImageElement
      const dimensions = getCollageParticleRasterDimensions(image.naturalWidth, image.naturalHeight, particleCount)
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas pixel sampling is unavailable')
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
      const sample = processMemorySignalBaselinePixels(
        context.getImageData(0, 0, dimensions.width, dimensions.height).data,
        dimensions.width,
        dimensions.height,
      )
      if (active) setParticleSignal({ session: photoSession, sample })
    } catch {
      if (active) setParticleSignal({ session: photoSession, sample: null })
    }
    return () => { active = false }
  }, [particleCount, particlesEnabled, photoResult, photoSession])
  useEffect(() => () => particles.dispose(), [particles])
  useEffect(() => () => photoMaterial.dispose(), [photoMaterial])
  useEffect(() => () => revealMaterial?.dispose(), [revealMaterial])
  useEffect(() => () => revealMap.dispose(), [revealMap])
  useFrame(() => {
    const now = galleryMotion.time
    const delta = Math.max(0, now - previousFilmTime.current)
    previousFilmTime.current = now
    if (playback.current.session !== photoSession) playback.current = createCollageRevealPlayback(photoSession)
    if (photoReady && !playback.current.textureReady) {
      playback.current = markCollageRevealTextureReady(playback.current, photoSession, photoResult?.failed ? 'error' : 'loaded')
    }
    const { alpha, focusAmount, timelineDirection } = focusVisual.current
    playback.current = advanceCollageRevealPlayback(
      playback.current,
      delta,
      timelineDirection,
      focusAmount,
      slot,
      settings,
      reducedMotion,
      paused || document.hidden,
    )
    const frame = getCollageRevealPlaybackFrame(playback.current, slot, settings, reducedMotion)
    const photoAlpha = photoReady ? alpha * frame.photoOpacity : 0
    if (backplateMaterial.current) backplateMaterial.current.opacity = photoAlpha * 0.92
    setShaderUniform(photoMaterial, 'uAlpha', photoAlpha)
    setShaderUniform(photoMaterial, 'uReveal', frame.photoProgress)
    setShaderUniform(revealMaterial, 'uTime', reducedMotion ? 0 : galleryMotion.time)
    setShaderUniform(revealMaterial, 'uParticleSize', settings.particleSize)
    setShaderUniform(revealMaterial, 'uNoiseStrength', settings.noiseStrength)
    setShaderUniform(revealMaterial, 'uDpr', dpr)
    setShaderUniform(revealMaterial, 'uGlow', settings.glow)
    setShaderUniform(revealMaterial, 'uReveal', frame.assemblyProgress)
    setShaderUniform(revealMaterial, 'uPhotoReveal', frame.photoProgress)
    setShaderUniform(revealMaterial, 'uAlpha', photoReady ? alpha * frame.particleOpacity : 0)
    bounds.set(layout.width, layout.height)
  })

  return <group position={layout.position} visible={photoReady}>
    <mesh position={[0, 0, -0.025]} raycast={() => undefined} userData={{ galleryOpacityManaged: true }}>
      <planeGeometry args={[layout.width + 0.08, layout.height + 0.08]} />
      <meshBasicMaterial ref={backplateMaterial} color="#17141d" transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh raycast={() => undefined} renderOrder={GALLERY_MEMORY_RENDER_ORDER + 1} userData={{ galleryOpacityManaged: true }}>
      <planeGeometry args={[layout.width, layout.height]} />
      <primitive object={photoMaterial} attach="material" />
    </mesh>
    {particlesEnabled && revealMaterial && <points geometry={particles} raycast={() => undefined} renderOrder={GALLERY_MEMORY_RENDER_ORDER + 2} userData={{ galleryOpacityManaged: true }}>
      <primitive object={revealMaterial} attach="material" />
    </points>}
  </group>
}
function frameShaderMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uFocus: { value: 0 },
      uMoonTintStrength: { value: 0 }, uMoonColor: { value: new Color('#C3D8F2') },
    },
    vertexShader: frameVertexShader,
    fragmentShader: frameFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}
function Photo({ url, width, height, fallback, onAspect, material, planetarium = false }: { url: string; width: number; height: number; fallback: Texture | null; onAspect: (value: number) => void; material: RefObject<ShaderMaterial | null>; planetarium?: boolean }) {
  const [texture, setTexture] = useState<Texture | null>(null)
  useEffect(() => {
    let active = true; let loaded: Texture | null = null
    new TextureLoader().load(url, (value) => { if (!active) { value.dispose(); return } loaded = value; setColorSpace(value); if (planetarium) registerPlanetariumPhotoTexture(value); const image = value.image as HTMLImageElement; if (image.naturalWidth && image.naturalHeight) onAspect(image.naturalWidth / image.naturalHeight); setShaderUniform(material.current, 'map', value); setTexture(value) }, undefined, () => { if (active) setTexture(null) })
    return () => { active = false; if (loaded) planetarium ? releasePlanetariumPhotoTexture(loaded) : loaded.dispose() }
  }, [url, onAspect, material, planetarium])
  useEffect(() => { setShaderUniform(material.current, 'map', texture ?? fallback) }, [fallback, material, texture])
  return <mesh><planeGeometry args={[width, height]} /><primitive object={material.current!} attach="material" /></mesh>
}
function setMaterialAlpha(saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }, alpha: number) { saved.material.opacity = saved.opacity * alpha; saved.material.transparent = alpha < 1 || saved.transparent; saved.material.depthWrite = alpha < 1 ? false : saved.depthWrite }
function setFocusFog(material: Material, focus: boolean) { if (material instanceof MeshBasicMaterial && material.fog === focus) { material.fog = !focus; material.needsUpdate = true } }
function Memory({ memory, reducedMotion, halo, paused, settings, titleFontFamily }: { memory: GalleryMemory; reducedMotion: boolean; halo: CanvasTexture; paused: boolean; settings: GalleryArtSettings; titleFontFamily: string }) {
  const materials = useRef<{ material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[]>([])
  const group = useRef<Group>(null)
  const supportGroup = useRef<Group>(null)
  const visualGroup = useRef<Group>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  const captionMaterial = useRef<MeshBasicMaterial>(null)
  const contourMaterials = useRef<(MeshBasicMaterial | null)[]>([])
  const frameHaloMaterials = useRef<(MeshBasicMaterial | null)[]>([])
  const worldPosition = useMemo(() => new Vector3(), [])
  const moonPosition = useMemo(() => new Vector3(), [])
  const moonDirection = useMemo(() => new Vector3(), [])
  const photoNormal = useMemo(() => new Vector3(), [])
  const moonColor = useMemo(() => new Color(), [])
  const firstPhoto = useLoader(TextureLoader, firstPhotoUrl)
  const captionLayout = useMemo(() => getGalleryCaptionLayout(memory.title, memory.caption, settings.captionFontSize), [memory.caption, memory.title, settings.captionFontSize])
  const caption = useMemo(() => captionLayout.canvasHeight ? captionTexture(captionLayout, titleFontFamily) : null, [captionLayout, titleFontFamily])
  const photoMaterial = useMemo(() => photoShaderMaterial(firstPhoto), [firstPhoto])
  const photoMaterialRef = useRef(photoMaterial)
  const frameMaterial = useMemo(() => frameShaderMaterial(), [])
  const frameMaterialRef = useRef(frameMaterial)
  const visual = useRef({ alpha: 0, focusAmount: 0, timelineDirection: 0 as -1 | 0 | 1 })
  const columnOpacity = useRef(0)

  useEffect(() => {
    photoMaterialRef.current = photoMaterial
  }, [photoMaterial])
  useEffect(() => () => {
    caption?.dispose()
    photoMaterial.dispose()
    frameMaterial.dispose()
  }, [caption, photoMaterial, frameMaterial])
  useEffect(() => { setColorSpace(firstPhoto) }, [firstPhoto])
  useEffect(() => {
    const saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[] = []
    visualGroup.current?.traverse((child) => {
      if (child.userData.galleryOpacityManaged) return
      if (!(child instanceof Mesh) && !(child instanceof Points)) return
      const list = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of list) saved.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite })
    })
    materials.current = saved
    return () => { materials.current = [] }
  }, [])
  useEffect(() => {
    const photoRoot = visualGroup.current
    if (!photoRoot) return
    const restore: (() => void)[] = []
    photoRoot.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof Points)) return
      const original = object.raycast
      const gated = galleryPhotoRaycast(memory.order, original, () => Boolean(group.current?.visible))
      object.raycast = gated
      restore.push(() => { if (object.raycast === gated) object.raycast = original })
    })
    return () => restore.forEach((dispose) => dispose())
  }, [memory.order])

  const size = memory.order === 0 ? 2.15 : 3.3
  const [aspect, setAspect] = useState(memory.aspect)
  const reportMainPhotoAspect = useCallback((value: number) => {
    setAspect(value)
    setGalleryPhotoAspect(memory.id, 'main', value)
  }, [memory.id])
  const width = aspect >= 1 ? size : size * aspect
  const height = aspect >= 1 ? size / aspect : size
  const focusedOrder = useSyncExternalStore(subscribeGallery, getFocusedGalleryOrder, getServerFocusedGalleryOrder)
  const collagePhotos = useMemo(
    () => getFocusedGalleryCollagePhotos(memory.images, memory.order, focusedOrder),
    [focusedOrder, memory.images, memory.order],
  )
  const collageSettings = useMemo<Readonly<CollageRevealSettings>>(() => ({
    particleCount: settings.collageParticleCount,
    particleSize: settings.collageParticleSize,
    noiseStrength: settings.collageNoiseStrength,
    depth: settings.collageDepth,
    glow: settings.collageGlow,
    assembleDuration: settings.collageAssembleDuration,
    revealDuration: settings.collageRevealDuration,
    staggerDelay: settings.collageStaggerDelay,
    particleEnabled: getGalleryCollageConfig(memory.id).particleEnabled,
  }), [
    memory.id,
    settings.collageAssembleDuration,
    settings.collageDepth,
    settings.collageGlow,
    settings.collageNoiseStrength,
    settings.collageParticleCount,
    settings.collageParticleSize,
    settings.collageRevealDuration,
    settings.collageStaggerDelay,
  ])
  const backplate = useMemo(() => createGalleryWaterReflectionBackplate(width, height), [height, width])
  useEffect(() => () => {
    backplate.geometry.dispose()
    backplate.material.dispose()
  }, [backplate])
  const frameParticles = useMemo(
    () => createFrameParticleGeometry(width, height, memory.order + 17, { frameIntensity: settings.frameIntensity }),
    [height, memory.order, settings.frameIntensity, width],
  )
  useEffect(() => () => frameParticles.dispose(), [frameParticles])
  const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
  const planetarium = memory.id === PLANETARIUM_GALLERY_EVENT_ID
  const [x, y, z] = getGalleryPhotoPosition(GALLERY_MEMORIES, memory, settings, GALLERY_WORLD.floor.y)
  const supportPositions = planetarium
    ? []
    : galleryColumnPositions(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout)
  const photoYaw = galleryPhotoYaw(memory, settings.galleryLayoutVariant, settings.archRotationY)
  const supportLocalPositions = useMemo(
    () => gallerySupportLocalPositions(settings.galleryLayoutVariant, [x, y, z], supportPositions),
    [settings.galleryLayoutVariant, x, y, z, supportPositions],
  )

  const applyArtSettings = useCallback((alpha = visual.current.alpha, focusAmount = visual.current.focusAmount) => {
    const frameIntensity = Math.max(0, Math.min(2, settings.frameIntensity))
    const focusGlow = 1 + focusAmount * 0.16
    for (const material of contourMaterials.current) {
      if (material) material.opacity = Math.min(1, alpha * 0.85 * frameIntensity * focusGlow)
    }
    for (const material of frameHaloMaterials.current) {
      if (material) material.opacity = Math.min(1, alpha * 0.5 * frameIntensity * focusGlow)
    }
    if (glow.current) glow.current.opacity = Math.min(1, alpha * 0.2 * frameIntensity * focusGlow)
    setShaderUniform(frameMaterialRef.current, 'uOpacity', alpha * (0.48 + 0.2 * focusAmount))
    setShaderUniform(frameMaterialRef.current, 'uFocus', focusAmount)
  }, [settings])
  useEffect(() => { applyArtSettings() }, [applyArtSettings])

  useFrame(({ camera }) => {
    if (!group.current || !supportGroup.current || !visualGroup.current || document.hidden) return
    const m = galleryMotion
    const t = Math.min(1, m.intro / (reducedMotion ? 0.35 : GALLERY.intro))
    const e = t * t * (3 - 2 * t)
    const first = memory.order === 0
    group.current.position.set(first ? x * e : x, y, first ? z * e : z)
    group.current.scale.setScalar(first ? 1 + 0.35 * e : 1)
    const photoOffsetZ = camera.position.z - (first ? z * e : z)
    const photoFocusMix = m.focusIndex === memory.order ? m.focusMix : 0
    const approachYaw = galleryPhotoApproachYaw(memory, settings.galleryLayoutVariant, photoOffsetZ, settings.galleryPhotoFacingMaxDegrees, photoFocusMix, settings.archRotationY)
    group.current.rotation.set(0, first && settings.galleryLayoutVariant === 'on-columns' ? (reducedMotion ? 0 : 0.065 * (1 - e)) + photoYaw * e : approachYaw, 0)
    const [columnX, columnY, columnZ] = settings.galleryLayoutVariant === 'between-columns' || supportPositions.length === 0
      ? [x, y, z]
      : supportPositions[0]!
    const animateSupportsWithPhoto = first && settings.galleryLayoutVariant === 'on-columns'
    supportGroup.current.position.set(
      animateSupportsWithPhoto ? columnX * e : columnX,
      animateSupportsWithPhoto ? columnY * e : columnY,
      animateSupportsWithPhoto ? columnZ * e : columnZ,
    )
    supportGroup.current.scale.setScalar(gallerySupportGroupScale(
      settings.galleryLayoutVariant,
      first ? 1 + 0.35 * e : 1,
    ))
    supportGroup.current.rotation.set(0, settings.galleryLayoutVariant === 'between-columns' ? 0 : group.current.rotation.y, 0)
    visualGroup.current.position.set(0, reducedMotion ? 0 : Math.sin(m.time * 0.3 + memory.order) * 0.025, 0)
    visualGroup.current.scale.setScalar(1)
    visualGroup.current.rotation.set(first && !reducedMotion ? -0.022 * (1 - e) : 0, 0, first && !reducedMotion ? -0.009 * (1 - e) : 0)
    if (planetarium) capturePlanetariumPhotoRect(visualGroup.current, camera, width, height)

    const visible = first ? 1 : Math.max(0, Math.min(1, (m.intro - memory.order * 0.15) / 1.4))
    const snapshot = gallerySnapshot()
    const selected = snapshot.focus === memory.order
    const focusTarget = m.focusMix > 0.001 && m.focusIndex === memory.order
    const focusAmount = m.focusIndex === memory.order ? Math.max(0, Math.min(1, m.focusMix)) : 0
    const timelineDirection: -1 | 0 | 1 = selected
      ? snapshot.interaction === 'returning' ? -1 : snapshot.interaction === 'focusing' || snapshot.interaction === 'focused' ? 1 : 0
      : 0
    const photoPosition = visualGroup.current.getWorldPosition(worldPosition)
    const photoDistance = camera.position.distanceTo(photoPosition)
    moonPosition.set(settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ)
    moonDirection.subVectors(moonPosition, photoPosition)
    visualGroup.current.getWorldDirection(photoNormal)
    const moonIllumination = getMoonPhotoIllumination(
      photoNormal,
      moonDirection,
      settings.moonLightIntensity * settings.moonBrightness,
    )
    const tintStrength = getMoonFrameTintStrength(moonIllumination)
    const configuredMoonColor = moonColor.set(settings.moonLightColor)
    setShaderUniform(photoMaterialRef.current, 'uMoonIllumination', moonIllumination)
    setShaderUniform(photoMaterialRef.current, 'uMoonColor', configuredMoonColor)
    setShaderUniform(frameMaterialRef.current, 'uMoonTintStrength', tintStrength)
    setShaderUniform(frameMaterialRef.current, 'uMoonColor', configuredMoonColor)
    for (const material of contourMaterials.current) {
      material?.color.copy(FRAME_CONTOUR_BASE_COLOR).lerp(configuredMoonColor, tintStrength)
    }
    for (const material of frameHaloMaterials.current) {
      material?.color.copy(FRAME_HALO_BASE_COLOR).lerp(configuredMoonColor, tintStrength)
    }
    const distanceAlpha = galleryDistanceOpacity(photoDistance)
    const photoDistanceAlpha = galleryFocusedPhotoDistanceOpacity(photoDistance, selected, focusAmount)
    const focusAlpha = galleryFocusOpacity(m.focusMix, selected)
    const exitMix = m.exit / GALLERY.exit
    const exitOpacity = 1 - exitMix
    const alpha = visible * exitOpacity * focusAlpha * photoDistanceAlpha
    // Columns belong to the gallery architecture, so focusing a photo may fade
    // neighboring photos but must not fade their columns with them.
    columnOpacity.current = galleryColumnOpacity(visible, exitMix, distanceAlpha)
    for (const saved of materials.current) {
      setMaterialAlpha(saved, alpha)
      setFocusFog(saved.material, focusTarget)
    }
    group.current.visible = visible > 0 && photoDistanceAlpha > 0 && alpha > 0.001
    supportGroup.current.visible = group.current.visible && settings.columnVisible
    visual.current = { alpha, focusAmount, timelineDirection }

    setShaderUniform(photoMaterialRef.current, 'uAlpha', alpha)
    setShaderUniform(photoMaterialRef.current, 'uBlur', galleryPhotoBlurAtFocus(photoDistance, focusAmount))
    setShaderUniform(photoMaterialRef.current, 'uLight', galleryPhotoLightAtFocus(photoDistance, focusAmount))
    setShaderUniform(frameMaterialRef.current, 'uTime', reducedMotion ? 0 : m.time)
    applyArtSettings(alpha, focusAmount)
    if (captionMaterial.current) captionMaterial.current.opacity = visible * (0.65 + 0.35 * focusAmount) * focusAlpha * distanceAlpha * (1 - m.exit / GALLERY.exit)

  })

  return <>
    <group ref={supportGroup} renderOrder={GALLERY_MEMORY_RENDER_ORDER}>
      {supportPositions.map(([supportX], index) => <group
        key={index}
        position={supportLocalPositions[index] ?? [0, 0, 0]}
      >
        <GalleryColumn
          visible={settings.columnVisible}
          scale={settings.columnScale}
          depth={settings.columnDepth}
          offsetX={gallerySupportColumnOffsetX(supportX, settings.galleryLayoutVariant, settings.columnOffsetX)}
          offsetY={settings.columnOffsetY}
          opacity={columnOpacity}
        />
      </group>)}
    </group>
    <group ref={group} renderOrder={GALLERY_MEMORY_RENDER_ORDER} onClick={(event) => { event.stopPropagation(); if (!paused) galleryFocus(memory.order) }}>
      <group ref={visualGroup}>
      <primitive object={backplate} />
      <mesh position={[0, 0, -0.07]}><planeGeometry args={[width + 0.36, height + 0.36]} /><meshBasicMaterial ref={glow} map={halo} color="#ffd7b0" transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></mesh>
      {memory.order === 0
        ? <FirstMemoryCard photoMaterial={photoMaterial} frameTone="moonlight" />
        : memory.image
          ? <Photo url={memory.image} width={width} height={height} fallback={firstPhoto} onAspect={reportMainPhotoAspect} material={photoMaterialRef} planetarium={planetarium} />
          : null}
      {([-1, 1] as const).map(side => <group key={side}>
        <mesh position={[0, side * (height / 2 + 0.025), 0.01]}>
          <planeGeometry args={[width + 0.36, 0.16]} />
          <meshBasicMaterial ref={(material) => { frameHaloMaterials.current[side === -1 ? 0 : 1] = material }} map={halo} color="#efcba8" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[side * (width / 2 + 0.025), 0, 0.01]}>
          <planeGeometry args={[0.16, height + 0.36]} />
          <meshBasicMaterial ref={(material) => { frameHaloMaterials.current[side === -1 ? 2 : 3] = material }} map={halo} color="#efcba8" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, side * (height / 2 + 0.025), 0.02]}>
          <planeGeometry args={[width + 0.1, 0.018]} />
          <meshBasicMaterial ref={(material) => { contourMaterials.current[side === -1 ? 0 : 1] = material }} color="#f4dcc0" transparent opacity={0.62} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
        </mesh>
        <mesh position={[side * (width / 2 + 0.025), 0, 0.02]}>
          <planeGeometry args={[0.018, height + 0.1]} />
          <meshBasicMaterial ref={(material) => { contourMaterials.current[side === -1 ? 2 : 3] = material }} color="#f4dcc0" transparent opacity={0.62} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
        </mesh>
      </group>)}
      {collagePhotos.map(({ slot, url }) => <CollageExtraPhoto
        key={slot}
        memoryId={memory.id}
        url={url}
        slot={slot}
        side={memory.side}
        mainWidth={width}
        mainHeight={height}
        fallback={firstPhoto}
        focusVisual={visual}
        seed={memory.order * 37 + slot * 101}
        photoScale={settings.collagePhotoScale}
        photoGap={settings.collagePhotoGap}
        layoutVariant={settings.galleryLayoutVariant}
        settings={collageSettings}
        reducedMotion={reducedMotion}
        paused={paused}
      />)}
      <points geometry={frameParticles}><primitive object={frameMaterial} attach="material" /></points>
      {caption && <mesh position={[0, -height / 2 - GALLERY_CAPTION_GAP - captionLayout.worldHeight / 2, 0.02]}><planeGeometry args={[GALLERY_CAPTION_PLANE_WIDTH, captionLayout.worldHeight]} /><meshBasicMaterial ref={captionMaterial} map={caption} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
      </mesh>}
      </group>
    </group>
  </>
}
const dustVertexShader = [
  'uniform float uTime;',
  'attribute float size;',
  'attribute float phase;',
  'attribute float speed;',
  'attribute float particleAlpha;',
  'attribute vec3 drift;',
  'attribute vec3 color;',
  'varying float vAlpha;',
  'varying float vDepth;',
  'varying vec3 vColor;',
  'void main() {',
  '  float t = uTime * speed + phase;',
  '  vec3 moved = position + drift * vec3(sin(t), cos(t * 0.83), sin(t * 0.57)) * 0.5;',
  '  vec4 view = modelViewMatrix * vec4(moved, 1.0);',
  '  gl_Position = projectionMatrix * view;',
  '  gl_PointSize = size * 280.0 / max(1.0, -view.z);',
  '  vAlpha = particleAlpha * (0.76 + 0.24 * sin(t));',
  '  vDepth = -view.z;',
  '  vColor = color;',
  '}',
].join('\n')

const dustFragmentShader = [
  'varying float vAlpha;',
  'varying float vDepth;',
  'varying vec3 vColor;',
  'void main() {',
  '  float radius = length(gl_PointCoord - 0.5);',
  '  float softPoint = 1.0 - smoothstep(0.08, 0.5, radius);',
  '  float distanceFade = 1.0 - smoothstep(30.0, 76.0, vDepth);',
  '  float alpha = softPoint * vAlpha * mix(0.18, 1.0, distanceFade);',
  '  gl_FragColor = vec4(vColor, alpha);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n')

function Dust({ low, reducedMotion, settings }: { low: boolean; reducedMotion: boolean; settings: GalleryArtSettings }) {
  const material = useRef<ShaderMaterial>(null)
  const count = getGalleryDustCount(settings.particleCount, low, reducedMotion)
  const geometry = useMemo(() => createGalleryDustGeometry(count), [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => { setShaderUniform(material.current, 'uTime', reducedMotion ? 0 : galleryMotion.time) })
  return <points geometry={geometry} raycast={() => undefined}>
    <shaderMaterial ref={material} uniforms={{ uTime: { value: 0 } }} vertexShader={dustVertexShader} fragmentShader={dustFragmentShader} transparent depthWrite={false} />
  </points>
}
function MemoryThreads({ settings, low, paused, halo }: { settings: GalleryArtSettings; low: boolean; paused: boolean; halo: CanvasTexture }) {
  const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
  const { columnDepth, columnScale, galleryLayoutVariant, galleryWidth } = settings
  const paths = useMemo(() => createMemoryThreadPaths(
    GALLERY_MEMORIES,
    galleryWidth,
    galleryLayoutVariant,
    layout,
    { columnDepth, columnScale },
  ), [columnDepth, columnScale, galleryLayoutVariant, galleryWidth, layout])
  const geometries = useMemo(
    () => paths.map(path => createMemoryThreadGeometry(path, { segments: low ? 22 : 38, radius: 0.01, radialSegments: 4 })),
    [low, paths],
  )
  const accentGeometry = useMemo(() => createMemoryThreadAccentGeometry(paths), [paths])
  const material = useMemo(() => createMemoryThreadMaterial(settings, galleryMotion.focusMix), [settings])
  const accentMaterial = useRef<PointsMaterial>(null)

  useEffect(() => () => {
    geometries.forEach(geometry => geometry.dispose())
    accentGeometry.dispose()
    material.dispose()
  }, [geometries, accentGeometry, material])
  useEffect(() => {
    const focus = galleryMotion.focusMix
    updateMemoryThreadMaterial(material, settings, focus)
    if (accentMaterial.current) accentMaterial.current.opacity = memoryThreadOpacity(settings, focus) * 1.25
  }, [material, settings])

  useFrame(() => {
    if (paused || document.hidden) return
    const focus = galleryMotion.focusMix
    updateMemoryThreadMaterial(material, settings, focus)
    if (accentMaterial.current) accentMaterial.current.opacity = memoryThreadOpacity(settings, focus) * 1.25
  })

  return <group raycast={() => undefined}>
    {geometries.map((geometry, index) => <mesh key={index} geometry={geometry} material={material} renderOrder={GALLERY_THREAD_RENDER_ORDER} raycast={() => undefined} />)}
    <points geometry={accentGeometry} renderOrder={GALLERY_THREAD_RENDER_ORDER} raycast={() => undefined}>
      <pointsMaterial
        ref={accentMaterial}
        map={halo}
        color="#ead8bd"
        size={0.13}
        transparent
        opacity={memoryThreadOpacity(settings, galleryMotion.focusMix) * 1.25}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  </group>
}

export function GalleryScene({ state, reducedMotion }: SceneProps) {
  const gl = useThree(s => s.gl)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const settings = config.scenes.gallery
  const prologueFont = ART_FONT_CATALOG.find(({ id }) => id === config.scenes.prologue.fontFamily) ?? ART_FONT_CATALOG[0]!
  const [loadedTitleFontId, setLoadedTitleFontId] = useState<ArtFontId | null>(null)
  useEffect(() => {
    let active = true
    void loadArtFont(prologueFont.id).then((loaded) => {
      if (active) setLoadedTitleFontId(loaded ? prologueFont.id : null)
    })
    return () => { active = false }
  }, [prologueFont.id])
  const titleFontFamily = loadedTitleFontId === prologueFont.id ? prologueFont.family : 'Georgia'
  const quality = state.quality === 'low' || config.global.quality === 'low' ? 'low' : 'standard'
  const skyColor = useMemo(() => new Color('#020713').lerp(new Color('#071d42'), Math.max(0, Math.min(1, settings.cloudCoolTint / 1.5))), [settings.cloudCoolTint])
  const halo = useMemo(() => canvasTexture((ctx, w, h) => { const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gradient.addColorStop(0, 'rgba(244,248,255,.34)'); gradient.addColorStop(.24, 'rgba(219,229,244,.13)'); gradient.addColorStop(1, 'rgba(206,220,239,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h) }, 256, 256), [])
  useEffect(() => () => halo.dispose(), [halo])
  useEffect(() => { resetGallery() }, [state.revision])
  useEffect(() => bindGalleryGestures(gl.domElement, () => state.paused), [gl, state.paused])
  return <>
    <color attach="background" args={[skyColor]} />
    <fog attach="fog" args={[skyColor, 55, 208 - settings.hazeDensity * 14]} />
    <MoonlitWorld settings={settings} quality={quality} halo={halo} reducedMotion={reducedMotion} />
    <GalleryArch settings={settings} />
    <Dust low={quality === 'low'} reducedMotion={reducedMotion} settings={settings} />
    {GALLERY_MEMORIES.map(memory => <Memory key={memory.id} memory={memory} reducedMotion={reducedMotion} halo={halo} paused={state.paused} settings={settings} titleFontFamily={titleFontFamily} />)}
    <MemoryThreads settings={settings} low={quality === 'low'} paused={state.paused} halo={halo} />
    <FloorLights halo={halo} low={quality === 'low'} reducedMotion={reducedMotion} settings={settings} />
  </>
}

function FloorLights({ halo, low, reducedMotion, settings }: { halo: CanvasTexture; low: boolean; reducedMotion: boolean; settings: GalleryArtSettings }) {
  const count = Math.round(getGalleryDustCount(settings.particleCount, low, reducedMotion) * 0.09)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const spread = (Math.sin(i * 18.19) + 1) * 1.1
      const progress = count > 1 ? i / (count - 1) : 0.5
      const side = i % 2 ? -1 : 1
      const z = GALLERY.startZ - progress * (GALLERY.travel - 4)
      positions.set([side * (2.9 + spread), GALLERY_WORLD.floor.y + 0.055, z], i * 3)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    return result
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry} raycast={() => undefined}>
    <pointsMaterial map={halo} color="#d8c8b3" size={0.14} transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} />
  </points>
}
