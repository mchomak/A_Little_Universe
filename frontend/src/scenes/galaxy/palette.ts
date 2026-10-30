import type { GalaxyPalette, SceneComposerConfig } from '../../systems/scene-config/config'

type GalaxySettings = SceneComposerConfig['scenes']['galaxy']
export type GalaxyColorKey = 'coreColor' | 'innerColor' | 'armColor' | 'nebulaColor' | 'brightColor' | 'backgroundColor'
export type GalaxyColors = Pick<GalaxySettings, GalaxyColorKey>

export const GALAXY_PALETTES: Record<Exclude<GalaxyPalette, 'custom'>, GalaxyColors> = {
  vasilisa: { coreColor: '#FFE8C1', innerColor: '#879DFF', armColor: '#C261FF', nebulaColor: '#A253EC', brightColor: '#F6E7FF', backgroundColor: '#02030A' },
  spore: { coreColor: '#F4E7CE', innerColor: '#A6D9CF', armColor: '#86B7C2', nebulaColor: '#A1AFCB', brightColor: '#D8F4F3', backgroundColor: '#050B10' },
  ember: { coreColor: '#FFE2B0', innerColor: '#F2AB75', armColor: '#DB7188', nebulaColor: '#B94F73', brightColor: '#FFF1D6', backgroundColor: '#10070A' },
  emerald: { coreColor: '#E7F0C0', innerColor: '#93D4B6', armColor: '#5AAEAE', nebulaColor: '#598895', brightColor: '#DAF6E4', backgroundColor: '#04100D' },
  ice: { coreColor: '#F0F4FF', innerColor: '#A9D7FF', armColor: '#8AAEEB', nebulaColor: '#698FD1', brightColor: '#F0F6FF', backgroundColor: '#040916' },
  rose: { coreColor: '#FFE6D7', innerColor: '#E6A6C4', armColor: '#BC92DF', nebulaColor: '#D775A9', brightColor: '#FFF0F6', backgroundColor: '#10070F' },
}

export function getGalaxyColors(settings: GalaxySettings): GalaxyColors {
  if (settings.palette !== 'custom') return GALAXY_PALETTES[settings.palette]
  return {
    coreColor: settings.coreColor,
    innerColor: settings.innerColor,
    armColor: settings.armColor,
    nebulaColor: settings.nebulaColor,
    brightColor: settings.brightColor,
    backgroundColor: settings.backgroundColor,
  }
}

/** Keep persisted Inspector fields in sync with the colors currently rendered. */
export function selectGalaxyPalette(settings: GalaxySettings, palette: GalaxyPalette): GalaxySettings {
  const colors = palette === 'custom' ? getGalaxyColors(settings) : GALAXY_PALETTES[palette]
  return { ...settings, ...colors, palette }
}

/** Materialize the active preset before applying the first independent custom color. */
export function editGalaxyColor(settings: GalaxySettings, key: GalaxyColorKey, value: string): GalaxySettings {
  return { ...settings, ...getGalaxyColors(settings), palette: 'custom', [key]: value.toUpperCase() }
}
