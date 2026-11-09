import { AdditiveBlending, Camera, MeshBasicMaterial, Object3D, PointsMaterial, Quaternion } from 'three'

export const GALAXY_RENDER_ORDER = {
  backgroundStars: -3,
  gas: -2,
  starPoints: 0,
  blackCenter: 1,
  revealFog: 2,
} as const

/** A simple screenshot-style occluding disc, rendered over the luminous center. */
export function createBlackCenterMaterial() {
  return new MeshBasicMaterial({
    color: '#000000',
    toneMapped: false,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  })
}

/** Keep the central silhouette round at every CameraDirector pose. */
const cameraWorldQuaternion = new Quaternion()
const inverseParentWorldQuaternion = new Quaternion()

export function faceBlackCenterToCamera(center: Object3D, camera: Camera) {
  camera.getWorldQuaternion(cameraWorldQuaternion)
  center.quaternion.copy(cameraWorldQuaternion)
  if (center.parent) {
    center.parent.getWorldQuaternion(inverseParentWorldQuaternion).invert()
    center.quaternion.premultiply(inverseParentWorldQuaternion)
  }
}

/** The configured background brightness is the only attenuation applied to these stars. */
export function createBackgroundStarsMaterial() {
  return new PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  })
}
