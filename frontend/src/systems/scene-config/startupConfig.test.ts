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
