import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { editGalaxyColor, getGalaxyColors, selectGalaxyPalette } from './palette'

const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy

it('uses a pearly Vasilisa core with luminous violet arms and star accents', () => {
  const vasilisa = selectGalaxyPalette(defaults, 'vasilisa')

  expect(vasilisa).toMatchObject({
    coreColor: '#FFE8C1', innerColor: '#879DFF', armColor: '#C261FF',
    nebulaColor: '#A253EC', brightColor: '#F6E7FF',
  })
})

it('materializes the selected palette into the Inspector color fields', () => {
  const ice = selectGalaxyPalette(defaults, 'ice')

  expect(ice.palette).toBe('ice')
  expect(ice.coreColor).toBe('#F0F4FF')
  expect(ice.backgroundColor).toBe('#040916')
  expect(getGalaxyColors(ice)).toMatchObject({ coreColor: '#F0F4FF', backgroundColor: '#040916' })
})

it('preserves all active palette colors when one color is edited into Custom', () => {
  const ember = selectGalaxyPalette(defaults, 'ember')
  const custom = editGalaxyColor(ember, 'armColor', '#AABBCC')

  expect(custom.palette).toBe('custom')
  expect(getGalaxyColors(custom)).toEqual({
    coreColor: '#FFE2B0',
    innerColor: '#F2AB75',
    armColor: '#AABBCC',
    nebulaColor: '#B94F73',
    brightColor: '#FFF1D6',
    backgroundColor: '#10070A',
  })
})

it('keeps the selected colors when switching directly to Custom', () => {
  const ice = selectGalaxyPalette(defaults, 'ice')
  const custom = selectGalaxyPalette(ice, 'custom')
  expect(getGalaxyColors(custom)).toEqual(getGalaxyColors(ice))
})
