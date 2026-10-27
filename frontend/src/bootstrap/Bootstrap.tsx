import { useCallback, useState } from 'react'
import { AssetManager } from '../systems/assets/AssetManager'
import { Preloader } from './Preloader'
import type { PreparationResult } from '../systems/assets/AssetManager'

let filmModule: typeof import('../app/App') | undefined
const manager = new AssetManager({
  development: import.meta.env.DEV,
  loadModules: async () => { filmModule = await import('../app/App') },
})

export function Bootstrap() {
  const [prepared, setPrepared] = useState<PreparationResult | null>(null)
  const onReady = useCallback((result: PreparationResult) => setPrepared(result), [])
  const App = filmModule?.App
  return prepared && App ? <App preparation={prepared} /> : <Preloader manager={manager} onReady={onReady} />
}
