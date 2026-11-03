import { expect, it, vi } from 'vitest'

it('loads a same-origin partial startup JSON override and keeps defaults for omitted fields', async () => {
  vi.resetModules()
  const fetchStartup = vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, global: { quality: 'low' },
    scenes: { prologue: { fontSize: 70, unrecognized: true } }, unexpected: 'ignored',
  })))
  vi.stubGlobal('fetch', fetchStartup)
  try {
    const { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, loadStartupConfig } = await import('./config')
    await loadStartupConfig()
    expect(fetchStartup).toHaveBeenCalledWith('/scene-composer.json', expect.objectContaining({ cache: 'no-cache' }))
    expect(getConfig().global.quality).toBe('low')
    expect(getConfig().scenes.prologue.fontSize).toBe(70)
    expect(getConfig().scenes.prologue.glow).toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.glow)
    expect(getConfig()).not.toHaveProperty('unexpected')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('leaves defaults active when the optional startup file is missing or malformed', async () => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{invalid', { status: 200 })))
  try {
    const { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, loadStartupConfig } = await import('./config')
    await expect(loadStartupConfig()).resolves.toBeUndefined()
    expect(getConfig()).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('persists Lily growth particle and pulse controls in DEV storage and restores them after reload', async () => {
  vi.resetModules()
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  vi.stubGlobal('window', { localStorage: storage })
  try {
    const { DEFAULT_SCENE_COMPOSER_CONFIG, updateConfig } = await import('./config')
    await updateConfig({ scenes: {
      growth: {
        vfxParticleCount: 496, vfxParticleSize: 4.2, vfxParticleGlow: 0.8, vfxParticleTint: '#D9C6FF',
        vfxPulseEnabled: false, vfxPulseBrightness: 1.8, vfxPulseWidth: 0.24, vfxPulseSpeed: 1.5,
        vfxPulseTrailFade: 1.9, vfxPulseColor: '#F8DCB5', vfxPulseLeafBoost: 0.75, vfxPulseBudBoost: 0.9,
      },
      prologue: { fontSize: 66 },
    } })

    const key = 'a-little-universe:dev:lily-growth-particles:v3'
    const saved = JSON.parse(values.get(key) ?? 'null')
    expect(saved).toMatchObject({
      vfxParticleCount: 496, vfxParticleSize: 4.2, vfxParticleGlow: 0.8, vfxParticleTint: '#D9C6FF',
      vfxPulseEnabled: false, vfxPulseBrightness: 1.8, vfxPulseWidth: 0.24, vfxPulseSpeed: 1.5,
      vfxPulseTrailFade: 1.9, vfxPulseColor: '#F8DCB5', vfxPulseLeafBoost: 0.75, vfxPulseBudBoost: 0.9,
    })
    expect(Object.keys(saved).sort()).toEqual([
      'vfxParticleBrightness', 'vfxParticleCount', 'vfxParticleGlow', 'vfxParticleLifetime',
      'vfxParticleSize', 'vfxParticleSizeVariation', 'vfxParticleSpeed', 'vfxParticleSpread', 'vfxParticleTint',
      'vfxPulseBrightness', 'vfxPulseBudBoost', 'vfxPulseColor', 'vfxPulseEnabled', 'vfxPulseLeafBoost',
      'vfxPulseSpeed', 'vfxPulseTrailFade', 'vfxPulseWidth',
    ])
    expect(saved).not.toHaveProperty('schemaVersion')
    expect(saved).not.toHaveProperty('vfxCoreIntensity')

    vi.resetModules()
    const reloaded = await import('./config')
    expect(reloaded.getConfig().scenes.growth).toMatchObject(saved)
    expect(reloaded.getConfig().scenes.prologue.fontSize).toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize)
  } finally {
    vi.unstubAllGlobals()
    vi.resetModules()
  }
})
