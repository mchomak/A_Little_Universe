import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { galleryColumnOpacity, galleryDistanceOpacity, galleryFocusOpacity } from './gallery/visibility'
import { galleryPhotoBlurAtFocus, galleryPhotoLightAtFocus } from './gallery/artDirection'
import { createFrameParticleGeometry } from './gallery/frameParticles'
import { createGalleryDustGeometry, getGalleryDustCount } from './gallery/dust'
import type { GalleryArtSettings } from './gallery/reflections'
import { createMemoryThreadAccentGeometry, createMemoryThreadGeometry, createMemoryThreadMaterial, createMemoryThreadPaths, GALLERY_MEMORY_RENDER_ORDER, GALLERY_THREAD_RENDER_ORDER, memoryThreadOpacity, updateMemoryThreadMaterial } from './gallery/threads'
import { GALLERY_WORLD } from './gallery/world'
import { createGalleryWaterReflectionBackplate } from './gallery/galleryBackplate'
import { getMoonFrameTintStrength, getMoonPhotoIllumination } from './gallery/moonLighting'
import { collageParticleOpacity, collagePhotoOpacity, collageRevealProgress, createCollageRevealGeometry, getFocusedGalleryCollagePhotos, getGalleryCollagePhotoLayout } from './gallery/collage'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Material, Mesh, MeshBasicMaterial, Points, PointsMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3, ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { useSyncExternalStore } from 'react'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { GALLERY, GALLERY_MEMORIES, galleryColumnPositions, galleryPhotoApproachYaw, galleryPhotoYaw, gallerySupportColumnOffsetX, gallerySupportGroupScale, gallerySupportLocalPositions, memoryPosition, type GalleryMemory } from './gallery/content'
import { GalleryColumn } from './gallery/GalleryColumn'
import { GalleryArch } from './gallery/GalleryArch'
import { galleryFocus, galleryMotion, galleryPhotoRaycast, gallerySnapshot, resetGallery, subscribeGallery } from './gallery/controller'
import { bindGalleryGestures } from './gallery/gestures'
import { MoonlitWorld } from './gallery/MoonlitWorld'
import firstPhotoUrl from '../assets/start_img.jpg'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 768, h = 768) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!; draw(ctx, w, h)
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture
}
function placeholder(memory: GalleryMemory) {
  return canvasTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, memory.palette[0]); gradient.addColorStop(1, memory.palette[1]); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,235,210,.20)'; ctx.beginPath(); ctx.arc(w * .72, h * .27, w * .12, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(23,28,46,.34)'; ctx.beginPath(); ctx.moveTo(0, h * .8); ctx.lineTo(w * .27, h * .48); ctx.lineTo(w * .48, h * .72); ctx.lineTo(w * .69, h * .5); ctx.lineTo(w, h * .76); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill()
    if (memory.order === 11) { ctx.fillStyle = 'rgba(255,250,229,.8)'; for (let i = 0; i < 32; i++) { const x = ((i * 139 + 43) % 720) / 720 * w, y = ((i * 73 + 19) % 380) / 768 * h; ctx.fillRect(x, y, 2, 2) } }
    ctx.fillStyle = 'rgba(255,248,237,.8)'; ctx.font = '22px Georgia'; ctx.textAlign = 'center'; ctx.fillText('ТЕСТОВОЕ ИЗОБРАЖЕНИЕ', w / 2, h * .91)
  }, 256, 256)
}
function captionTexture(text: string) { return canvasTexture((ctx, w, h) => { ctx.fillStyle = '#f5dbc9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '42px Georgia'; ctx.fillText(text, w / 2, h / 2, w - 20) }, 1024, 100) }
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
  uniform float uReveal;
  uniform float uAlpha;
  attribute vec3 targetPosition;
  attribute float size;
  attribute float phase;
  varying float vAlpha;
  void main() {
    float reveal = smoothstep(0.0, 1.0, uReveal);
    vec3 moved = mix(position, targetPosition, reveal);
    vec4 view = modelViewMatrix * vec4(moved, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = size * 520.0 / max(1.0, -view.z);
    vAlpha = (1.0 - reveal) * uAlpha * (0.72 + 0.28 * sin(phase + uReveal * 6.2831853));
  }
`
const collageParticleFragmentShader = `
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5);
    float point = 1.0 - smoothstep(0.12, 0.5, radius);
    gl_FragColor = vec4(0.82, 0.88, 0.96, point * vAlpha);
  }
`
function collageParticleMaterial() {
  return new ShaderMaterial({
    uniforms: { uReveal: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: collageParticleVertexShader,
    fragmentShader: collageParticleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}
function CollageExtraPhoto({ url, slot, side, mainWidth, mainHeight, fallback, focusVisual, seed }: {
  url: string
  slot: 2 | 3 | 4
  side: -1 | 1
  mainWidth: number
  mainHeight: number
  fallback: Texture
  focusVisual: RefObject<{ alpha: number; focusAmount: number }>
  seed: number
}) {
  const [aspect, setAspect] = useState(1)
  const backplateMaterial = useRef<MeshBasicMaterial>(null)
  const photoMaterial = useMemo(() => photoShaderMaterial(fallback), [fallback])
  const particles = useMemo(() => createCollageRevealGeometry(1.02, 1.02 / Math.max(0.35, aspect), seed), [aspect, seed])
  const revealMaterial = useMemo(() => collageParticleMaterial(), [])
  const layout = useMemo(() => getGalleryCollagePhotoLayout(slot, side, mainWidth, mainHeight, aspect), [aspect, mainHeight, mainWidth, side, slot])

  useEffect(() => {
    let active = true
    let loaded: Texture | null = null
    new TextureLoader().load(url, (value) => {
      if (!active) { value.dispose(); return }
      loaded = value
      setColorSpace(value)
      setShaderUniform(photoMaterial, 'map', value)
      const image = value.image as HTMLImageElement
      if (image.naturalWidth && image.naturalHeight) setAspect(image.naturalWidth / image.naturalHeight)
    }, undefined, () => { if (active) setShaderUniform(photoMaterial, 'map', fallback) })
    return () => { active = false; loaded?.dispose() }
  }, [fallback, photoMaterial, url])
  useEffect(() => () => {
    particles.dispose()
    photoMaterial.dispose()
    revealMaterial.dispose()
  }, [particles, photoMaterial, revealMaterial])
  useFrame(() => {
    const { alpha, focusAmount } = focusVisual.current
    const photoAlpha = alpha * collagePhotoOpacity(focusAmount)
    if (backplateMaterial.current) backplateMaterial.current.opacity = photoAlpha * 0.92
    setShaderUniform(photoMaterial, 'uAlpha', photoAlpha)
    setShaderUniform(revealMaterial, 'uAlpha', alpha * collageParticleOpacity(focusAmount))
    setShaderUniform(revealMaterial, 'uReveal', collageRevealProgress(focusAmount))
  })

  return <group position={layout.position}>
    <mesh position={[0, 0, -0.025]} raycast={() => undefined} userData={{ galleryOpacityManaged: true }}>
      <planeGeometry args={[layout.width + 0.08, layout.height + 0.08]} />
      <meshBasicMaterial ref={backplateMaterial} color="#17141d" transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh raycast={() => undefined} renderOrder={GALLERY_MEMORY_RENDER_ORDER + 1} userData={{ galleryOpacityManaged: true }}>
      <planeGeometry args={[layout.width, layout.height]} />
      <primitive object={photoMaterial} attach="material" />
    </mesh>
    <points geometry={particles} raycast={() => undefined} renderOrder={GALLERY_MEMORY_RENDER_ORDER + 2} userData={{ galleryOpacityManaged: true }}>
      <primitive object={revealMaterial} attach="material" />
    </points>
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
function Photo({ url, width, height, fallback, onAspect, material }: { url: string; width: number; height: number; fallback: Texture | null; onAspect: (value: number) => void; material: RefObject<ShaderMaterial | null> }) {
  const [texture, setTexture] = useState<Texture | null>(null)
  useEffect(() => {
    let active = true; let loaded: Texture | null = null
    new TextureLoader().load(url, (value) => { if (!active) { value.dispose(); return } loaded = value; setColorSpace(value); const image = value.image as HTMLImageElement; if (image.naturalWidth && image.naturalHeight) onAspect(image.naturalWidth / image.naturalHeight); setShaderUniform(material.current, 'map', value); setTexture(value) }, undefined, () => { if (active) setTexture(null) })
    return () => { active = false; loaded?.dispose() }
  }, [url, onAspect, material])
  useEffect(() => { setShaderUniform(material.current, 'map', texture ?? fallback) }, [fallback, material, texture])
  return <mesh><planeGeometry args={[width, height]} /><primitive object={material.current!} attach="material" /></mesh>
}
function setMaterialAlpha(saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }, alpha: number) { saved.material.opacity = saved.opacity * alpha; saved.material.transparent = alpha < 1 || saved.transparent; saved.material.depthWrite = alpha < 1 ? false : saved.depthWrite }
function setFocusFog(material: Material, focus: boolean) { if (material instanceof MeshBasicMaterial && material.fog === focus) { material.fog = !focus; material.needsUpdate = true } }
function Memory({ memory, reducedMotion, halo, paused, settings }: { memory: GalleryMemory; reducedMotion: boolean; halo: CanvasTexture; paused: boolean; settings: GalleryArtSettings }) {
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
  const image = useMemo(() => memory.order === 0 && memory.image ? null : placeholder(memory), [memory])
  const captionText = memory.caption.trim()
  const caption = useMemo(() => captionText ? captionTexture(captionText) : null, [captionText])
  const photoMaterial = useMemo(() => photoShaderMaterial(image ?? firstPhoto), [firstPhoto, image])
  const photoMaterialRef = useRef(photoMaterial)
  const frameMaterial = useMemo(() => frameShaderMaterial(), [])
  const frameMaterialRef = useRef(frameMaterial)
  const visual = useRef({ alpha: 0, focusAmount: 0 })
  const columnOpacity = useRef(0)

  useEffect(() => {
    photoMaterialRef.current = photoMaterial
  }, [photoMaterial])
  useEffect(() => () => {
    image?.dispose()
    caption?.dispose()
    photoMaterial.dispose()
    frameMaterial.dispose()
  }, [image, caption, photoMaterial, frameMaterial])
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
  const width = aspect >= 1 ? size : size * aspect
  const height = aspect >= 1 ? size / aspect : size
  const focusedOrder = useSyncExternalStore(subscribeGallery, getFocusedGalleryOrder, getServerFocusedGalleryOrder)
  const collagePhotos = useMemo(
    () => getFocusedGalleryCollagePhotos(memory.images, memory.order, focusedOrder),
    [focusedOrder, memory.images, memory.order],
  )
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
  const [x, y, z] = memoryPosition(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout, settings)
  const supportPositions = galleryColumnPositions(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout)
  const photoYaw = galleryPhotoYaw(memory, settings.galleryLayoutVariant)
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
    const approachYaw = galleryPhotoApproachYaw(memory, settings.galleryLayoutVariant, photoOffsetZ, settings.galleryPhotoFacingMaxDegrees, photoFocusMix)
    group.current.rotation.set(0, first && settings.galleryLayoutVariant === 'on-columns' ? (reducedMotion ? 0 : 0.065 * (1 - e)) + photoYaw * e : approachYaw, 0)
    const [columnX, columnY, columnZ] = settings.galleryLayoutVariant === 'between-columns'
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

    const visible = first ? 1 : Math.max(0, Math.min(1, (m.intro - memory.order * 0.15) / 1.4))
    const selected = gallerySnapshot().focus === memory.order
    const focusTarget = m.focusMix > 0.001 && m.focusIndex === memory.order
    const focusAmount = m.focusIndex === memory.order ? Math.max(0, Math.min(1, m.focusMix)) : 0
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
    const focusAlpha = galleryFocusOpacity(m.focusMix, selected)
    const exitMix = m.exit / GALLERY.exit
    const exitOpacity = 1 - exitMix
    const alpha = visible * exitOpacity * focusAlpha * distanceAlpha
    // Columns belong to the gallery architecture, so focusing a photo may fade
    // neighboring photos but must not fade their columns with them.
    columnOpacity.current = galleryColumnOpacity(visible, exitMix, distanceAlpha)
    for (const saved of materials.current) {
      setMaterialAlpha(saved, alpha)
      setFocusFog(saved.material, focusTarget)
    }
    group.current.visible = visible > 0 && distanceAlpha > 0 && alpha > 0.001
    supportGroup.current.visible = group.current.visible && settings.columnVisible
    visual.current = { alpha, focusAmount }

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
      {memory.order === 0 && memory.id === 'demo-start-photo'
        ? <FirstMemoryCard photoMaterial={photoMaterial} frameTone="moonlight" />
        : memory.image
          ? <Photo url={memory.image} width={width} height={height} fallback={image ?? firstPhoto} onAspect={setAspect} material={photoMaterialRef} />
          : <mesh><planeGeometry args={[width, height]} /><primitive object={photoMaterial} attach="material" /></mesh>}
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
        url={url}
        slot={slot}
        side={memory.side}
        mainWidth={width}
        mainHeight={height}
        fallback={image ?? firstPhoto}
        focusVisual={visual}
        seed={memory.order * 37 + slot * 101}
      />)}
      <points geometry={frameParticles}><primitive object={frameMaterial} attach="material" /></points>
      {caption && <mesh position={[0, -height / 2 - 0.34, 0.02]}><planeGeometry args={[3.4, 0.33]} /><meshBasicMaterial ref={captionMaterial} map={caption} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
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
    {GALLERY_MEMORIES.map(memory => <Memory key={memory.id} memory={memory} reducedMotion={reducedMotion} halo={halo} paused={state.paused} settings={settings} />)}
    <MemoryThreads settings={settings} low={quality === 'low'} paused={state.paused} halo={halo} />
    <FloorLights halo={halo} low={quality === 'low'} reducedMotion={reducedMotion} settings={settings} />
    <Outro />
  </>
}
function Outro() {
  const mesh = useRef<Mesh>(null); const material = useRef<MeshBasicMaterial>(null); const direction = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => { if (!mesh.current || !material.current) return; const progress = galleryMotion.exit / GALLERY.exit; mesh.current.visible = progress > 0; camera.getWorldDirection(direction); mesh.current.position.copy(camera.position).addScaledVector(direction, .4); mesh.current.quaternion.copy(camera.quaternion); material.current.opacity = Math.min(.93, progress * .93) })
  return <mesh ref={mesh} visible={false} renderOrder={999}><planeGeometry args={[5, 5]} /><meshBasicMaterial ref={material} color="#071225" transparent opacity={0} depthTest={false} depthWrite={false} /></mesh>
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
