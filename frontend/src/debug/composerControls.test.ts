import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetConfig, getConfig } from '../systems/scene-config/config'
import { applyComposerPreset, exportComposerJson, importComposerJson, resetComposerField, resetComposerScope, setComposerField } from './composerControls'

const fontLoader = vi.hoisted(() => ({ load: vi.fn(async (): Promise<boolean> => true) }))

vi.mock('../systems/scene-config/fontCatalog', () => ({ loadArtFont: fontLoader.load }))

afterEach(async () => {
  fontLoader.load.mockResolvedValue(true)
  await resetConfig('all')
})

describe('Scene Composer controls', () => {
  it('maps a prologue font-size control to the shared config store', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('imports partial JSON over the active config', async () => {
    await setComposerField('global.quality', 'low')

    const result = await importComposerJson('{"schemaVersion":1,"scenes":{"prologue":{"fontSize":72}}}')

    expect(result.ok).toBe(true)
    expect(getConfig().global.quality).toBe('low')
    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('rejects import when the requested font is not ready and preserves the active config', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)
    const before = getConfig()
    fontLoader.load.mockResolvedValue(false)

    const result = await importComposerJson('{"schemaVersion":1,"scenes":{"prologue":{"fontFamily":"bad-script","fontSize":96}}}')

    expect(result).toEqual({ ok: false, reason: 'font' })
    expect(getConfig()).toBe(before)
  })

  it('reports a font readiness failure during scene reset without changing the active config', async () => {
    await setComposerField('scenes.preparation.fontFamily', 'caveat')
    await setComposerField('scenes.prologue.fontFamily', 'caveat')
    await setComposerField('scenes.preparation.spacing', 36)
    const before = getConfig()
    fontLoader.load.mockResolvedValue(false)

    const result = await resetComposerScope('preparation')

    expect(fontLoader.load).toHaveBeenLastCalledWith('marck-script')
    expect(result).toEqual({ ok: false, reason: 'font', config: before })
    expect(getConfig()).toBe(before)
  })

  it('preserves the active config when the import has an invalid section shape', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    const result = await importComposerJson('{"schemaVersion":1,"scenes":null}')

    expect(result.ok).toBe(false)
    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('exports the active config snapshot as JSON', async () => {
    await setComposerField('global.quality', 'low')

    const exported = JSON.parse(exportComposerJson()) as { global: { quality: string } }

    expect(exported.global.quality).toBe('low')
  })

  it('resets one control to its field default', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    await resetComposerField('scenes.prologue.fontSize')

    expect(getConfig().scenes.prologue.fontSize).toBe(48)
  })

  it('resets one scene group to its defaults', async () => {
    await setComposerField('scenes.preload.glow', 1.75)

    await resetComposerScope('preload')

    expect(getConfig().scenes.preload.glow).toBe(1)
  })

  it('applies a named preset through the shared config store', async () => {
    await applyComposerPreset('stardust')

    expect(getConfig().preset).toBe('stardust')
    expect(getConfig().scenes.prologue.particleCount).toBe(2600)
  })

  it('keeps the configured DPR range ordered while changing a bound', async () => {
    await setComposerField('global.dprMin', 0.75)
    await setComposerField('global.dprMax', 1)

    await setComposerField('global.dprMin', 1.25)

    expect(getConfig().global.dprMin).toBe(1.25)
    expect(getConfig().global.dprMax).toBe(1.25)
  })
})
