import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DataTexture, Group, LinearFilter, ShaderMaterial, Texture, TextureLoader } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneAnimation } from './animation'
import { portraitSample, portraitVertex } from './identityMorph'
import { portraitDetailFragment, portraitPointsFragment, portraitPointsVertex, portraitPresence, portraitStage, portraitTone } from './identityPortrait'
import matteUrl from '../../assets/start_img.matte.png'

const random = (i: number) => { const n = Math.sin(i * 127.1 + 87.13) * 43758.5453; return n - Math.floor(n) }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

/** Source-coordinate samples and an alpha-only GrabCut matte. No reconstructed face. */
function createPortrait(photo: HTMLImageElement, matte: HTMLImageElement, size: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(photo, 0, 0, size, size)
  const pixels = ctx.getImageData(0, 0, size, size).data
  ctx.clearRect(0, 0, size, size); ctx.drawImage(matte, 0, 0, size, size)
  const mask = ctx.getImageData(0, 0, size, size).data
  const coverage = (x: number, y: number) => mask[(Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))) * 4]! / 255
  const positions: number[] = [], inks: number[] = [], lives: number[] = []
  const map = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, u = (x + .5) / size, v = (y + .5) / size, seed = random(i)
    const [light, contrast] = portraitSample(pixels, size, size, x, y)
    const face = ease((1 - ((u - .662) / .115) ** 2 - ((v - .41) / .19) ** 2) * 4)
    const alpha = coverage(x, y)
    const rim = clamp(alpha - Math.min(coverage(x - 2, y), coverage(x + 2, y), coverage(x, y - 2), coverage(x, y + 2)))
    // Fray the crop rather than letting the raised arm and shoulders end in a frame.
    const border = Math.min(u, 1 - u, v, 1 - v)
    const feather = ease((border - .008 - .012 * Math.sin(x * .39 + Math.sin(y * .21))) / .095)
    const start = portraitStage(u, v, seed)
    const opacity = alpha * feather
    map.set([Math.round(opacity * 255), Math.round((start - 17) / 5 * 255), Math.round(rim * 255), Math.round(face * 255)], i * 4)
    // Bright regions carry more ink; dark hair keeps fine, sparse texture.
    const density = .38 + light * .46 + contrast * .22 + face * .4
    if (opacity < .015 || seed > density) continue
    const jitter = (1 - face) * .24
    positions.push(((x + .5 + (random(i + 9) - .5) * jitter) / size - .5) * 2.795,
      (.5 - (y + .5 + (random(i + 17) - .5) * jitter) / size) * 2.795 + .104, 0)
    inks.push(Math.min(15, 1 + Math.floor(Math.pow(light, .78) * 14)),
      Math.min(1, portraitTone(light, contrast) + rim * .26), opacity * (.72 + face * .25), rim)
    lives.push(start, seed, (random(i + 31) - .5) * (.045 + (1 - face) * .48), face)
    if (rim > .16 && face < .05 && random(i + 67) > .46) {
      // Detached contour glyphs share the real silhouette's samples. They may
      // wander outwards, while facial cells stay at their source coordinates.
      const angle = random(i + 81) * Math.PI * 2
      const distance = .045 + random(i + 93) * .17
      positions.push((u - .5) * 2.795 + Math.cos(angle) * distance,
        (.5 - v) * 2.795 + .104 + Math.sin(angle) * distance, 0)
      inks.push(4 + Math.floor(seed * 11), .62 + rim * .32, opacity * .34, 1)
      lives.push(start + .15, random(i + 101), (random(i + 113) - .5) * .95, 0)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('aInk', new BufferAttribute(new Float32Array(inks), 4))
  geometry.setAttribute('aLife', new BufferAttribute(new Float32Array(lives), 4))
  const detail = new DataTexture(map, size, size)
  detail.minFilter = detail.magFilter = LinearFilter; detail.needsUpdate = true
  return { geometry, detail }
}

/** One bounded point draw and one masked source-detail draw; no simulation or React frame state. */
export function IdentityPortrait({ photo, glyphs, runtime, low, reducedMotion }: {
  photo: Texture; glyphs: Texture; runtime: FilmRuntime; low: boolean; reducedMotion: boolean
}) {
  const matte = useLoader(TextureLoader, matteUrl)
  const size = low ? 112 : 144
  const height = useThree((s) => s.size.height)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const dpr = useThree((s) => s.viewport.dpr)
  const fit = aspect < 1 ? Math.min(2.5, 1 / Math.max(.3, aspect)) : 1
  const viewHeight = 5.6 * 2 * Math.tan((aspect < 1 ? 42 : 38) * Math.PI / 360) * fit
  const cellSize = 2.795 / size * height / viewHeight * 1.12
  const data = useMemo(() => createPortrait(photo.image as HTMLImageElement, matte.image as HTMLImageElement, size), [photo, matte, size])
  const points = useMemo(() => new ShaderMaterial({ vertexShader: portraitPointsVertex, fragmentShader: portraitPointsFragment,
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPresence: { value: 0 }, uMotion: { value: 1 }, uPixelRatio: { value: 1 }, uCellSize: { value: 1 }, uGlyphs: { value: glyphs } },
  }), [glyphs])
  const detail = useMemo(() => new ShaderMaterial({ vertexShader: portraitVertex, fragmentShader: portraitDetailFragment,
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPresence: { value: 0 }, uPhoto: { value: photo }, uPortraitMap: { value: data.detail } },
  }), [photo, data])
  const group = useRef<Group>(null)
  const pointsRef = useRef<ShaderMaterial>(null), detailRef = useRef<ShaderMaterial>(null)
  useEffect(() => () => { data.geometry.dispose(); data.detail.dispose() }, [data])
  useEffect(() => () => points.dispose(), [points])
  useEffect(() => () => detail.dispose(), [detail])
  const draw = useCallback((time: number) => {
    const presence = portraitPresence(time)
    if (group.current) group.current.visible = presence > 0
    if (pointsRef.current) {
      pointsRef.current.uniforms.uTime!.value = time
      pointsRef.current.uniforms.uPresence!.value = presence
      pointsRef.current.uniforms.uMotion!.value = reducedMotion ? 0 : 1
      pointsRef.current.uniforms.uPixelRatio!.value = dpr
      pointsRef.current.uniforms.uCellSize!.value = cellSize
    }
    if (detailRef.current) {
      detailRef.current.uniforms.uTime!.value = time
      detailRef.current.uniforms.uPresence!.value = presence
    }
  }, [reducedMotion, dpr, cellSize])
  useSceneAnimation(runtime, 34, draw)
  return <group ref={group}>
    <mesh position={[0, .104, -.04]} renderOrder={1}><planeGeometry args={[2.795, 2.795]} /><primitive ref={detailRef} object={detail} attach="material" /></mesh>
    <points geometry={data.geometry} frustumCulled={false} renderOrder={2}><primitive ref={pointsRef} object={points} attach="material" /></points>
  </group>
}
