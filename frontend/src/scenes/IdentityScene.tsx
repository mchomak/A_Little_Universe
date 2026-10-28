import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, LinearFilter, Line, LineBasicMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, useSceneAnimation } from './shared/animation'
import { Lily, PlaceholderCard, Spark } from './shared/Primitives'
import { poseLily } from './shared/lilyPose'
import { galleryPosition } from './shared/layout'
import { identityFrame } from './shared/identityFrame'
import { mockLilyParticles, type LilyParticleSource } from './shared/identityParticles'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { IdentityAtmosphere } from './shared/IdentityAtmosphere'
import photoUrl from '../assets/start_img.jpg'

const vertex = `
attribute vec3 aOrigin;
attribute vec3 aSpiral;
attribute vec3 aName;
attribute vec3 aField;
attribute float aSeed;
attribute float aGlyph;
uniform float uTime;
uniform float uMotion;
uniform float uNameScale;
varying float vSeed;
varying float vGlyph;
void main() {
  float spiral = smoothstep(1.0, 5.3, uTime);
  float name = smoothstep(7.5, 10.3, uTime);
  float field = smoothstep(13.0, 17.0, uTime);
  float angle = (uTime - 4.0) * 0.13 * uMotion;
  vec3 s = aSpiral;
  s.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * s.xy;
  vec3 p = mix(aOrigin, s, spiral);
  p = mix(p, aName * vec3(uNameScale, 1.0, 1.0), name);
  p = mix(p, aField, field);
  p.z += sin(uTime * 0.8 + aSeed * 25.0) * 0.035 * uMotion;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(2.0 + aSeed * 3.4, 5.5, smoothstep(14.0, 19.0, uTime)) * (5.6 / -mv.z);
  vSeed = aSeed;
  vGlyph = aGlyph;
}`
const fragment = `
uniform float uTime;
uniform sampler2D uGlyphs;
varying float vSeed;
varying float vGlyph;
void main() {
  float r = length(gl_PointCoord - vec2(0.5));
  float glow = exp(-r * 7.0) + (1.0 - smoothstep(0.0, 0.19, r)) * 0.8;
  float glyph = texture2D(uGlyphs, vec2((vGlyph + gl_PointCoord.x) / 16.0, 1.0 - gl_PointCoord.y)).a;
  float glyphBlend = smoothstep(14.0, 19.0, uTime);
  float opacity = (1.0 - smoothstep(23.0, 28.0, uTime));
  vec3 color = mix(vec3(1.0, 0.66, 0.75), vec3(1.0, 0.94, 0.89), vSeed);
  gl_FragColor = vec4(color, mix(glow * .9, glyph * .65, glyphBlend) * opacity);
}`

function random(i: number) { const x = Math.sin(i * 127.1 + 19.19) * 43758.5453; return x - Math.floor(x) }

/** Generate all targets once; the GPU interpolates a stable set of particle identities. */
function particleGeometry(count: number, source: LilyParticleSource, image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200; canvas.height = 240
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = 'bold 180px Georgia, serif'; ctx.fillText('ВАСИЛИСА', 600, 120, 1160)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const samples: number[] = []
  for (let y = 0; y < 240; y += 2) for (let x = 0; x < 1200; x += 2) if ((pixels[(y * 1200 + x) * 4 + 3] ?? 0) > 100) samples.push(x, y)
  const photoCanvas = document.createElement('canvas'); photoCanvas.width = 112; photoCanvas.height = 112
  const photoContext = photoCanvas.getContext('2d')!; photoContext.drawImage(image, 0, 0, 112, 112)
  const photoPixels = photoContext.getImageData(0, 0, 112, 112).data
  const origin = new Float32Array(count * 3), spiral = new Float32Array(count * 3)
  const name = new Float32Array(count * 3), field = new Float32Array(count * 3), seeds = new Float32Array(count), glyphs = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const j = i * 3, seed = random(i), radius = Math.pow(random(i + 16), 0.65) * 3.1
    const theta = radius * 3.2 + (i % 3) * Math.PI * 2 / 3 + (random(i + 23) - 0.5) * 0.34
    const start = source.sample(i, count)
    origin.set(start, j)
    spiral.set([Math.cos(theta) * radius, Math.sin(theta) * radius * 0.42, (random(i + 3) - 0.5) * 1.1], j)
    const sample = Math.floor(random(i + 71) * (samples.length / 2)) * 2
    name.set([((samples[sample] ?? 600) / 1200 - 0.5) * 5.3, (0.5 - (samples[sample + 1] ?? 120) / 240) * 1.06, (random(i + 5) - 0.5) * 0.16], j)
    let fx = 0, fy = 0
    for (let attempt = 0; attempt < 8; attempt++) {
      fx = Math.floor(random(i * 19 + attempt * 2 + 100) * 112); fy = Math.floor(random(i * 23 + attempt * 2 + 200) * 112)
      if (random(i * 31 + attempt + 400) < ((photoPixels[(fy * 112 + fx) * 4] ?? 0) / 255) * .85 + .15) break
    }
    field.set([(fx / 112 - .5) * 2.795, (.5 - fy / 112) * 2.795 + .08, (random(i + 300) - 0.5) * 0.12], j)
    const pixel = (fy * 112 + fx) * 4
    const luminance = ((photoPixels[pixel] ?? 0) * .2126 + (photoPixels[pixel + 1] ?? 0) * .7152 + (photoPixels[pixel + 2] ?? 0) * .0722) / 255
    glyphs[i] = Math.min(15, Math.floor(Math.pow(luminance, .62) * 16))
    seeds[i] = seed
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(origin, 3))
  g.setAttribute('aOrigin', new BufferAttribute(origin, 3))
  g.setAttribute('aSpiral', new BufferAttribute(spiral, 3))
  g.setAttribute('aName', new BufferAttribute(name, 3))
  g.setAttribute('aField', new BufferAttribute(field, 3))
  g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  g.setAttribute('aGlyph', new BufferAttribute(glyphs, 1))
  return g
}

/** A compact glyph atlas lets the same particles become symbols as they travel. */
function makeGlyphAtlas() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'white'; ctx.font = '28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  Array.from(' .,:;irsXA25hM#@').forEach((glyph, i) => ctx.fillText(glyph, i * 32 + 16, 16))
  const texture = new CanvasTexture(canvas); texture.minFilter = LinearFilter
  return texture
}

/** A full-frame luminance map retains the original image's crop and facial geometry. */
function makeAscii(image: HTMLImageElement) {
  const source = document.createElement('canvas'); source.width = 112; source.height = 112
  const sourceContext = source.getContext('2d')!; sourceContext.drawImage(image, 0, 0, 112, 112)
  const pixels = sourceContext.getImageData(0, 0, 112, 112).data
  const canvas = document.createElement('canvas'); canvas.width = 1120; canvas.height = 1120
  const ctx = canvas.getContext('2d')!
  ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const glyphs = ' .,:;irsXA253hMHGS#9B&@'
  for (let y = 0; y < 112; y++) for (let x = 0; x < 112; x++) {
    const i = (y * 112 + x) * 4
    const l = Math.pow(((pixels[i] ?? 0) * .2126 + (pixels[i + 1] ?? 0) * .7152 + (pixels[i + 2] ?? 0) * .0722) / 255, .62)
    const value = Math.round(100 + l * 155)
    ctx.fillStyle = `rgb(${value},${Math.round(value * .86)},${Math.round(value * .87)})`
    ctx.fillText(glyphs[Math.min(glyphs.length - 1, Math.floor(l * glyphs.length))] ?? ' ', x * 10 + 5, y * 10 + 5)
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter
  return texture
}

function orbitGeometry() {
  const points: number[] = []
  for (let orbit = 0; orbit < 5; orbit++) for (let i = 0; i < 160; i++) {
    const a = i / 159 * Math.PI * 2
    const x = Math.cos(a) * (2.45 + orbit * .23), y = Math.sin(a) * (.58 + orbit * .13)
    const tilt = (orbit - 2) * .13
    points.push(x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), -0.35 + Math.sin(a) * .42)
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  return geometry
}

export function IdentityScene({ state, runtime, reducedMotion, particleSource = mockLilyParticles }: SceneProps & { particleSource?: LilyParticleSource }) {
  const lily = useRef<Group>(null), photo = useRef<Group>(null), frame = useRef<Group>(null), ascii = useRef<Group>(null), cards = useRef<Group>(null), spark = useRef<Group>(null), orbitGroup = useRef<Group>(null)
  const texture = useLoader(TextureLoader, photoUrl)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const fit = aspect < 1 ? Math.min(2.5, 1 / Math.max(.3, aspect)) : 1
  const nameScale = Math.min(1, 5.6 * 2 * Math.tan((aspect < 1 ? 42 : 38) * Math.PI / 360) * fit * aspect * .92 / 5.3)
  const asciiTexture = useMemo(() => makeAscii(texture.image as HTMLImageElement), [texture])
  const glyphAtlas = useMemo(() => makeGlyphAtlas(), [])
  const geometry = useMemo(() => particleGeometry(state.quality === 'low' ? 7000 : 16000, particleSource, texture.image as HTMLImageElement), [state.quality, particleSource, texture])
  const orbits = useMemo(() => orbitGeometry(), [])
  const orbitArrays = useMemo(() => Array.from({ length: 5 }, (_, i) => (orbits.getAttribute('position').array as Float32Array).slice(i * 480, (i + 1) * 480)), [orbits])
  const material = useMemo(() => new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 }, uNameScale: { value: 1 }, uGlyphs: { value: glyphAtlas } } }), [reducedMotion, glyphAtlas])
  const materialRef = useRef<ShaderMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => orbits.dispose(), [orbits])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => asciiTexture.dispose(), [asciiTexture])
  useEffect(() => () => glyphAtlas.dispose(), [glyphAtlas])
  const draw = useCallback((time: number) => {
    const frameValues = identityFrame(time)
    poseLily(lily.current, 1, 1); fade(lily.current, frameValues.lily)
    if (materialRef.current) { materialRef.current.uniforms.uTime!.value = time; materialRef.current.uniforms.uNameScale!.value = nameScale }
    fade(ascii.current, frameValues.ascii)
    fade(photo.current, frameValues.photo)
    fade(frame.current, frameValues.frame)
    fade(cards.current, frameValues.gallery)
    orbitGroup.current?.traverse((object) => { if (object instanceof Line && object.material instanceof LineBasicMaterial) object.material.opacity = frameValues.orbit })
    const scale = frameValues.scale
    if (ascii.current) ascii.current.scale.setScalar(scale)
    if (photo.current?.parent) photo.current.parent.scale.setScalar(scale)
    if (spark.current) {
      const end = ramp(time, [28, 34])
      const start = ramp(time, [0, 4])
      const x = -1.4 + Math.min(time / 34, 1) * 2.75
      const y = Math.sin(time * .8) * .18 * (1 - end) - .27 * end
      const z = .35 - .25 * end
      spark.current.position.set(.1 + (x - .1) * start, .16 + (y - .16) * start, .1 + (z - .1) * start)
    }
  }, [nameScale])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  return <>
    <IdentityAtmosphere runtime={runtime} low={state.quality === 'low'} reducedMotion={reducedMotion} />
    <Lily groupRef={lily} />
    <points geometry={geometry} frustumCulled={false}><primitive object={material} ref={materialRef} attach="material" /></points>
    <group ref={orbitGroup}>{Array.from({ length: 5 }, (_, i) => <line key={i}><bufferGeometry attach="geometry"><bufferAttribute attach="attributes-position" args={[orbitArrays[i]!, 3]} /></bufferGeometry><lineBasicMaterial color={new Color('#dca8bd')} transparent opacity={0.24} depthWrite={false} /></line>)}</group>
    <group position={[0, .08, 0]}>
      <group ref={ascii} position={[0, 0, .01]}><mesh><planeGeometry args={[2.15, 2.15]} /><meshBasicMaterial map={asciiTexture} transparent depthWrite={false} /></mesh></group>
      <group><FirstMemoryCard photoRef={photo} frameRef={frame} /></group>
    </group>
    <group ref={cards}>{Array.from({ length: 5 }, (_, i) => <group key={i} position={galleryPosition(i + 1)}><PlaceholderCard /></group>)}</group>
    <group ref={spark}><Spark position={[0, 0, 0]} /></group>
  </>
}
