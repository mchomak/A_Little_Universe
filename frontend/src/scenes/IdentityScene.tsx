import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DataTexture, Group, LinearFilter, Line, LineBasicMaterial, Mesh, NearestFilter, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, smooth, useSceneAnimation } from './shared/animation'
import { identityFrame } from './shared/identityFrame'
import { identityNameGLSL } from './shared/identityName'
import { identityMorphGLSL, portraitCell, portraitFragment, portraitSample, portraitVertex } from './shared/identityMorph'
import { mockLilyParticles, type LilyParticleSource } from './shared/identityParticles'
import { createVortexAttributes, identityLegacyRevealGLSL, identityVortexGLSL } from './shared/identityVortex'
import { IdentityTrails } from './shared/IdentityTrails'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { IdentityAtmosphere } from './shared/IdentityAtmosphere'
import { IdentityPortrait } from './shared/CosmicPortraitField'
import { portraitPresence } from './shared/identityPortrait'
import { restorationFrame, restorationMap, restorationGLSL, restoredPhotoFragment, restoredPhotoVertex, restoredRimFragment } from './shared/identityRestoration'
import { FIRST_MEMORY_POSITION, firstMemoryFrame } from './shared/firstMemoryFrame'
import { FirstMemorySpace } from './shared/FirstMemorySpace'
import photoUrl from '../assets/start_img.jpg'

const vertex = `
attribute vec3 aOrigin;
attribute vec3 aSpiral;
attribute vec3 aName;
attribute vec3 aField;
attribute float aSeed;
attribute float aGlyph;
attribute vec4 aVortex;
attribute vec4 aImpulse;
attribute vec4 aNameFace;
attribute vec4 aMorph;
uniform float uTime;
uniform float uMotion;
uniform float uNameScale;
uniform float uNamePixelScale;
uniform float uVortexScale;
varying float vSeed;
varying float vGlyph;
varying float vVortexLight;
varying float vName;
varying float vWave;
varying float vDepthLight;
varying float vGlyphBlend;
varying float vMorphLight;
varying vec2 vPhotoUv;
${identityVortexGLSL}
${identityNameGLSL}
${identityMorphGLSL}
void main() {
  float name = smoothstep(7.5, 10.3, uTime);
  float field = smoothstep(13.0, 17.0, uTime);
  vec3 p = identityVortexPosition(aOrigin, aSpiral, aVortex, aImpulse, aSeed, uTime, uMotion);
  p *= mix(1.0, uVortexScale, identityVortexEnvelope(uTime));
  p = mix(p, aName * vec3(uNameScale, 1.0, 1.0), name);
  float focus = identityNameFocus(uTime);
  float assembled = identityNameAssembly(uTime, aNameFace.w, aSeed, uMotion);
  if (uTime > 8.0) {
    // Keep the exact 04.2 endpoint, including its already-started legacy morph.
    vec3 entry = identityVortexPosition(aOrigin, aSpiral, aVortex, aImpulse, aSeed, 8.0, uMotion);
    entry *= uVortexScale;
    entry = mix(entry, aName * vec3(uNameScale, 1.0, 1.0), smoothstep(7.5, 10.3, 8.0));
    vec3 target = aNameFace.xyz * vec3(uNameScale, 1.0 + .4 * focus, 1.0 + .6 * focus);
    vec3 flow = mix(entry, target, assembled);
    float travel = identityNameTravel(uTime, aNameFace.w, aSeed);
    float arc = sin(travel * 3.141593) * (1.0 - travel) * uMotion;
    flow += vec3(sin(aNameFace.w * 2.094) * .34 * uNameScale,
      cos(aNameFace.w * 2.094) * .26, .3 * sin(aSeed * 6.283)) * arc;
    p = mix(p, flow, 1.0 - smoothstep(13.0, 17.0, uTime));
  }
  p = mix(p, aField, field);
  float travel = identityMorphTravel(uTime, aMorph);
  float symbol = smoothstep(.12, .74, travel);
  float morph = step(13.0, uTime) * (1.0 - step(17.0, uTime));
  if (uTime >= 13.0 && uTime < 17.0) {
    // Start at the exact held letter volume, rather than blending it twice via a cloud.
    vec3 source = aNameFace.xyz * vec3(uNameScale, 1.4, 1.6);
    p = identityMorphPosition(source, aField, travel, aSeed, uMotion);
  }
  p.z += sin(uTime * 0.8 + aSeed * 25.0) * 0.035 * uMotion * (1.0 - focus * .8);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float shot = identityVortexEnvelope(uTime);
  float dust = 1.0 - step(.5, aVortex.w);
  float fast = step(1.5, aVortex.w);
  float size = mix(2.0 + aSeed * 3.4, 1.6 + pow(aSeed, 4.0) * 3.5 + fast * 1.7, shot);
  float accent = step(.978, aSeed);
  vName = focus * smoothstep(.75, 1.0, assembled);
  vName = mix(vName, 1.0 - symbol, morph);
  vWave = identityNameWave(uTime, aNameFace.x) * uMotion;
  size = mix(size, (2.8 + aSeed * 1.2 + accent * (15.0 + vWave * 5.0)) * uNamePixelScale, vName);
  vDepthLight = .82 + .18 * clamp(aNameFace.z / .16 + .5, 0.0, 1.0);
  float pointSize = mix(size, 5.5, smoothstep(14.0, 19.0, uTime));
  float settledSize = mix(2.0 + aSeed * 3.4, 5.5, smoothstep(14.0, 19.0, 17.0));
  pointSize = mix(pointSize, mix(size, settledSize, symbol), morph);
  gl_PointSize = pointSize * (5.6 / -mv.z);
  // At 17s these rejoin the original 04.5 uniforms exactly.
  vGlyphBlend = mix(smoothstep(14.0, 19.0, uTime), symbol * smoothstep(14.0, 19.0, 17.0), morph);
  float sculpt = smoothstep(13.0, 14.5, uTime) * (1.0 - smoothstep(16.6, 17.0, uTime));
  vMorphLight = mix(1.0, .04 + .96 * aMorph.w * aMorph.w, sculpt * symbol * morph);
  vVortexLight = mix(1.0, mix(.3, 1.12, 1.0 - dust) + fast * .3, shot);
  vSeed = aSeed;
  vGlyph = aGlyph;
  vPhotoUv = (aField.xy - vec2(0.0, .104)) / 2.795 + .5;
}`
const fragment = `
uniform float uTime;
uniform float uParticleReveal;
uniform float uPortraitPresence;
uniform sampler2D uGlyphs;
varying float vSeed;
varying float vGlyph;
varying float vVortexLight;
varying float vName;
varying float vWave;
varying float vDepthLight;
varying float vGlyphBlend;
varying float vMorphLight;
varying vec2 vPhotoUv;
${restorationGLSL}
${identityLegacyRevealGLSL}
void main() {
  float r = length(gl_PointCoord - vec2(0.5));
  float glow = exp(-r * 7.0) + (1.0 - smoothstep(0.0, 0.19, r)) * 0.8;
  float glyph = texture2D(uGlyphs, vec2((vGlyph + gl_PointCoord.x) / 16.0, 1.0 - gl_PointCoord.y)).a;
  float glyphBlend = vGlyphBlend;
  float opacity = uParticleReveal * (1.0 - smoothstep(23.0, 28.0, uTime)) * (1.0 - uPortraitPresence);
  if (uTime > 23.0 && uTime < 28.0) opacity = 1.0 - photographicRecovery(vec2(vPhotoUv.x, 1.0 - vPhotoUv.y), uTime);
  opacity *= identityLegacyReveal(uTime);
  vec3 color = mix(vec3(1.0, 0.66, 0.75), vec3(1.0, 0.94, 0.89), vSeed);
  float accent = step(.978, vSeed);
  vec2 uv = gl_PointCoord - .5;
  float core = (1.0 - smoothstep(mix(.12, .025, accent), mix(.32, .095, accent), r)) * 1.1;
  float halo = exp(-r * 8.5) * (.12 + accent * .8);
  float rays = exp(-min(abs(uv.x), abs(uv.y)) * 75.0) * (1.0 - smoothstep(.12, .48, r)) * accent * .5;
  float nameLight = (core + halo + rays) * (1.0 + vWave * .65) * vDepthLight;
  color = mix(color, mix(vec3(1.0, .62, .73), vec3(1.0, .93, .82), vSeed), vName);
  float light = mix(glow * .9 * vVortexLight, nameLight, vName);
  gl_FragColor = vec4(color, mix(light, glyph * .65, glyphBlend) * opacity * vMorphLight);
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
  const edges: number[] = []
  let minY = 240, maxY = 0
  const alpha = (px: number, py: number) => px < 0 || px >= 1200 || py < 0 || py >= 240 ? 0 : pixels[(py * 1200 + px) * 4 + 3] ?? 0
  for (let y = 0; y < 240; y += 2) for (let x = 0; x < 1200; x += 2) {
    if (alpha(x, y) <= 100) continue
    samples.push(x, y)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    if (alpha(x - 2, y) < 100 || alpha(x + 2, y) < 100 || alpha(x, y - 2) < 100 || alpha(x, y + 2) < 100) edges.push(x, y)
  }
  const photoCanvas = document.createElement('canvas'); photoCanvas.width = 112; photoCanvas.height = 112
  const photoContext = photoCanvas.getContext('2d')!; photoContext.drawImage(image, 0, 0, 112, 112)
  const photoPixels = photoContext.getImageData(0, 0, 112, 112).data
  const origin = new Float32Array(count * 3), spiral = new Float32Array(count * 3)
  const name = new Float32Array(count * 3), field = new Float32Array(count * 3), seeds = new Float32Array(count), glyphs = new Float32Array(count)
  const face = new Float32Array(count * 4)
  const morph = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const j = i * 3, seed = random(i), radius = Math.pow(random(i + 16), 0.65) * 3.1
    const theta = radius * 3.2 + (i % 3) * Math.PI * 2 / 3 + (random(i + 23) - 0.5) * 0.34
    const start = source.sample(i, count)
    origin.set(start, j)
    spiral.set([Math.cos(theta) * radius, Math.sin(theta) * radius * 0.42, (random(i + 3) - 0.5) * 1.1], j)
    // Fine perimeter plus a filled face. Stable identities still feed the portrait.
    const pool = i % 5 < 2 && edges.length ? edges : samples
    const sample = Math.floor(random(i + 71) * (pool.length / 2)) * 2
    face.set([((pool[sample] ?? 600) / 1200 - 0.5) * 5.3, ((minY + maxY) / 2 - (pool[sample + 1] ?? 120)) / 240 * 1.06, (random(i + 5) - 0.5) * 0.16, i % 3], i * 4)
    const legacySample = Math.floor(random(i + 71) * (samples.length / 2)) * 2
    name.set([((samples[legacySample] ?? 600) / 1200 - .5) * 5.3, (.5 - (samples[legacySample + 1] ?? 120) / 240) * 1.06, (random(i + 5) - .5) * .16], j)
    let fx = 0, fy = 0
    for (let attempt = 0; attempt < 8; attempt++) {
      fx = Math.floor(random(i * 19 + attempt * 2 + 100) * 112); fy = Math.floor(random(i * 23 + attempt * 2 + 200) * 112)
      if (random(i * 31 + attempt + 400) < ((photoPixels[(fy * 112 + fx) * 4] ?? 0) / 255) * .85 + .15) break
    }
    field.set([(fx / 112 - .5) * 2.795, (.5 - fy / 112) * 2.795 + .08, (random(i + 300) - 0.5) * 0.12], j)
    const pixel = (fy * 112 + fx) * 4
    const luminance = ((photoPixels[pixel] ?? 0) * .2126 + (photoPixels[pixel + 1] ?? 0) * .7152 + (photoPixels[pixel + 2] ?? 0) * .0722) / 255
    morph.set(portraitCell(...portraitSample(photoPixels, 112, 112, fx, fy), fx, fy), i * 4)
    glyphs[i] = Math.min(15, Math.floor(Math.pow(luminance, .62) * 16))
    seeds[i] = seed
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(origin, 3))
  g.setAttribute('aOrigin', new BufferAttribute(origin, 3))
  g.setAttribute('aSpiral', new BufferAttribute(spiral, 3))
  g.setAttribute('aName', new BufferAttribute(name, 3))
  g.setAttribute('aNameFace', new BufferAttribute(face, 4))
  g.setAttribute('aMorph', new BufferAttribute(morph, 4))
  g.setAttribute('aField', new BufferAttribute(field, 3))
  g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  g.setAttribute('aGlyph', new BufferAttribute(glyphs, 1))
  const vortex = createVortexAttributes(count)
  g.setAttribute('aVortex', new BufferAttribute(vortex.orbit, 4))
  g.setAttribute('aImpulse', new BufferAttribute(vortex.impulse, 4))
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
  const deliveryData = new Uint8Array(112 * 112 * 4)
  for (let y = 0; y < 112; y++) for (let x = 0; x < 112; x++) {
    const i = (y * 112 + x) * 4
    const cell = portraitCell(...portraitSample(pixels, 112, 112, x, y), x, y)
    deliveryData[i] = Math.round((cell[2] - 13) / 4 * 255)
    deliveryData[i + 1] = Math.round((Math.min(16.98, cell[2] + .62) - 13) / 4 * 255)
    const l = Math.pow(((pixels[i] ?? 0) * .2126 + (pixels[i + 1] ?? 0) * .7152 + (pixels[i + 2] ?? 0) * .0722) / 255, .62)
    const value = Math.round(100 + l * 155)
    ctx.fillStyle = `rgb(${value},${Math.round(value * .86)},${Math.round(value * .87)})`
    ctx.fillText(glyphs[Math.min(glyphs.length - 1, Math.floor(l * glyphs.length))] ?? ' ', x * 10 + 5, y * 10 + 5)
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter
  const delivery = new DataTexture(deliveryData, 112, 112)
  delivery.minFilter = delivery.magFilter = NearestFilter
  delivery.needsUpdate = true
  return { texture, delivery }
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
  const photo = useRef<Group>(null), frame = useRef<Group>(null), ascii = useRef<Group>(null), orbitGroup = useRef<Group>(null), memory = useRef<Group>(null)
  const texture = useLoader(TextureLoader, photoUrl)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const dpr = useThree((s) => s.viewport.dpr)
  const namePixelScale = dpr * (state.quality === 'low' ? 1.28 : 1)
  const fit = aspect < 1 ? Math.min(2.5, 1 / Math.max(.3, aspect)) : 1
  const visibleWidth = 5.6 * 2 * Math.tan((aspect < 1 ? 42 : 38) * Math.PI / 360) * fit * aspect
  const nameScale = Math.min(1, visibleWidth * .92 / 5.3)
  const vortexScale = Math.min(1, visibleWidth * .94 / 6.5)
  const asciiTextures = useMemo(() => makeAscii(texture.image as HTMLImageElement), [texture])
  const recoveryMap = useMemo(() => {
    const map = new DataTexture(restorationMap(), 112, 112)
    map.minFilter = map.magFilter = LinearFilter; map.needsUpdate = true
    return map
  }, [])
  const asciiMaterial = useMemo(() => new ShaderMaterial({ vertexShader: portraitVertex, fragmentShader: portraitFragment,
    transparent: true, depthWrite: false, uniforms: { uAscii: { value: asciiTextures.texture }, uDelivery: { value: asciiTextures.delivery }, uRestoration: { value: recoveryMap }, uTime: { value: 0 }, opacity: { value: 0 } },
  }), [asciiTextures, recoveryMap])
  const restoredPhoto = useMemo(() => new ShaderMaterial({ vertexShader: restoredPhotoVertex, fragmentShader: restoredPhotoFragment,
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uPhoto: { value: texture }, uRestoration: { value: recoveryMap }, uTime: { value: 0 }, uOpacity: { value: 0 } },
  }), [texture, recoveryMap])
  const restoredRim = useMemo(() => new ShaderMaterial({ vertexShader: restoredPhotoVertex, fragmentShader: restoredRimFragment,
    transparent: true, depthWrite: false, toneMapped: false, uniforms: { uOpacity: { value: 0 } },
  }), [])
  const asciiMaterialRef = useRef<ShaderMaterial>(null)
  const glyphAtlas = useMemo(() => makeGlyphAtlas(), [])
  const geometry = useMemo(() => particleGeometry(state.quality === 'low' ? 7000 : 16000, particleSource, texture.image as HTMLImageElement), [state.quality, particleSource, texture])
  const orbits = useMemo(() => orbitGeometry(), [])
  const orbitArrays = useMemo(() => Array.from({ length: 5 }, (_, i) => (orbits.getAttribute('position').array as Float32Array).slice(i * 480, (i + 1) * 480)), [orbits])
  const material = useMemo(() => new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uParticleReveal: { value: 0 }, uRestoration: { value: recoveryMap }, uPortraitPresence: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 }, uNameScale: { value: 1 }, uNamePixelScale: { value: 1 }, uVortexScale: { value: 1 }, uGlyphs: { value: glyphAtlas } } }), [reducedMotion, glyphAtlas, recoveryMap])
  const materialRef = useRef<ShaderMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => orbits.dispose(), [orbits])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => { asciiTextures.texture.dispose(); asciiTextures.delivery.dispose() }, [asciiTextures])
  useEffect(() => () => asciiMaterial.dispose(), [asciiMaterial])
  useEffect(() => () => recoveryMap.dispose(), [recoveryMap])
  useEffect(() => () => restoredPhoto.dispose(), [restoredPhoto])
  useEffect(() => () => restoredRim.dispose(), [restoredRim])
  useEffect(() => () => glyphAtlas.dispose(), [glyphAtlas])
  const draw = useCallback((time: number) => {
    const frameValues = identityFrame(time)
    const portrait = portraitPresence(time)
    const recovery = restorationFrame(time)
    if (materialRef.current) {
      materialRef.current.uniforms.uTime!.value = time
      materialRef.current.uniforms.uParticleReveal!.value = frameValues.particleReveal
      materialRef.current.uniforms.uPortraitPresence!.value = portrait
      materialRef.current.uniforms.uNameScale!.value = nameScale
      materialRef.current.uniforms.uNamePixelScale!.value = namePixelScale
      materialRef.current.uniforms.uVortexScale!.value = vortexScale
      materialRef.current.uniforms.uMotion!.value = reducedMotion ? 0 : 1
    }
    if (ascii.current) ascii.current.visible = frameValues.ascii > 0
    if (asciiMaterialRef.current) {
      asciiMaterialRef.current.uniforms.uTime!.value = time
      // Delivered structure may read before the full matrix. Never exceed the
      // existing 17s opacity, and leave every later portrait/photo cue intact.
      asciiMaterialRef.current.uniforms.opacity!.value = time < 17
        ? Math.max(frameValues.ascii, .4 * smooth(ramp(time, [15, 16]))) : frameValues.ascii * (1 - portrait)
      // A partially restored cell must not hide the photograph behind it.
      asciiMaterialRef.current.depthWrite = !recovery.active && asciiMaterialRef.current.uniforms.opacity!.value > .95
    }
    fade(photo.current, frameValues.photo * (1 - portrait))
    photo.current?.traverse((object) => {
      if ('material' in object && object.material instanceof ShaderMaterial) {
        object.material.uniforms.uTime!.value = time
        object.material.uniforms.uOpacity!.value = frameValues.photo * (1 - portrait)
      }
    })
    if (frame.current?.parent) {
      frame.current.parent.traverse((object) => {
        if ('material' in object && object.material instanceof ShaderMaterial && object.material.uniforms.uOpacity && !object.material.uniforms.uPhoto) {
          object.material.uniforms.uOpacity.value = recovery.rim
        }
      })
    }
    fade(frame.current, frameValues.frame)
    frame.current?.traverse((object) => {
      if (object instanceof Mesh && object.userData.memoryEdgeGlow && !Array.isArray(object.material)) object.material.depthWrite = false
    })
    // Retire the old wire rings at the 04.2 handoff; never flash them back over the name.
    const orbitOpacity = frameValues.orbit * (1 - ramp(time, [4, 4.35]))
    if (orbitGroup.current) orbitGroup.current.visible = orbitOpacity > .001
    orbitGroup.current?.traverse((object) => { if (object instanceof Line && object.material instanceof LineBasicMaterial) object.material.opacity = orbitOpacity })
    const scale = frameValues.scale
    if (ascii.current) ascii.current.scale.setScalar(scale)
    if (photo.current?.parent) photo.current.parent.scale.setScalar(scale)
    if (memory.current) memory.current.rotation.set(...firstMemoryFrame(time, reducedMotion).rotation)
  }, [nameScale, vortexScale, reducedMotion, namePixelScale])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  return <>
    <IdentityAtmosphere runtime={runtime} low={state.quality === 'low'} reducedMotion={reducedMotion} />
    <FirstMemorySpace runtime={runtime} low={state.quality === 'low'} reducedMotion={reducedMotion} />
    <IdentityPortrait photo={texture} glyphs={glyphAtlas} runtime={runtime} low={state.quality === 'low'} reducedMotion={reducedMotion} />
    <points geometry={geometry} frustumCulled={false}><primitive object={material} ref={materialRef} attach="material" /></points>
    <IdentityTrails geometry={geometry} runtime={runtime} low={state.quality === 'low'} reducedMotion={reducedMotion} scale={vortexScale} />
    <group ref={orbitGroup} visible={false}>{Array.from({ length: 5 }, (_, i) => <line key={i}><bufferGeometry attach="geometry"><bufferAttribute attach="attributes-position" args={[orbitArrays[i]!, 3]} /></bufferGeometry><lineBasicMaterial color={new Color('#dca8bd')} transparent opacity={0.24} depthWrite={false} /></line>)}</group>
    <group ref={memory} position={FIRST_MEMORY_POSITION}>
      <group ref={ascii} position={[0, 0, .01]}><mesh><planeGeometry args={[2.15, 2.15]} /><primitive ref={asciiMaterialRef} object={asciiMaterial} attach="material" /></mesh></group>
      <group><FirstMemoryCard photoRef={photo} frameRef={frame} photoMaterial={restoredPhoto} rimMaterial={restoredRim} /></group>
    </group>
  </>
}
