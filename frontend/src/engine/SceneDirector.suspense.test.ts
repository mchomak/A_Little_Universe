import { createElement, Suspense, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { Color, Scene } from 'three'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === null ? { sample: () => [0, 0, 0] } : initial) }
})
vi.mock('@react-three/drei', () => ({
  Html: ({ children, pointerEvents }: { children?: ReactNode; pointerEvents?: string }) =>
    createElement('div', { 'data-pointer-events': pointerEvents }, children),
}))
vi.mock('@react-three/fiber', async () => {
  const { Scene } = await import('three')
  return {
    useThree: (selector: (state: { scene: InstanceType<typeof Scene> }) => unknown) => selector({ scene: new Scene() }),
  }
})
vi.mock('../scenes/PrologueScene', () => ({ PrologueScene: () => null }))
vi.mock('../scenes/GrowthScene', () => ({ GrowthScene: () => createElement('span', null, 'growth-world') }))
vi.mock('../scenes/BloomScene', () => ({ BloomScene: () => null }))
vi.mock('../scenes/lily/LilyDissolveParticles', () => ({ LilyDissolveParticles: () => createElement('span', null, 'surface-particles') }))
vi.mock('../scenes/GalleryScene', () => ({ GalleryScene: () => null }))
vi.mock('../scenes/EyeScene', () => ({ EyeScene: () => null }))
vi.mock('../scenes/CosmosScene', () => ({ CosmosScene: () => null }))
vi.mock('../scenes/GreetingScene', () => ({ GreetingScene: () => null }))
vi.mock('../scenes/EndingScene', () => ({ EndingScene: () => null }))
vi.mock('../scenes/lily/AnimatedLily', () => ({ AnimatedLily: () => createElement('span', null, 'persistent-lily') }))
vi.mock('../scenes/galaxy/GalaxyExperience', () => ({ GalaxyExperience: () => null }))

import { SceneDirector } from './SceneDirector'
import { clearOpeningSceneBackground } from './openingSceneBackground'
import { initialFilmState } from './film'
import { createFilmRuntime } from './runtime'
import { ParticlePreparationStatus } from '../scenes/lily/ParticlePreparationStatus'

it('clears a stale opaque canvas background when entering an opening scene', () => {
  const scene = new Scene()
  scene.background = new Color('#080914')

  clearOpeningSceneBackground(scene, true)

  expect(scene.background).toBeNull()
})

it('keeps the lily and its environment with the surface particle layer in scene 04', () => {
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const }
  const html = renderToString(createElement(Suspense, { fallback: createElement('span', null, 'canvas-fallback') },
    createElement(SceneDirector, { state, dispatch: () => {}, runtime: createFilmRuntime(), reducedMotion: false })))
  expect(html).toContain('persistent-lily')
  expect(html).toContain('growth-world')
  expect(html).toContain('surface-particles')
  expect(html).not.toContain('canvas-fallback')
})

it('renders an accessible preparation status while leaving pointer input unobstructed', () => {
  const html = renderToString(createElement(ParticlePreparationStatus, { message: 'Подготавливаем поверхность лилии…' }))
  expect(html).toContain('role="status"')
  expect(html).toContain('aria-live="polite"')
  expect(html).toContain('data-pointer-events="none"')
  expect(html).toContain('Подготавливаем поверхность лилии')
})
