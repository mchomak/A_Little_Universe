import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three'
import type { Camera, Mesh, Object3D, Texture } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import type { FilmState } from '../../engine/film'
import { GALLERY, GALLERY_MEMORIES } from './content'
import { galleryMotion, gallerySnapshot, subscribeGallery } from './controller'
import { getConfig, subscribeConfig, type SceneComposerConfig } from '../../systems/scene-config/config'

export interface PlanetariumPhotoRect {
  left: number
  right: number
  bottom: number
  top: number
  valid: boolean
}

export const planetariumPhotoRect: PlanetariumPhotoRect = { left: -0.12, right: 0.12, bottom: -0.12, top: 0.12, valid: false }
const corners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()]
let planetariumTexture: Texture | null = null
let heldTexture: Texture | null = null
let transitionActive = false

export function capturePlanetariumPhotoRect(photoRoot: Object3D, camera: Camera, width: number, height: number) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  photoRoot.updateWorldMatrix(true, false)
  camera.updateMatrixWorld()
  corners[0]!.set(-halfWidth, -halfHeight, 0).applyMatrix4(photoRoot.matrixWorld).project(camera)
  corners[1]!.set(halfWidth, -halfHeight, 0).applyMatrix4(photoRoot.matrixWorld).project(camera)
  corners[2]!.set(-halfWidth, halfHeight, 0).applyMatrix4(photoRoot.matrixWorld).project(camera)
  corners[3]!.set(halfWidth, halfHeight, 0).applyMatrix4(photoRoot.matrixWorld).project(camera)
  if (!corners.every(({ z }) => Number.isFinite(z) && z > -1 && z < 1)) return
  planetariumPhotoRect.left = Math.min(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x)
  planetariumPhotoRect.right = Math.max(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x)
  planetariumPhotoRect.bottom = Math.min(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y)
  planetariumPhotoRect.top = Math.max(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y)
  planetariumPhotoRect.valid = true
}

export function registerPlanetariumPhotoTexture(texture: Texture) { planetariumTexture = texture }

export function getPlanetariumPhotoTexture() { return planetariumTexture }

export function releasePlanetariumPhotoTexture(texture: Texture) {
  if (planetariumTexture !== texture) { texture.dispose(); return }
  if (transitionActive) heldTexture = texture
  else { planetariumTexture = null; texture.dispose() }
}

export function setPlanetariumTransitionActive(active: boolean) {
  transitionActive = active
  if (!active && heldTexture) {
    if (planetariumTexture === heldTexture) planetariumTexture = null
    heldTexture.dispose()
    heldTexture = null
  }
}

function smooth(start: number, end: number, time: number) {
  const value = Math.max(0, Math.min(1, (time - start) / Math.max(0.001, end - start)))
  return value * value * (3 - 2 * value)
}

const PHOTO_FADE_DURATION = 3

function photoFadeStart(settings: SceneComposerConfig['scenes']['galaxy']) {
  return Math.max(
    GALLERY.exit + 2.1,
    settings.firstStarsAt + 1.25,
    settings.galaxyRevealAt + settings.revealDuration * 0.58,
  )
}

export function getPlanetariumTransitionEnd(settings: SceneComposerConfig['scenes']['galaxy']) {
  const photoFadeEnd = photoFadeStart(settings) + PHOTO_FADE_DURATION
  return Math.max(settings.galaxyRevealAt + settings.revealDuration, photoFadeEnd)
}

export function getPlanetariumPhotoFade(time: number, settings: SceneComposerConfig['scenes']['galaxy']) {
  const start = photoFadeStart(settings)
  return smooth(start, start + PHOTO_FADE_DURATION, time)
}

export function getPlanetariumPhotoZoom(time: number) {
  return 1 + 0.015 * smooth(GALLERY.exit, GALLERY.exit + 2.2, time)
}

/** Existing Galaxy points are clipped to bright photo areas only while the photo is in frame. */
export function getPlanetariumPhotoStarMask(time: number, settings: SceneComposerConfig['scenes']['galaxy']) {
  const emergence = smooth(GALLERY.exit * 0.55, photoFadeStart(settings), time)
  return emergence * (1 - getPlanetariumPhotoFade(time, settings))
}

function createTransitionMaterial() {
  return new ShaderMaterial({
    uniforms: {
      map: { value: null as Texture | null },
      uOpacity: { value: 0 }, uCrop: { value: 0 }, uZoom: { value: 1 }, uBlur: { value: 0 }, uBottomDark: { value: 0 }, uPhotoBrightness: { value: 1 },
      uImageAspect: { value: 1 }, uViewportAspect: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uOpacity; uniform float uCrop; uniform float uZoom; uniform float uBlur; uniform float uPhotoBrightness;
      uniform float uBottomDark; uniform float uImageAspect; uniform float uViewportAspect; varying vec2 vUv;
      vec4 photoSample(vec2 uv) { return texture2D(map, uv); }
      void main() {
        float cropX = min(1.0, uViewportAspect / max(0.001, uImageAspect));
        float cropY = min(1.0, uImageAspect / max(0.001, uViewportAspect));
        vec2 coverUv = (vUv - 0.5) * vec2(cropX, cropY) / uZoom + 0.5;
        vec2 uv = mix(vUv, coverUv, uCrop);
        vec2 blurStep = vec2(0.034 / max(0.001, uImageAspect), 0.034) * uBlur;
        vec4 photo = photoSample(uv) * 0.28;
        photo += (photoSample(uv + vec2(blurStep.x, 0.0)) + photoSample(uv - vec2(blurStep.x, 0.0))
          + photoSample(uv + vec2(0.0, blurStep.y)) + photoSample(uv - vec2(0.0, blurStep.y))) * 0.12;
        photo += (photoSample(uv + blurStep) + photoSample(uv - blurStep)
          + photoSample(uv + vec2(blurStep.x, -blurStep.y)) + photoSample(uv + vec2(-blurStep.x, blurStep.y))) * 0.06;
        float lowerFade = 1.0 - smoothstep(0.12, 0.8, vUv.y);
        photo.rgb *= uPhotoBrightness * (1.0 - uBottomDark * lowerFade);
        gl_FragColor = vec4(photo.rgb, photo.a * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false,
  })
}

/** Reuses the live Planetarium photo texture and the shared camera in the existing FilmCanvas. */
export function PlanetariumTransitionOverlay({ state, runtime }: { state: FilmState; runtime: FilmRuntime }) {
  const snapshot = useSyncExternalStore(subscribeGallery, gallerySnapshot, gallerySnapshot)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const camera = useThree(({ camera: value }) => value)
  const viewport = useThree(({ size }) => ({ width: size.width, height: size.height }))
  const mesh = useRef<Mesh>(null)
  const veil = useRef<Mesh>(null)
  const veilMaterial = useMemo(() => new MeshBasicMaterial({ color: '#02040a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false }), [])
  const material = useMemo(createTransitionMaterial, [])
  const direction = useMemo(() => new Vector3(), [])
  const right = useMemo(() => new Vector3(), [])
  const up = useMemo(() => new Vector3(), [])
  const cameraPosition = useMemo(() => new Vector3(), [])
  const worldPosition = useMemo(() => new Vector3(), [])
  const isGalleryExit = state.scene === 'gallery' && snapshot.phase === 'exit' && snapshot.focus === GALLERY_MEMORIES.length - 1
  const isSpecialCosmos = state.scene === 'cosmos' && Boolean(state.planetariumTransition)
  const active = isGalleryExit || isSpecialCosmos
  const revealEnd = getPlanetariumTransitionEnd(config.scenes.galaxy)

  useEffect(() => {
    if (!active) setPlanetariumTransitionActive(false)
  }, [active])
  useEffect(() => {
    return () => { material.dispose(); veilMaterial.dispose(); setPlanetariumTransitionActive(false) }
  }, [material, veilMaterial])

  useFrame(() => {
    const currentTime = isGalleryExit ? galleryMotion.exit : runtime.time
    const completed = isSpecialCosmos && currentTime >= revealEnd
    const image = planetariumTexture
    if (!mesh.current || !image || !active || completed) {
      if (mesh.current) mesh.current.visible = false
      if (veil.current) veil.current.visible = false
      if (!active) setPlanetariumTransitionActive(false)
      return
    }
    setPlanetariumTransitionActive(true)
    const uniforms = material.uniforms
    if (uniforms.map!.value !== image) uniforms.map!.value = image

    const isPerspective = camera instanceof PerspectiveCamera
    const fov = isPerspective ? camera.getEffectiveFOV() * Math.PI / 180 : 38 * Math.PI / 180
    const aspect = viewport.width / Math.max(1, viewport.height)
    const planeDistance = 0.65
    const fullHeight = 2 * Math.tan(fov / 2) * planeDistance
    const fullWidth = fullHeight * aspect
    const imageAspect = (image.image as HTMLImageElement | undefined)?.naturalWidth
      ? (image.image as HTMLImageElement).naturalWidth / (image.image as HTMLImageElement).naturalHeight
      : 1
    const rect = planetariumPhotoRect
    const startWidth = Math.max(0.001, ((rect.right - rect.left) / 2) * fullWidth)
    const startHeight = Math.max(0.001, ((rect.top - rect.bottom) / 2) * fullHeight)
    const progress = Math.max(0, currentTime)
    const expand = smooth(1.5, GALLERY.exit, progress)
    const photoFade = getPlanetariumPhotoFade(progress, config.scenes.galaxy)
    const opacity = isGalleryExit ? smooth(0.02, 0.7, progress) : 1 - photoFade
    const photoFadeStartTime = photoFadeStart(config.scenes.galaxy)
    const environmentOpacity = isGalleryExit
      ? smooth(0.05, GALLERY.exit, progress)
      : 1 - photoFade
    const frameAspect = (startWidth + (fullWidth - startWidth) * expand) / (startHeight + (fullHeight - startHeight) * expand)
    const crop = 1
    const lowerDark = smooth(1.1, GALLERY.exit, progress) * (1 - photoFade)
    uniforms.uOpacity!.value = opacity
    uniforms.uCrop!.value = crop
    uniforms.uZoom!.value = getPlanetariumPhotoZoom(progress)
    uniforms.uBlur!.value = smooth(1.4, photoFadeStart(config.scenes.galaxy), progress)
    uniforms.uBottomDark!.value = lowerDark * 0.35
    uniforms.uPhotoBrightness!.value = 1 - 0.5 * smooth(0.15, photoFadeStartTime, progress)
    uniforms.uImageAspect!.value = imageAspect
    uniforms.uViewportAspect!.value = frameAspect

    const width = startWidth + (fullWidth - startWidth) * expand
    const height = startHeight + (fullHeight - startHeight) * expand
    const centerX = ((rect.left + rect.right) / 2) * (fullWidth / 2) * (1 - expand)
    const centerY = ((rect.bottom + rect.top) / 2) * (fullHeight / 2) * (1 - expand)
    camera.getWorldDirection(direction)
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    camera.getWorldPosition(cameraPosition)
    worldPosition.copy(cameraPosition).addScaledVector(direction, planeDistance)
      .addScaledVector(right, centerX).addScaledVector(up, centerY)
    veil.current!.position.copy(worldPosition)
    veil.current!.quaternion.copy(camera.quaternion)
    veil.current!.scale.set(fullWidth * 1.02, fullHeight * 1.02, 1)
    veilMaterial.opacity = environmentOpacity
    veil.current!.visible = environmentOpacity > 0.001
    mesh.current.position.copy(worldPosition)
    mesh.current.quaternion.copy(camera.quaternion)
    mesh.current.scale.set(width, height, 1)
    mesh.current.visible = opacity > 0.001
  })

  return <>
    <mesh ref={veil} renderOrder={9998} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <primitive object={veilMaterial} attach="material" />
    </mesh>
    <mesh ref={mesh} renderOrder={9999} frustumCulled={false} visible={false}>
    <planeGeometry args={[1, 1]} />
    <primitive object={material} attach="material" />
  </mesh>
  </>
}
