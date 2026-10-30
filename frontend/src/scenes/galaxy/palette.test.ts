import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { editGalaxyColor, getGalaxyColors, getGalaxyRenderPalette, selectGalaxyPalette } from './palette'

const defaults = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy

it('keeps the original Spore palette colors and gas gradient', () => {
  const spore = selectGalaxyPalette(defaults, 'spore')

  expect(spore).toMatchObject({
    coreColor: '#FFE6AD', innerColor: '#D9C6FF', armColor: '#4F5CFF',
    nebulaColor: '#9A52FF', brightColor: '#7FB4FF', backgroundColor: '#04020C',
  })
  expect(getGalaxyRenderPalette(spore)).toMatchObject({
    nebulaCoreColor: '#FFCF8A', nebulaColor: '#9A52FF', nebulaEdgeColor: '#3A1A7A',
  })
})

it('materializes the selected palette into the Inspector color fields', () => {
  const ice = selectGalaxyPalette(defaults, 'ice')

  expect(ice.palette).toBe('ice')
  expect(ice.coreColor).toBe('#FFFFFF')
  expect(ice.backgroundColor).toBe('#030810')
  expect(getGalaxyColors(ice)).toMatchObject({ coreColor: '#FFFFFF', backgroundColor: '#030810' })
})

it('preserves all active palette colors when one color is edited into Custom', () => {
  const ember = selectGalaxyPalette(defaults, 'ember')
  const custom = editGalaxyColor(ember, 'armColor', '#AABBCC')

  expect(custom.palette).toBe('custom')
  expect(getGalaxyColors(custom)).toEqual({
    coreColor: '#FFF1CF',
    innerColor: '#FFD089',
    armColor: '#AABBCC',
    nebulaColor: '#E0632A',
    brightColor: '#FFD0A0',
    backgroundColor: '#0B0503',
  })
})

it('keeps the selected colors when switching directly to Custom', () => {
  const ice = selectGalaxyPalette(defaults, 'ice')
  const custom = selectGalaxyPalette(ice, 'custom')
  expect(getGalaxyColors(custom)).toEqual(getGalaxyColors(ice))
})
