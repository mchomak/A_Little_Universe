import type { Scene } from 'three'

export function clearOpeningSceneBackground(scene: Scene, openingScene: boolean): void {
  if (openingScene) scene.background = null
}
