import { useGLTF } from '@react-three/drei'
import lilyModelUrl from './lily_004_final.glb?url'

export const LILY_MODEL_URL = lilyModelUrl
export const LILY_MODEL_RUNTIME_ASSET = { url: LILY_MODEL_URL, kind: 'model', required: true } as const

export function preloadLilyModel() {
  useGLTF.preload(LILY_MODEL_URL)
}
