import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { galleryDistanceOpacity, galleryFocusOpacity } from './gallery/visibility'
import { galleryPhotoBlurAtFocus, galleryPhotoLightAtFocus, GALLERY_ART } from './gallery/artDirection'
import { createFrameParticleGeometry } from './gallery/frameParticles'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, Material, Mesh, MeshBasicMaterial, Object3D, Points, SRGBColorSpace, SpotLight, Texture, TextureLoader, Vector3, ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { GALLERY, GALLERY_MEMORIES, memoryPosition, type GalleryMemory } from './gallery/content'
import { galleryFocus, galleryMotion, galleryPhotoRaycast, gallerySnapshot, resetGallery } from './gallery/controller'
import { bindGalleryGestures } from './gallery/gestures'
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
function setShaderUniform(material: ShaderMaterial | null, name: string, value: unknown) {
  const uniform = material?.uniforms[name]
  if (uniform) uniform.value = value
}
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
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5);
    float point = 1.0 - smoothstep(0.12, 0.5, radius);
    gl_FragColor = vec4(vColor, point * vAlpha);
  }
`
function photoShaderMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, uAlpha: { value: 1 }, uBlur: { value: 0 }, uLight: { value: 0.04 } },
    vertexShader: photoVertexShader,
    fragmentShader: photoFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}
function frameShaderMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uFocus: { value: 0 } },
    vertexShader: frameVertexShader,
    fragmentShader: frameFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}
function Photo({ url, width, height, fallback, onAspect, material }: { url: string; width: number; height: number; fallback: CanvasTexture | null; onAspect: (value: number) => void; material: RefObject<ShaderMaterial | null> }) {
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
function Memory({ memory, reducedMotion, halo, paused }: { memory: GalleryMemory; reducedMotion: boolean; halo: CanvasTexture; paused: boolean }) {
  const materials = useRef<{ material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[]>([])
  const group = useRef<Group>(null); const glow = useRef<MeshBasicMaterial>(null); const edge = useRef<MeshBasicMaterial>(null); const captionMaterial = useRef<MeshBasicMaterial>(null)
  const worldPosition = useMemo(() => new Vector3(), [])
  const firstPhoto = useLoader(TextureLoader, firstPhotoUrl)
  const image = useMemo(() => memory.order === 0 ? null : placeholder(memory), [memory])
  const caption = useMemo(() => captionTexture(memory.caption), [memory.caption])
  const photoMaterial = useMemo(() => photoShaderMaterial(memory.order === 0 ? firstPhoto : image ?? firstPhoto), [firstPhoto, image, memory.order])
  const photoMaterialRef = useRef(photoMaterial)
  const frameMaterial = useMemo(() => frameShaderMaterial(), [])
  const frameMaterialRef = useRef(frameMaterial)
  useEffect(() => () => { image?.dispose(); caption.dispose(); photoMaterial.dispose(); frameMaterial.dispose() }, [image, caption, photoMaterial, frameMaterial])
  useEffect(() => { setColorSpace(firstPhoto) }, [firstPhoto])
  useEffect(() => {
    const saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[] = []
    group.current?.traverse((child) => { if (!(child instanceof Mesh) && !(child instanceof Points)) return; const list = Array.isArray(child.material) ? child.material : [child.material]; for (const material of list) saved.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }) })
    materials.current = saved
    return () => { materials.current = [] }
  }, [])
  useEffect(() => {
    const root = group.current
    if (!root) return
    const restore: (() => void)[] = []
    root.traverse((object) => {
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
  const frameParticles = useMemo(() => createFrameParticleGeometry(width, height, memory.order + 17), [height, memory.order, width])
  useEffect(() => () => frameParticles.dispose(), [frameParticles])
  const [x, y, z] = memoryPosition(memory)
  useFrame(({ camera }) => {
    if (!group.current || paused || document.hidden) return
    const m = galleryMotion;
    const t = Math.min(1, m.intro / (reducedMotion ? .35 : GALLERY.intro)); const e = t * t * (3 - 2 * t)
    const first = memory.order === 0
    group.current.position.set(first ? x * e : x, y + (reducedMotion ? 0 : Math.sin(m.time * .3 + memory.order) * .025), first ? z * e : z)
    if (first) group.current.scale.setScalar(1 + .35 * e)
    if (first) group.current.rotation.set(reducedMotion ? 0 : -.022 * (1 - e), (reducedMotion ? 0 : .065 * (1 - e)) - memory.side * GALLERY_ART.wallYaw * e, reducedMotion ? 0 : -.009 * (1 - e))
    else group.current.rotation.y = -memory.side * GALLERY_ART.wallYaw
    const visible = first ? 1 : Math.max(0, Math.min(1, (m.intro - memory.order * .15) / 1.4))
    const selected = gallerySnapshot().focus === memory.order
    const focusTarget = m.focusMix > .001 && m.focusIndex === memory.order
    const focusAmount = m.focusIndex === memory.order ? Math.max(0, Math.min(1, m.focusMix)) : 0
    const distanceAlpha = galleryDistanceOpacity(camera.position.distanceTo(group.current.getWorldPosition(worldPosition)))
    const focusAlpha = galleryFocusOpacity(m.focusMix, selected)
    const alpha = visible * (1 - m.exit / GALLERY.exit) * focusAlpha * distanceAlpha
    for (const saved of materials.current) { setMaterialAlpha(saved, alpha); setFocusFog(saved.material, focusTarget) }
    const photoDistance = camera.position.distanceTo(group.current.getWorldPosition(worldPosition))
    setShaderUniform(photoMaterialRef.current, 'uAlpha', alpha)
    setShaderUniform(photoMaterialRef.current, 'uBlur', galleryPhotoBlurAtFocus(photoDistance, focusAmount))
    setShaderUniform(photoMaterialRef.current, 'uLight', galleryPhotoLightAtFocus(photoDistance, focusAmount))
    setShaderUniform(frameMaterialRef.current, 'uTime', reducedMotion ? 0 : m.time)
    setShaderUniform(frameMaterialRef.current, 'uOpacity', alpha * (.25 + .21 * focusAmount))
    setShaderUniform(frameMaterialRef.current, 'uFocus', focusAmount)
    group.current.visible = visible > 0 && distanceAlpha > 0 && alpha > .001
    if (captionMaterial.current) captionMaterial.current.opacity = visible * (.65 + .35 * focusAmount) * focusAlpha * distanceAlpha * (1 - m.exit / GALLERY.exit)
    if (glow.current) glow.current.opacity = visible * (.28 + .27 * focusAmount) * focusAlpha * distanceAlpha * (1 - m.exit / GALLERY.exit)
    if (edge.current) edge.current.opacity = visible * .32 * (.62 + .38 * focusAmount) * focusAlpha * distanceAlpha * (1 - m.exit / GALLERY.exit)
  })
  return <group ref={group} onClick={(event) => { event.stopPropagation(); if (!paused) galleryFocus(memory.order) }}>
    <mesh position={[0, 0, -.04]}><boxGeometry args={[width + .08, height + .08, .07]} /><meshStandardMaterial color="#171b23" roughness={.96} metalness={.02} /></mesh>
    <mesh position={[0, 0, -.07]}><planeGeometry args={[width + 2, height + 2]} /><meshBasicMaterial ref={glow} map={halo} color="#ffb58f" transparent opacity={.1} depthWrite={false} blending={AdditiveBlending} /></mesh>
    {memory.order === 0 ? <FirstMemoryCard photoMaterial={photoMaterial} frameTone="moonlight" /> : memory.image ? <Photo url={memory.image} width={width} height={height} fallback={image} onAspect={setAspect} material={photoMaterialRef} /> : <mesh><planeGeometry args={[width, height]} /><primitive object={photoMaterial} attach="material" /></mesh>}
    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[0, side * (height / 2 + .025), -.005]}><planeGeometry args={[width + 1.1, .55]} /><meshBasicMaterial map={halo} color="#dce5f0" transparent opacity={.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[side * (width / 2 + .025), 0, -.005]}><planeGeometry args={[.55, height + 1.1]} /><meshBasicMaterial map={halo} color="#dce5f0" transparent opacity={.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, side * (height / 2 + .025), .02]}><planeGeometry args={[width + .1, .018]} /><meshBasicMaterial ref={side === 1 ? edge : null} color="#dce4ef" transparent opacity={.32} toneMapped={false} /></mesh>
      <mesh position={[side * (width / 2 + .025), 0, .02]}><planeGeometry args={[.018, height + .1]} /><meshBasicMaterial color="#dce4ef" transparent opacity={.32} toneMapped={false} /></mesh>
    </group>)}
    <points geometry={frameParticles}><primitive object={frameMaterial} attach="material" /></points>
    <mesh position={[0, -height / 2 - .34, .02]}><planeGeometry args={[3.4, .33]} /><meshBasicMaterial ref={captionMaterial} map={caption} transparent opacity={.65} depthWrite={false} toneMapped={false} /></mesh>
  </group>
}
function Dust({ low, reducedMotion }: { low: boolean; reducedMotion: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const count = low || reducedMotion ? GALLERY_ART.lowDustCount : GALLERY_ART.dustCount
    const positions = new Float32Array(count * 3); const sizes = new Float32Array(count); const phases = new Float32Array(count)
    const speeds = new Float32Array(count); const alphas = new Float32Array(count); const drift = new Float32Array(count * 3)
    const randomFor = (i: number, n: number) => { const value = Math.sin((i + n) * 127.1) * 43758.5453; return value - Math.floor(value) }
    for (let i = 0; i < count; i++) {
      positions.set([(randomFor(i, 1) - .5) * 19, (randomFor(i, 2) - .5) * 10, -randomFor(i, 3) * 73 + 5], i * 3)
      sizes[i] = .026 + randomFor(i, 4) * .03; phases[i] = randomFor(i, 5) * Math.PI * 2
      speeds[i] = .035 + randomFor(i, 6) * .065; alphas[i] = .08 + randomFor(i, 7) * .16
      drift.set([.035 + randomFor(i, 8) * .04, .03 + randomFor(i, 9) * .04, .018 + randomFor(i, 10) * .025], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3)); g.setAttribute('size', new BufferAttribute(sizes, 1))
    g.setAttribute('phase', new BufferAttribute(phases, 1)); g.setAttribute('speed', new BufferAttribute(speeds, 1))
    g.setAttribute('particleAlpha', new BufferAttribute(alphas, 1)); g.setAttribute('drift', new BufferAttribute(drift, 3))
    return g
  }, [low, reducedMotion])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => { setShaderUniform(material.current, 'uTime', reducedMotion ? 0 : galleryMotion.time) })
  return <points geometry={geometry}>
    <shaderMaterial ref={material} uniforms={{ uTime: { value: 0 } }} vertexShader={`
      uniform float uTime;
      attribute float size;
      attribute float phase;
      attribute float speed;
      attribute float particleAlpha;
      attribute vec3 drift;
      varying float vAlpha;
      varying float vDepth;
      void main() {
        float t = uTime * speed + phase;
        vec3 moved = position + drift * vec3(sin(t), cos(t * 0.83), sin(t * 0.57)) * 0.5;
        vec4 view = modelViewMatrix * vec4(moved, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = size * 280.0 / max(1.0, -view.z);
        vAlpha = particleAlpha * (0.76 + 0.24 * sin(t));
        vDepth = -view.z;
      }
    `} fragmentShader={`
      varying float vAlpha;
      varying float vDepth;
      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float softPoint = 1.0 - smoothstep(0.08, 0.5, radius);
        float distanceFade = 1.0 - smoothstep(30.0, 76.0, vDepth);
        float alpha = softPoint * vAlpha * mix(0.18, 1.0, distanceFade);
        gl_FragColor = vec4(0.72, 0.78, 0.87, alpha);
        #include <colorspace_fragment>
      }
    `} transparent depthWrite={false} />
  </points>
}

function GallerySpotlight() {
  const light = useRef<SpotLight>(null)
  const initialized = useRef(false)
  const target = useMemo(() => new Object3D(), [])
  const point = useMemo(() => new Vector3(), [])
  const desiredTarget = useMemo(() => new Vector3(), [])
  const desiredLight = useMemo(() => new Vector3(), [])
  const introPosition = useMemo(() => new Vector3(), [])
  useFrame(({ camera }, delta) => {
    const spotlight = light.current
    if (!spotlight) return
    const state = gallerySnapshot()
    let index = state.focus
    let nearestDistance = Number.POSITIVE_INFINITY
    if (index === null) {
      for (const memory of GALLERY_MEMORIES) {
        const [x, y, z] = memoryPosition(memory)
        const distance = camera.position.distanceTo(introPosition.set(memory.order === 0 ? x * Math.min(1, galleryMotion.intro / GALLERY.intro) : x, y, memory.order === 0 ? z * Math.min(1, galleryMotion.intro / GALLERY.intro) : z))
        if (distance < nearestDistance) { nearestDistance = distance; index = memory.order }
      }
    } else {
      const selected = GALLERY_MEMORIES[index]!
      const [, , z] = memoryPosition(selected)
      nearestDistance = camera.position.distanceTo(point.set(selected.side * GALLERY.side, 0, selected.order === 0 ? z * Math.min(1, galleryMotion.intro / GALLERY.intro) : z))
    }
    if (index === null) { spotlight.visible = false; return }
    const memory = GALLERY_MEMORIES[index]!
    const [baseX, baseY, baseZ] = memoryPosition(memory)
    const intro = memory.order === 0 ? Math.min(1, galleryMotion.intro / GALLERY.intro) : 1
    const x = memory.order === 0 ? baseX * intro : baseX
    const y = baseY
    const z = memory.order === 0 ? baseZ * intro : baseZ
    const aspect = memory.aspect
    const size = memory.order === 0 ? 2.15 : 3.3
    const height = aspect >= 1 ? size / aspect : size
    const yaw = -memory.side * GALLERY_ART.wallYaw * intro
    const front = 0.8
    point.set(x + front * Math.sin(yaw), y + height / 2 + 0.78, z + front * Math.cos(yaw))
    desiredTarget.set(x + 0.18 * Math.sin(yaw), y + 0.18, z + 0.18 * Math.cos(yaw))
    desiredLight.copy(point)
    const proximityT = Math.max(0, Math.min(1, (22 - nearestDistance) / 13))
    const proximity = proximityT * proximityT * (3 - 2 * proximityT)
    const desiredIntensity = .72 * proximity + (state.focus === index ? 1.58 : 0)
    const follow = 1 - Math.exp(-4.2 * Math.min(delta, .05))
    if (!initialized.current) {
      target.position.copy(desiredTarget)
      spotlight.position.copy(desiredLight)
      initialized.current = true
    } else {
      target.position.lerp(desiredTarget, follow)
      spotlight.position.lerp(desiredLight, follow)
    }
    target.updateMatrixWorld()
    spotlight.intensity += (desiredIntensity - spotlight.intensity) * follow
    spotlight.visible = desiredIntensity > .008 || spotlight.intensity > .008
    spotlight.angle = 0.69
    spotlight.penumbra = 0.92
    spotlight.distance = 8.5
    spotlight.decay = 2
  })
  useEffect(() => { if (light.current) light.current.target = target }, [target])
  return <><primitive object={target} /><spotLight ref={light} color="#dce7f4" intensity={0} angle={0.69} penumbra={0.92} distance={8.5} decay={2} castShadow={false} visible={false} /></>
}
export function GalleryScene({ state, reducedMotion }: SceneProps) {
  const gl = useThree(s => s.gl)
  const halo = useMemo(() => canvasTexture((ctx, w, h) => { const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gradient.addColorStop(0, 'rgba(244,248,255,.34)'); gradient.addColorStop(.24, 'rgba(219,229,244,.13)'); gradient.addColorStop(1, 'rgba(206,220,239,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h) }, 256, 256), [])
  useEffect(() => () => halo.dispose(), [halo])
  useEffect(() => { resetGallery() }, [state.revision])
  useEffect(() => bindGalleryGestures(gl.domElement, () => state.paused), [gl, state.paused])
  return <>
    <fog attach="fog" args={['#080d1c', 20, 75]} />
    <Dust low={state.quality === 'low'} reducedMotion={reducedMotion} />
    <mesh position={[0, -2.35, -32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[25, 100]} /><meshStandardMaterial color="#090d15" roughness={.98} metalness={0} /></mesh>
    {[-6, -3.6, 3.6, 6].map((x) => <mesh key={x} position={[x, -2.32, -32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.025, 100]} /><meshBasicMaterial color="#b4c0d2" transparent opacity={.1} depthWrite={false} /></mesh>)}
    {GALLERY_MEMORIES.map(memory => <Memory key={memory.id} memory={memory} reducedMotion={reducedMotion} halo={halo} paused={state.paused} />)}
    {GALLERY_MEMORIES.map(memory => { const [x, , z] = memoryPosition(memory); return <mesh key={`reflection-${memory.id}`} position={[x, -2.33, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[8, 14]} /><meshBasicMaterial map={halo} color="#c5d2e4" transparent opacity={.075} depthWrite={false} blending={AdditiveBlending} /></mesh> })}
    <FloorLights halo={halo} low={state.quality === 'low' || reducedMotion} />
    <GallerySpotlight />
    <Outro />
  </>
}


function Outro() {
  const mesh = useRef<Mesh>(null); const material = useRef<MeshBasicMaterial>(null); const direction = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => { if (!mesh.current || !material.current) return; const progress = galleryMotion.exit / GALLERY.exit; mesh.current.visible = progress > 0; camera.getWorldDirection(direction); mesh.current.position.copy(camera.position).addScaledVector(direction, .4); mesh.current.quaternion.copy(camera.quaternion); material.current.opacity = Math.min(.93, progress * .93) })
  return <mesh ref={mesh} visible={false} renderOrder={999}><planeGeometry args={[5, 5]} /><meshBasicMaterial ref={material} color="#071225" transparent opacity={0} depthTest={false} depthWrite={false} /></mesh>
}

function FloorLights({ halo, low }: { halo: CanvasTexture; low: boolean }) {
  const geometry = useMemo(() => { const count = low ? GALLERY_ART.lowFloorParticleCount : GALLERY_ART.floorParticleCount; const positions = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const side = i % 2 ? -1 : 1; const z = 6 - (i % 80) * 1.1; const spread = (Math.sin(i * 18.19) + 1) * 1.2; positions.set([side * (2.9 + spread), -2.27 + (i % 3) * .03, z], i * 3) } const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3)); return geometry }, [low])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry}><pointsMaterial map={halo} color="#c7d4e6" size={.13} transparent opacity={.2} depthWrite={false} blending={AdditiveBlending} /></points>
}
