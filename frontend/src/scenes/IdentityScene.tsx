import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, LinearFilter, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, useSceneAnimation } from './shared/animation'
import { Lily } from './shared/Primitives'
import { poseLily } from './shared/lilyPose'
import { identityFrame, IDENTITY_HANDOFF } from './shared/identityFrame'
import { identityAsciiGlyph } from './shared/identityAscii'
import { createIdentityParticleData, mockLilyParticles, type LilyParticleSource } from './shared/identityParticles'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import photoUrl from '../assets/start_img.jpg'

const particleVertex = `
attribute vec3 aOrigin;
attribute vec3 aCloud;
attribute vec3 aPortrait;
attribute float aSeed;
attribute float aLuminance;
attribute float aReveal;
uniform float uTime;
uniform float uDissolve;
uniform float uGather;
uniform float uOpacity;
uniform float uMotion;
varying float vSeed;
varying float vLuminance;
varying float vOpacity;
void main() {
  float directProgress = .5 * (uDissolve + uGather);
  vec3 directPath = mix(aOrigin, aPortrait, directProgress);
  vec3 cloudPath = mix(mix(aOrigin, aCloud, uDissolve), aPortrait, uGather);
  vec3 p = mix(directPath, cloudPath, uMotion);
  p.xy += vec2(sin(uTime * .42 + aSeed * 8.0), cos(uTime * .35 + aSeed * 6.0))
    * .024 * uMotion * (1.0 - uGather);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.6 + pow(aSeed, 3.0) * 3.0) * (5.6 / -mv.z);
  vSeed = aSeed;
  vLuminance = aLuminance;
  float faceFocus = 1.0 - smoothstep(uGather * 1.22 - .16, uGather * 1.22 + .16, aReveal);
  float focus = mix(1.0, .55 + faceFocus * .45, smoothstep(0.0, 1.0, uGather));
  vOpacity = uOpacity * focus;
}`

const particleFragment = `
varying float vSeed;
varying float vLuminance;
varying float vOpacity;
void main() {
  float radius = length(gl_PointCoord - vec2(.5));
  float point = exp(-radius * 8.0) * .55 + (1.0 - smoothstep(.02, .28, radius)) * .65;
  float tone = mix(.24, .76, 1.0 - vLuminance);
  vec3 color = mix(vec3(.91, .65, .73), vec3(1.0, .94, .88), vSeed);
  gl_FragColor = vec4(color, point * tone * vOpacity);
}`

const asciiVertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const asciiFragment = `
uniform sampler2D uMap;
uniform float uReveal;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 glyph = texture2D(uMap, vUv);
  float distanceFromFace = length((vUv - vec2(.59, .62)) / vec2(.62, .66));
  float radius = pow(max(uReveal, 0.0), 1.5) * 1.32;
  float edge = 1.0 - smoothstep(radius - .14, radius + .14, distanceFromFace);
  gl_FragColor = vec4(glyph.rgb, glyph.a * edge * uOpacity);
}`

const underlayFragment = `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 photo = texture2D(uMap, vUv);
  gl_FragColor = vec4(photo.rgb, photo.a * uOpacity);
}`

function photoPixels(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = 112
  canvas.height = 112
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for the identity portrait')
  context.drawImage(image, 0, 0, 112, 112)
  return context.getImageData(0, 0, 112, 112).data
}

/** A tone-mapped glyph atlas preserves the photo crop while putting dark hair in dense ink. */
function makeAscii(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  const gridSize = 80
  const cellSize = 10
  canvas.width = gridSize * cellSize
  canvas.height = gridSize * cellSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable for the ASCII portrait')
  const source = document.createElement('canvas')
  source.width = gridSize
  source.height = gridSize
  const sourceContext = source.getContext('2d')
  if (!sourceContext) throw new Error('Canvas 2D is unavailable for the portrait luminance map')
  sourceContext.drawImage(image, 0, 0, gridSize, gridSize)
  const pixels = sourceContext.getImageData(0, 0, gridSize, gridSize).data
  ctx.font = `${cellSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
    const index = (y * gridSize + x) * 4
    const luma = ((pixels[index] ?? 0) * .2126 + (pixels[index + 1] ?? 0) * .7152 + (pixels[index + 2] ?? 0) * .0722) / 255
    const glyph = identityAsciiGlyph(luma)
    ctx.fillStyle = 'rgb(246,232,226)'
    ctx.fillText(glyph, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

function particleGeometry(count: number, source: LilyParticleSource, image: HTMLImageElement) {
  const data = createIdentityParticleData(count, source, photoPixels(image), 112, 112)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(data.origin, 3))
  geometry.setAttribute('aOrigin', new BufferAttribute(data.origin, 3))
  geometry.setAttribute('aCloud', new BufferAttribute(data.cloud, 3))
  geometry.setAttribute('aPortrait', new BufferAttribute(data.portrait, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(data.seed, 1))
  geometry.setAttribute('aLuminance', new BufferAttribute(data.luminance, 1))
  geometry.setAttribute('aReveal', new BufferAttribute(data.reveal, 1))
  return geometry
}

/** One renderer; all choreography samples the shared, seekable FilmRuntime clock. */
export function IdentityScene({ state, runtime, reducedMotion, particleSource = mockLilyParticles }: SceneProps & { particleSource?: LilyParticleSource }) {
  const lily = useRef<Group>(null)
  const portrait = useRef<Group>(null)
  const photo = useRef<Group>(null)
  const frame = useRef<Group>(null)
  const ascii = useRef<Group>(null)
  const particleMaterial = useRef<ShaderMaterial>(null)
  const asciiMaterial = useRef<ShaderMaterial>(null)
  const underlayMaterial = useRef<ShaderMaterial>(null)
  const texture = useLoader(TextureLoader, photoUrl)
  const image = texture.image as HTMLImageElement
  const asciiTexture = useMemo(() => makeAscii(image), [image])
  const geometry = useMemo(() => particleGeometry(state.quality === 'low' ? 7000 : 16000, particleSource, image), [image, particleSource, state.quality])
  const particles = useMemo(() => new ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uGather: { value: 0 }, uOpacity: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 } },
  }), [reducedMotion])
  const asciiShader = useMemo(() => new ShaderMaterial({
    vertexShader: asciiVertex,
    fragmentShader: asciiFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uMap: { value: asciiTexture }, uReveal: { value: 0 }, uOpacity: { value: 0 } },
  }), [asciiTexture])
  const underlayShader = useMemo(() => new ShaderMaterial({
    vertexShader: asciiVertex,
    fragmentShader: underlayFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uMap: { value: texture }, uOpacity: { value: 0 } },
  }), [texture])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => asciiTexture.dispose(), [asciiTexture])
  useEffect(() => () => particles.dispose(), [particles])
  useEffect(() => () => asciiShader.dispose(), [asciiShader])
  useEffect(() => () => underlayShader.dispose(), [underlayShader])

  const draw = useCallback((time: number) => {
    const frameValues = identityFrame(time)
    poseLily(lily.current, 1, 1)
    fade(lily.current, frameValues.lily)
    if (particleMaterial.current) {
      const uniforms = particleMaterial.current.uniforms
      uniforms.uTime!.value = time
      uniforms.uDissolve!.value = frameValues.disperse
      uniforms.uGather!.value = frameValues.reveal
      uniforms.uOpacity!.value = frameValues.particle
      uniforms.uMotion!.value = reducedMotion ? 0 : 1
    }
    if (asciiMaterial.current) {
      asciiMaterial.current.uniforms.uReveal!.value = frameValues.reveal
      asciiMaterial.current.uniforms.uOpacity!.value = frameValues.ascii
    }
    if (underlayMaterial.current) underlayMaterial.current.uniforms.uOpacity!.value = frameValues.underlay
    fade(photo.current, frameValues.photo)
    fade(frame.current, frameValues.frame)
    if (portrait.current) {
      portrait.current.scale.setScalar(IDENTITY_HANDOFF.scale)
      portrait.current.position.set(IDENTITY_HANDOFF.x, IDENTITY_HANDOFF.y, IDENTITY_HANDOFF.z)
    }
    if (ascii.current) ascii.current.visible = frameValues.ascii > .001
  }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)

  return <>
    <Lily groupRef={lily} />
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={particles} ref={particleMaterial} attach="material" />
    </points>
    <group ref={portrait} position={[IDENTITY_HANDOFF.x, IDENTITY_HANDOFF.y, IDENTITY_HANDOFF.z]}>
      <mesh position={[0, 0, -0.006]}>
        <planeGeometry args={[2.15, 2.15]} />
        <primitive object={underlayShader} ref={underlayMaterial} attach="material" />
      </mesh>
      <group ref={ascii} position={[0, 0, .012]}>
        <mesh>
          <planeGeometry args={[2.15, 2.15]} />
          <primitive object={asciiShader} ref={asciiMaterial} attach="material" />
        </mesh>
      </group>
      <FirstMemoryCard photoRef={photo} frameRef={frame} />
    </group>
  </>
}
