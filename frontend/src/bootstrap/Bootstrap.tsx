import { useCallback, useState } from 'react'
import { AssetManager } from '../systems/assets/AssetManager'
import { Preloader } from './Preloader'
import type { PreparationResult } from '../systems/assets/AssetManager'
import { getConfig } from '../systems/scene-config/config'
import { LILY_MODEL_RUNTIME_ASSET } from '../assets/lily/lilyAsset'

let filmModule: typeof import('../app/App') | undefined
const manager = new AssetManager({
  bundled: location.protocol === 'app:' && location.hostname === 'bundle',
  development: import.meta.env.DEV,
  ...(import.meta.env.DEV ? { manifest: { version: 'development-lily', assets: [LILY_MODEL_RUNTIME_ASSET] } } : {}),
  loadModules: async () => { filmModule = await import('../app/App') },
  preparePortrait: async () => {
    const preparation = await import('../scenes/lily/lilyParticlePreparation')
    const getInput = () => ({
      config: getConfig(),
      ...preparation.getLilyFilmSurfaceDimensions(),
      reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    })
    const record = await preparation.prepareLilyParticleGeometryForStart(
      preparation.lilyParticlePreparation,
      getInput,
      () => true,
    )
    if (record.status !== 'ready' || !record.geometry
      || record.seedKey !== preparation.createLilyParticlePreparationSeedKey(getInput())) {
      throw new Error('Portrait geometry is not ready for the current settings and size.')
    }
    return record
  },
})

export function Bootstrap() {
  const [prepared, setPrepared] = useState<PreparationResult | null>(null)
  const onReady = useCallback((result: PreparationResult) => setPrepared(result), [])
  const App = filmModule?.App
  return prepared && App ? <App preparation={prepared} /> : <Preloader manager={manager} onReady={onReady} />
}
