import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, DataTexture, DoubleSide, LinearFilter, Matrix4, MeshBasicMaterial, Quaternion, SRGBColorSpace, ShaderMaterial, TextureLoader, Vector3 } from 'three'
import type { BufferGeometry, Group } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { FirstMemoryCard } from '../shared/FirstMemoryCard'
import { restorationMap, restoredPhotoFragment, restoredPhotoVertex } from '../shared/identityRestoration'
import { GALLERY_ART } from '../gallery/artDirection'
import { createFrameParticleGeometry } from '../gallery/frameParticles'
import { APPROVED_PORTRAIT_SETTINGS } from './approvedPortrait'
import { createLilyPortraitCameraBasisAtTime } from './portraitIntegration'
import { getScene04FrameAssemblyProgress, getScene04PhotoRevealClock, getScene04Timeline } from './scene04Timeline'
import photoUrl from '../../assets/start_img.jpg'

const FRAME_PARTICLE_VERTEX = `
uniform float uTime;
uniform float uProgress;
uniform float uMotion;
attribute vec3 aStartOffset;
attribute vec2 normal2d;
attribute float size;
attribute float phase;
attribute float speed;
attribute float particleAlpha;
attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float stagger = fract(phase / 6.28318530718) * .2;
  float gather = smoothstep(stagger, stagger + .8, uProgress);
  vec3 moved = position + aStartOffset * (1.0 - gather) * uMotion;
  moved.xy += normal2d * sin(uTime * speed + phase) * .008 * uMotion;
  vec4 view = modelViewMatrix * vec4(moved, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = size * 300.0 / max(1.0, -view.z);
  float shimmer = .76 + .24 * sin(uTime * speed + phase);
  vColor = color;
  vAlpha = particleAlpha * shimmer * uProgress;
}`

const FRAME_PARTICLE_FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord - .5);
  float point = 1.0 - smoothstep(.12, .5, radius);
  gl_FragColor = vec4(vColor, point * vAlpha);
}`

function createFrameAssemblyGeometry(width: number, height: number, frameIntensity: number): BufferGeometry {
  const geometry = createFrameParticleGeometry(width, height, 4704, { frameIntensity }, GALLERY_ART.frameParticleSpacing * 0.04, 0.012)
  const position = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal2d')
  const sizes = geometry.getAttribute('size').array as Float32Array
  const alpha = geometry.getAttribute('particleAlpha').array as Float32Array
  const offsets = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    sizes[index] = sizes[index]! * 1.35
    alpha[index] = Math.min(0.7, alpha[index]! * 1.25)
    const seed = Math.sin((index + 1) * 127.1 + 47.7) * 43758.5453
    const first = seed - Math.floor(seed)
    const secondSeed = Math.sin((index + 1) * 269.5 + 18.3) * 24634.6345
    const second = secondSeed - Math.floor(secondSeed)
    const nx = normals.getX(index), ny = normals.getY(index)
    const tangentX = -ny, tangentY = nx
    const normalOffset = (first - .5) * .34
    const tangentOffset = (second - .5) * .3
    const offsetX = nx === 0 && ny === 0 ? (first - .5) * .24 : nx * normalOffset + tangentX * tangentOffset
    const offsetY = nx === 0 && ny === 0 ? (second - .5) * .24 : ny * normalOffset + tangentY * tangentOffset
    offsets.set([offsetX, offsetY, (first - .5) * .12], index * 3)
  }
  geometry.setAttribute('aStartOffset', new BufferAttribute(offsets, 3))
  return geometry
}

/** The real first memory appears on the same UV plane as the settled particles. */
export function IdentityPhotoReveal({ runtime, reducedMotion }: { runtime: FilmRuntime; reducedMotion: boolean }) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const invalidate = useThree((state) => state.invalidate)
  const identitySettings = config.scenes.identity
  const texture = useLoader(TextureLoader, photoUrl)
  const photoTexture = useMemo(() => {
    const copy = texture.clone()
    copy.colorSpace = SRGBColorSpace
    copy.needsUpdate = true
    return copy
  }, [texture])
  const card = useRef<Group>(null)
  const timeline = useMemo(() => getScene04Timeline(identitySettings), [identitySettings])

  const basisAtTime = useMemo(() => createLilyPortraitCameraBasisAtTime({
    bloomSettings: config.scenes.bloom,
    identitySettings,
    aspect,
    reducedMotion,
  }), [config.scenes.bloom, identitySettings, aspect, reducedMotion])
  const basis = useMemo(() => basisAtTime(identitySettings.cameraMoveDuration), [basisAtTime, identitySettings.cameraMoveDuration])
  const photoAspect = texture.image.naturalWidth && texture.image.naturalHeight
    ? texture.image.naturalWidth / texture.image.naturalHeight
    : texture.image.width / texture.image.height
  const photoSize = useMemo(() => {
    const fitWidth = photoAspect <= basis.aspect ? basis.visibleHeight * photoAspect : basis.visibleWidth
    const fitHeight = fitWidth / photoAspect
    return [fitWidth * APPROVED_PORTRAIT_SETTINGS.scale, fitHeight * APPROVED_PORTRAIT_SETTINGS.scale] as const
  }, [photoAspect, basis])
  const orientation = useMemo(() => {
    const matrix = new Matrix4().makeBasis(
      new Vector3(...basis.right),
      new Vector3(...basis.up),
      new Vector3(-basis.forward[0], -basis.forward[1], -basis.forward[2]),
    )
    return new Quaternion().setFromRotationMatrix(matrix)
  }, [basis])

  const recovery = useMemo(() => {
    const map = new DataTexture(restorationMap(), 112, 112)
    map.minFilter = map.magFilter = LinearFilter
    map.needsUpdate = true
    return map
  }, [])
  const photoMaterial = useMemo(() => new ShaderMaterial({
    vertexShader: restoredPhotoVertex,
    // Inline the Three output-transfer helper; the shared face-to-edges shader stays intact.
    fragmentShader: restoredPhotoFragment.replace('#include <colorspace_fragment>', 'gl_FragColor = linearToOutputTexel(gl_FragColor);'),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
    uniforms: { uPhoto: { value: photoTexture }, uRestoration: { value: recovery }, uTime: { value: 22.99 }, uOpacity: { value: 0 } },
  }), [photoTexture, recovery])
  const frameGeometry = useMemo(() => createFrameAssemblyGeometry(photoSize[0], photoSize[1], config.scenes.gallery.frameIntensity),
    [photoSize, config.scenes.gallery.frameIntensity])
  const frameMaterial = useMemo(() => new ShaderMaterial({
    vertexShader: FRAME_PARTICLE_VERTEX,
    fragmentShader: FRAME_PARTICLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 } },
  }), [reducedMotion])
  const frameRailMaterial = useMemo(() => new MeshBasicMaterial({
    color: '#e4c7b7', transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  }), [])
  const photoMaterialRef = useRef(photoMaterial)
  const frameMaterialRef = useRef(frameMaterial)
  const frameRailMaterialRef = useRef(frameRailMaterial)

  useLayoutEffect(() => () => photoTexture.dispose(), [photoTexture])
  useLayoutEffect(() => () => recovery.dispose(), [recovery])
  useLayoutEffect(() => () => photoMaterial.dispose(), [photoMaterial])
  useLayoutEffect(() => () => frameGeometry.dispose(), [frameGeometry])
  useLayoutEffect(() => () => frameMaterial.dispose(), [frameMaterial])
  useLayoutEffect(() => () => frameRailMaterial.dispose(), [frameRailMaterial])
  useLayoutEffect(() => {
    photoMaterialRef.current = photoMaterial
    frameMaterialRef.current = frameMaterial
    frameRailMaterialRef.current = frameRailMaterial
  }, [photoMaterial, frameMaterial, frameRailMaterial])

  const draw = useCallback((time: number) => {
    const photoVisible = time > timeline.photoStart
    const frameProgress = reducedMotion && time > timeline.frameStart
      ? 1
      : getScene04FrameAssemblyProgress(time, timeline)
    if (card.current) card.current.visible = photoVisible
    photoMaterialRef.current.uniforms.uTime!.value = getScene04PhotoRevealClock(time, timeline)
    photoMaterialRef.current.uniforms.uOpacity!.value = photoVisible ? 1 : 0
    frameMaterialRef.current.uniforms.uTime!.value = reducedMotion ? 0 : time - timeline.frameStart
    frameMaterialRef.current.uniforms.uProgress!.value = frameProgress
    frameMaterialRef.current.uniforms.uMotion!.value = reducedMotion ? 0 : 1
    frameRailMaterialRef.current.opacity = frameProgress * 0.24
    invalidate()
  }, [invalidate, reducedMotion, timeline])

  useLayoutEffect(() => {
    draw(runtime.time)
    return runtime.subscribeFrame(draw)
  }, [draw, runtime])

  // These controls place the square photo exactly on the portrait camera plane;
  // later camera retreat therefore preserves UV alignment while changing only scale.
  const cardScale: [number, number, number] = [photoSize[0] / 2.15, photoSize[1] / 2.15, 1]
  const frameWidth = photoSize[0] + 0.024
  const frameHeight = photoSize[1] + 0.024
  const frameThickness = 0.006
  return <group position={basis.center} quaternion={orientation}>
    <group ref={card} scale={cardScale}>
      <FirstMemoryCard photoMaterial={photoMaterial} showFrame={false} />
    </group>
    <group position={[0, 0, 0.055]}>
      <mesh position={[0, frameHeight / 2, 0]}><planeGeometry args={[frameWidth, frameThickness]} /><primitive object={frameRailMaterial} attach="material" /></mesh>
      <mesh position={[0, -frameHeight / 2, 0]}><planeGeometry args={[frameWidth, frameThickness]} /><primitive object={frameRailMaterial} attach="material" /></mesh>
      <mesh position={[frameWidth / 2, 0, 0]}><planeGeometry args={[frameThickness, frameHeight]} /><primitive object={frameRailMaterial} attach="material" /></mesh>
      <mesh position={[-frameWidth / 2, 0, 0]}><planeGeometry args={[frameThickness, frameHeight]} /><primitive object={frameRailMaterial} attach="material" /></mesh>
    </group>
    <points position={[0, 0, .08]} geometry={frameGeometry} frustumCulled={false}>
      <primitive object={frameMaterial} attach="material" />
    </points>
  </group>
}

