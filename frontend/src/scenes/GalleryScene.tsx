import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Material, Mesh, MeshBasicMaterial, Points, PointsMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { GALLERY, GALLERY_MEMORIES, memoryPosition, type GalleryMemory } from './gallery/content'
import { galleryFocus, galleryMotion, gallerySnapshot, resetGallery } from './gallery/controller'
import { bindGalleryGestures } from './gallery/gestures'

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
function Photo({ url, width, height, fallback, onAspect }: { url: string; width: number; height: number; fallback: CanvasTexture | null; onAspect: (value: number) => void }) {
  const [texture, setTexture] = useState<Texture | null>(null)
  useEffect(() => {
    let active = true; let loaded: Texture | null = null
    new TextureLoader().load(url, (value) => { if (!active) { value.dispose(); return } loaded = value; setColorSpace(value); const image = value.image as HTMLImageElement; if (image.naturalWidth && image.naturalHeight) onAspect(image.naturalWidth / image.naturalHeight); setTexture(value) }, undefined, () => { if (active) setTexture(null) })
    return () => { active = false; loaded?.dispose() }
  }, [url, onAspect])
  return <>
    <mesh><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture ?? fallback} toneMapped={false} /></mesh>
    <mesh position={[0, -4.7, -.08]} scale={[1, -1, 1]}><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture ?? fallback} color="#ffb996" transparent opacity={.24} depthWrite={false} toneMapped={false} /></mesh>
  </>
}
function setMaterialAlpha(saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }, alpha: number) { saved.material.opacity = saved.opacity * alpha; saved.material.transparent = alpha < 1 || saved.transparent; saved.material.depthWrite = alpha < 1 ? false : saved.depthWrite }
function setFocusFog(material: Material, focus: boolean) { if (material instanceof MeshBasicMaterial && material.fog === focus) { material.fog = !focus; material.needsUpdate = true } }
function Memory({ memory, reducedMotion, halo, paused }: { memory: GalleryMemory; reducedMotion: boolean; halo: CanvasTexture; paused: boolean }) {
  const materials = useRef<{ material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[]>([])
  const group = useRef<Group>(null); const glow = useRef<MeshBasicMaterial>(null); const edge = useRef<MeshBasicMaterial>(null); const sparks = useRef<Group>(null); const wave = useRef<Mesh>(null); const captionMaterial = useRef<MeshBasicMaterial>(null)
  const image = useMemo(() => memory.order === 0 ? null : placeholder(memory), [memory])
  const caption = useMemo(() => captionTexture(memory.caption), [memory.caption])
  useEffect(() => () => { image?.dispose(); caption.dispose() }, [image, caption])
  useEffect(() => {
    const saved: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[] = []
    group.current?.traverse((child) => { if (!(child instanceof Mesh) && !(child instanceof Points)) return; const list = Array.isArray(child.material) ? child.material : [child.material]; for (const material of list) saved.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }) })
    materials.current = saved
    return () => { materials.current = [] }
  }, [])
  const size = memory.order === 0 ? 2.15 : 3.3
  const [aspect, setAspect] = useState(memory.aspect)
  const width = aspect >= 1 ? size : size * aspect
  const height = aspect >= 1 ? size / aspect : size
  const [x, y, z] = memoryPosition(memory)
  useFrame(() => {
    if (!group.current || paused || document.hidden) return
    const m = galleryMotion;
    const t = Math.min(1, m.intro / (reducedMotion ? .35 : GALLERY.intro)); const e = t * t * (3 - 2 * t)
    const first = memory.order === 0
    group.current.position.set(first ? x * e : x, y + (reducedMotion ? 0 : Math.sin(m.time * .3 + memory.order) * .025), first ? z * e : z)
    if (first) group.current.scale.setScalar(1 + .35 * e)
    if (first) group.current.rotation.set(reducedMotion ? 0 : -.022 * (1 - e), (reducedMotion ? 0 : .065 * (1 - e)) - memory.side * .23 * e, reducedMotion ? 0 : -.009 * (1 - e))
    else group.current.rotation.y = -memory.side * .23
    const visible = first ? 1 : Math.max(0, Math.min(1, (m.intro - memory.order * .15) / 1.4))
    const selected = gallerySnapshot().focus === memory.order
    const focusTarget = m.focusMix > .001 && m.focusIndex === memory.order
    const focusFade = focusTarget ? 1 : 1 - m.focusMix
    const alpha = visible * (1 - m.exit / GALLERY.exit) * focusFade
    for (const saved of materials.current) { setMaterialAlpha(saved, alpha); setFocusFog(saved.material, focusTarget) }
    group.current.visible = visible > 0 && (focusTarget || Math.abs((GALLERY.startZ - m.progress) - z) < 40) && alpha > .001
    if (sparks.current) { sparks.current.visible = selected && !reducedMotion; sparks.current.rotation.z = m.time * .12 }
    if (wave.current) {
      wave.current.visible = selected && !reducedMotion && m.focusTime < 1.8
      const perimeter = 2 * (width + height), position = Math.min(1, m.focusTime / 1.8) * perimeter
      if (position < width) wave.current.position.set(-width / 2 + position, height / 2, .04)
      else if (position < width + height) wave.current.position.set(width / 2, height / 2 - (position - width), .04)
      else if (position < 2 * width + height) wave.current.position.set(width / 2 - (position - width - height), -height / 2, .04)
      else wave.current.position.set(-width / 2, -height / 2 + (position - 2 * width - height), .04)
    }
    if (captionMaterial.current) captionMaterial.current.opacity = visible * (selected ? 1 : .65) * focusFade * (1 - m.exit / GALLERY.exit)
    if (glow.current) glow.current.opacity = visible * (selected ? .55 : .28) * focusFade * (1 - m.exit / GALLERY.exit)
    if (edge.current) edge.current.opacity = visible * (selected ? 1 : .62) * focusFade * (1 - m.exit / GALLERY.exit)
  })
  return <group ref={group} onClick={(event) => { event.stopPropagation(); if (!paused) galleryFocus(memory.order) }}>
    <mesh position={[0, 0, -.04]}><boxGeometry args={[width + .08, height + .08, .07]} /><meshBasicMaterial color="#17121f" /></mesh>
    <mesh position={[0, 0, -.07]}><planeGeometry args={[width + 2, height + 2]} /><meshBasicMaterial ref={glow} map={halo} color="#ffb58f" transparent opacity={.1} depthWrite={false} blending={AdditiveBlending} /></mesh>
    {memory.order === 0 ? <FirstMemoryCard /> : memory.image ? <Photo url={memory.image} width={width} height={height} fallback={image} onAspect={setAspect} /> : <mesh><planeGeometry args={[width, height]} /><meshBasicMaterial map={image} toneMapped={false} /></mesh>}
    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[0, side * (height / 2 + .025), -.005]}><planeGeometry args={[width + 1.1, .55]} /><meshBasicMaterial map={halo} color="#ffc4a2" transparent opacity={.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[side * (width / 2 + .025), 0, -.005]}><planeGeometry args={[.55, height + 1.1]} /><meshBasicMaterial map={halo} color="#ffc4a2" transparent opacity={.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, side * (height / 2 + .025), .02]}><planeGeometry args={[width + .1, .018]} /><meshBasicMaterial ref={side === 1 ? edge : null} color="#ffdfc2" transparent opacity={.7} toneMapped={false} /></mesh>
      <mesh position={[side * (width / 2 + .025), 0, .02]}><planeGeometry args={[.018, height + .1]} /><meshBasicMaterial color="#ffdfc2" transparent opacity={.7} toneMapped={false} /></mesh>
    </group>)}
    <group ref={sparks} visible={false}>{Array.from({ length: 12 }, (_, i) => { const angle = i * Math.PI / 6; return <mesh key={i} position={[Math.cos(angle) * (width / 2 + .13), Math.sin(angle) * (height / 2 + .13), .05]}><planeGeometry args={[.18, .18]} /><meshBasicMaterial map={halo} color="#ffd0a0" transparent opacity={.8} depthWrite={false} blending={AdditiveBlending} /></mesh> })}</group>
    <mesh ref={wave} visible={false}><planeGeometry args={[.65, .65]} /><meshBasicMaterial map={halo} color="#fff0d9" transparent opacity={1} depthWrite={false} blending={AdditiveBlending} /></mesh>
    <mesh position={[0, -height / 2 - .34, .02]}><planeGeometry args={[3.4, .33]} /><meshBasicMaterial ref={captionMaterial} map={caption} transparent opacity={.65} depthWrite={false} toneMapped={false} /></mesh>
  </group>
}
function Dust({ low, reducedMotion, halo }: { low: boolean; reducedMotion: boolean; halo: CanvasTexture }) {
  const points = useRef<Group>(null); const material = useRef<PointsMaterial>(null)
  const geometry = useMemo(() => { const count = low || reducedMotion ? 280 : 1200; const positions = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const r = (n: number) => { const v = Math.sin((i + n) * 127.1) * 43758.5453; return v - Math.floor(v) }; positions.set([(r(1) - .5) * 19, (r(2) - .5) * 10, -r(3) * 73 + 5], i * 3) } const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(positions, 3)); return g }, [low, reducedMotion])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => { if (points.current && !reducedMotion) points.current.position.y = Math.sin(galleryMotion.time * .1) * .08; if (material.current) material.current.opacity = .8 * (1 - galleryMotion.focusMix * .6) })
  return <group ref={points}><points geometry={geometry}><pointsMaterial ref={material} map={halo} color="#e2bca7" size={.13} transparent opacity={.8} sizeAttenuation depthWrite={false} /></points></group>
}
export function GalleryScene({ state, reducedMotion }: SceneProps) {
  const gl = useThree(s => s.gl)
  const halo = useMemo(() => canvasTexture((ctx, w, h) => { const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gradient.addColorStop(0, 'rgba(255,245,231,.8)'); gradient.addColorStop(.2, 'rgba(255,212,183,.3)'); gradient.addColorStop(1, 'rgba(255,200,175,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h) }, 256, 256), [])
  useEffect(() => () => halo.dispose(), [halo])
  useEffect(() => { resetGallery() }, [state.revision])
  useEffect(() => bindGalleryGestures(gl.domElement, () => state.paused), [gl, state.paused])
  return <>
    <fog attach="fog" args={['#080d1c', 20, 75]} />
    <Dust low={state.quality === 'low'} reducedMotion={reducedMotion} halo={halo} />
    <mesh position={[0, -2.35, -32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[25, 100]} /><meshBasicMaterial color="#261a29" transparent opacity={.34} depthWrite={false} /></mesh>
    {[-6, -3.6, 3.6, 6].map((x) => <mesh key={x} position={[x, -2.32, -32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.045, 100]} /><meshBasicMaterial color="#e6aa8d" transparent opacity={.45} blending={AdditiveBlending} depthWrite={false} /></mesh>)}
    {GALLERY_MEMORIES.map(memory => <Memory key={memory.id} memory={memory} reducedMotion={reducedMotion} halo={halo} paused={state.paused} />)}
    {GALLERY_MEMORIES.map(memory => { const [x, , z] = memoryPosition(memory); return <mesh key={`reflection-${memory.id}`} position={[x, -2.1, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 10]} /><meshBasicMaterial map={halo} color="#bd7a6a" transparent opacity={.5} depthWrite={false} blending={AdditiveBlending} /></mesh> })}
    <FloorLights halo={halo} low={state.quality === 'low' || reducedMotion} />
    <BlueParticle halo={halo} />
    <Outro />
  </>
}
function BlueParticle({ halo }: { halo: CanvasTexture }) { const ref = useRef<Group>(null); useFrame(() => { if (ref.current) ref.current.position.set(0, .1, GALLERY.startZ - galleryMotion.progress - 8) }); return <group ref={ref}><mesh renderOrder={1000}><sphereGeometry args={[.04, 12, 8]} /><meshBasicMaterial color="#54b4f0" toneMapped={false} depthTest={false} /></mesh><mesh renderOrder={1000}><planeGeometry args={[.4, .4]} /><meshBasicMaterial map={halo} color="#54b4f0" transparent opacity={.4} blending={AdditiveBlending} depthTest={false} depthWrite={false} /></mesh></group> }


function Outro() {
  const mesh = useRef<Mesh>(null); const material = useRef<MeshBasicMaterial>(null); const direction = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => { if (!mesh.current || !material.current) return; const progress = galleryMotion.exit / GALLERY.exit; mesh.current.visible = progress > 0; camera.getWorldDirection(direction); mesh.current.position.copy(camera.position).addScaledVector(direction, .4); mesh.current.quaternion.copy(camera.quaternion); material.current.opacity = Math.min(.93, progress * .93) })
  return <mesh ref={mesh} visible={false} renderOrder={999}><planeGeometry args={[5, 5]} /><meshBasicMaterial ref={material} color="#071225" transparent opacity={0} depthTest={false} depthWrite={false} /></mesh>
}

function FloorLights({ halo, low }: { halo: CanvasTexture; low: boolean }) {
  const geometry = useMemo(() => { const count = low ? 100 : 240; const positions = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const side = i % 2 ? -1 : 1; const z = 6 - (i % 80) * 1.1; const spread = (Math.sin(i * 18.19) + 1) * 1.2; positions.set([side * (2.9 + spread), -2.27 + (i % 3) * .03, z], i * 3) } const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3)); return geometry }, [low])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry}><pointsMaterial map={halo} color="#ffc5a0" size={.26} transparent opacity={.8} depthWrite={false} blending={AdditiveBlending} /></points>
}
