import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  ClampToEdgeWrapping,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  NoColorSpace,
  RedFormat,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  UnsignedByteType,
  type Texture,
} from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { TIMING } from '../../engine/filmConfig'
import photoUrl from '../../assets/start_img.jpg'
import { createLilyPortraitCameraBasisAtTime, type LilyPortraitCameraWorkerSettings } from './portraitIntegration'
import { APPROVED_PORTRAIT_SETTINGS } from './approvedPortrait'
import { updateLilyPortraitPhotoProgress, type LilyDissolveUniforms } from './dissolve'
import {
  createLilyPortraitPhotoPlaneAttributes,
  createLilyPortraitPhotoRevealMap,
  getLilyPortraitPhotoRevealAnchor,
  getLilyPortraitPhotoRevealAnchorForReplay,
  getLilyPortraitPhotoLastArrivalTime,
  getLilyPortraitPhotoRequiredSceneDuration,
  getLilyPortraitPhotoRevealProgress,
  getLilyPortraitPhotoStableRevealAnchor,
} from './portraitPhotoReveal'

interface LilyPortraitPhotoRevealProps {
  portrait: { width: number; height: number }
  cameraSettings: LilyPortraitCameraWorkerSettings
  geometry: BufferGeometry
  braking: number
  runtime: FilmRuntime
  uniforms: LilyDissolveUniforms
  canResolveSceneDuration: boolean
  onRequiredSceneDuration: (duration: number, canResolve: boolean) => void
  onIdentityPreparationPending: (pending: boolean) => void
}

const PHOTO_VERTEX_SHADER = /* glsl */ `
  varying vec2 vPhotoUv;
  void main() {
    vPhotoUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PHOTO_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform sampler2D uRevealMap;
  uniform float uRevealProgress;
  varying vec2 vPhotoUv;
  void main() {
    if (uRevealProgress <= 0.0) discard;
    float arrival = texture2D(uRevealMap, vPhotoUv).r;
    float feather = 0.026;
    float coverage = 1.0 - smoothstep(uRevealProgress - feather, uRevealProgress + feather, arrival);
    if (uRevealProgress >= 1.0) coverage = 1.0;
    if (coverage <= 0.001) discard;
    vec3 original = texture2D(uPhoto, vPhotoUv).rgb;
    gl_FragColor = vec4(original, coverage);
    #include <colorspace_fragment>
  }
`

/** Shows the existing photo on the exact approved particle plane after every current route has landed. */
export function LilyPortraitPhotoReveal({ portrait, cameraSettings, geometry, braking, runtime, uniforms, canResolveSceneDuration,
  onRequiredSceneDuration, onIdentityPreparationPending }: LilyPortraitPhotoRevealProps) {
  const invalidate = useThree((state) => state.invalidate)
  const aspect = portrait.width / Math.max(1, portrait.height)
  const lastArrival = useMemo(() => {
    const motion = geometry.getAttribute('aPortraitMotion')
    const routes = geometry.getAttribute('aPortraitRoute')
    return motion && routes ? getLilyPortraitPhotoLastArrivalTime(motion.array, routes.array, braking) : 0
  }, [braking, geometry])
  const [photoReadyAt, setPhotoReadyAt] = useState<number | null>(null)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  const [revealAnchorSnapshot, setRevealAnchorSnapshot] = useState<{ geometry: BufferGeometry; anchor: number; readyAt: number } | null>(null)
  const lastObservedTime = useRef(runtime.time)
  const geometryReady = useMemo(() => ({ geometry, readyAt: runtime.time }), [geometry, runtime])
  const geometryReadyAt = geometryReady.readyAt
  const latestReadyAt = Math.max(photoReadyAt ?? 0, geometryReadyAt)
  const effectiveReadyAt = revealAnchorSnapshot?.geometry === geometry ? revealAnchorSnapshot.readyAt : latestReadyAt
  const candidateRevealAnchor = photoReadyAt === null ? null
    : getLilyPortraitPhotoRevealAnchor(lastArrival, effectiveReadyAt)
  const revealAnchor = candidateRevealAnchor === null ? null : revealAnchorSnapshot
    ? getLilyPortraitPhotoStableRevealAnchor(revealAnchorSnapshot.anchor, candidateRevealAnchor, runtime.time)
    : candidateRevealAnchor
  if (revealAnchor !== null && (revealAnchorSnapshot?.geometry !== geometry || revealAnchorSnapshot.anchor !== revealAnchor
    || revealAnchorSnapshot.readyAt !== effectiveReadyAt)) {
    setRevealAnchorSnapshot({ geometry, anchor: revealAnchor, readyAt: effectiveReadyAt })
  }
  const requiredSceneDuration = useMemo(() => getLilyPortraitPhotoRequiredSceneDuration(revealAnchor ?? lastArrival), [lastArrival, revealAnchor])
  const materialRef = useRef<ShaderMaterial | null>(null)
  const [photoTexture, setPhotoTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!canResolveSceneDuration) {
      if (photoReadyAt !== null) onRequiredSceneDuration(requiredSceneDuration, false)
      return
    }
    if (photoReadyAt === null && !photoLoadFailed) {
      onIdentityPreparationPending(true)
      return
    }
    onRequiredSceneDuration(photoLoadFailed ? TIMING.identity.duration : requiredSceneDuration, true)
    onIdentityPreparationPending(false)
  }, [canResolveSceneDuration, onIdentityPreparationPending, onRequiredSceneDuration, photoLoadFailed, photoReadyAt, requiredSceneDuration])

  const finalBasis = useMemo(() => {
    const basisAtTime = createLilyPortraitCameraBasisAtTime(cameraSettings)
    return basisAtTime(cameraSettings.identitySettings.cameraMoveDuration)
  }, [cameraSettings])
  const planeAttributes = useMemo(() => createLilyPortraitPhotoPlaneAttributes(
    finalBasis, aspect, APPROVED_PORTRAIT_SETTINGS,
  ), [aspect, finalBasis])
  const planeGeometry = useMemo(() => {
    const next = new BufferGeometry()
    next.setAttribute('position', new Float32BufferAttribute(planeAttributes.positions, 3))
    next.setAttribute('uv', new Float32BufferAttribute(planeAttributes.uvs, 2))
    return next
  }, [planeAttributes])
  useEffect(() => () => planeGeometry.dispose(), [planeGeometry])

  useEffect(() => {
    let active = true
    const texture = new TextureLoader().load(photoUrl, (loaded) => {
      if (active) {
        setPhotoTexture(loaded)
        setPhotoReadyAt(runtime.time)
        invalidate()
      } else loaded.dispose()
    }, undefined, (error) => {
      if (active) {
        console.error('Scene 04 original portrait photo failed to load.', error)
        setPhotoLoadFailed(true)
      }
    })
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    return () => { active = false; texture.dispose() }
  }, [invalidate, runtime])

  const revealMap = useMemo(() => {
    const edge = 256
    const texture = new DataTexture(createLilyPortraitPhotoRevealMap(edge, aspect), edge, edge, RedFormat, UnsignedByteType)
    texture.colorSpace = NoColorSpace
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  }, [aspect])
  useEffect(() => () => revealMap.dispose(), [revealMap])

  const material = useMemo(() => photoTexture ? new ShaderMaterial({
    uniforms: {
      uPhoto: { value: photoTexture },
      uRevealMap: { value: revealMap },
      uRevealProgress: { value: 0 },
    },
    vertexShader: PHOTO_VERTEX_SHADER,
    fragmentShader: PHOTO_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  }) : null, [photoTexture, revealMap])
  useEffect(() => () => material?.dispose(), [material])
  useEffect(() => () => updateLilyPortraitPhotoProgress(uniforms, 0), [uniforms])

  useEffect(() => {
    if (!material) return
    materialRef.current = material
    const update = (time: number) => {
      const currentMaterial = materialRef.current
      if (!currentMaterial) return
      let frameAnchor = revealAnchor
      if (time < lastObservedTime.current - 0.0001 && photoReadyAt !== null) {
        frameAnchor = getLilyPortraitPhotoRevealAnchorForReplay(lastArrival)
        setRevealAnchorSnapshot({ geometry, anchor: frameAnchor, readyAt: 0 })
      }
      lastObservedTime.current = time
      const progress = frameAnchor === null ? 0 : getLilyPortraitPhotoRevealProgress(time, frameAnchor)
      currentMaterial.uniforms.uRevealProgress!.value = progress
      updateLilyPortraitPhotoProgress(uniforms, progress)
      invalidate()
    }
    update(runtime.time)
    const unsubscribe = runtime.subscribeFrame(update)
    return () => {
      unsubscribe()
      if (materialRef.current === material) materialRef.current = null
    }
  }, [effectiveReadyAt, geometry, geometryReadyAt, invalidate, lastArrival, material, photoReadyAt, revealAnchor, runtime, uniforms])

  return material ? <mesh geometry={planeGeometry} material={material} frustumCulled={false} renderOrder={0} /> : null
}
