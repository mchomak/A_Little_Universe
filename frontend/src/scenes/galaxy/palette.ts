import { Color, SRGBColorSpace } from 'three'
import type { GalaxyPalette, SceneComposerConfig } from '../../systems/scene-config/config'

type GalaxySettings = SceneComposerConfig['scenes']['galaxy']
export type GalaxyColorKey = 'coreColor' | 'innerColor' | 'armColor' | 'nebulaColor' | 'brightColor' | 'backgroundColor'
export type GalaxyColors = Pick<GalaxySettings, GalaxyColorKey>
export type GalaxyPaletteSettings = Pick<GalaxySettings, 'palette' | GalaxyColorKey>

export interface GalaxyRenderPalette extends GalaxyColors {
  outerColor: string
  hotColor: string
  nebulaCoreColor: string
  nebulaEdgeColor: string
}

export const GALAXY_PALETTES: Record<Exclude<GalaxyPalette, 'custom'>, GalaxyColors> = {
  vasilisa: { coreColor: '#FFE8C1', innerColor: '#BBA7FF', armColor: '#9A52FF', nebulaColor: '#7F43D6', brightColor: '#F6E7FF', backgroundColor: '#02030A' },
  spore: { coreColor: '#FFE6AD', innerColor: '#D9C6FF', armColor: '#4F5CFF', nebulaColor: '#9A52FF', brightColor: '#7FB4FF', backgroundColor: '#04020C' },
  ember: { coreColor: '#FFF1CF', innerColor: '#FFD089', armColor: '#FF5A3C', nebulaColor: '#E0632A', brightColor: '#FFD0A0', backgroundColor: '#0B0503' },
  emerald: { coreColor: '#EAFFF4', innerColor: '#9AF7D0', armColor: '#1FAE8C', nebulaColor: '#1F9E86', brightColor: '#BFFFE6', backgroundColor: '#02080A' },
  ice: { coreColor: '#FFFFFF', innerColor: '#BFE6FF', armColor: '#3F7BFF', nebulaColor: '#3F7BD6', brightColor: '#DFF0FF', backgroundColor: '#030810' },
  rose: { coreColor: '#FFF0FB', innerColor: '#FFB3E6', armColor: '#B03CFF', nebulaColor: '#C03CD0', brightColor: '#FFD0F0', backgroundColor: '#0A030A' },
}

const NEBULA_GRADIENTS: Record<Exclude<GalaxyPalette, 'custom' | 'vasilisa'>, { core: string; mid: string; edge: string }> = {
  spore: { core: '#FFCF8A', mid: '#9A52FF', edge: '#3A1A7A' },
  ember: { core: '#FFE7B0', mid: '#E0632A', edge: '#5A1C0E' },
  emerald: { core: '#D6FFF0', mid: '#1F9E86', edge: '#0A3B32' },
  ice: { core: '#E6F4FF', mid: '#3F7BD6', edge: '#13284F' },
  rose: { core: '#FFD6F2', mid: '#C03CD0', edge: '#451460' },
}

export function getGalaxyColors(settings: GalaxyPaletteSettings): GalaxyColors {
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

export function getGalaxyRenderPalette(settings: GalaxyPaletteSettings): GalaxyRenderPalette {
  const colors = getGalaxyColors(settings)
  if (settings.palette === 'custom') {
    const edge = new Color(colors.nebulaColor).multiplyScalar(0.28).getHexString(SRGBColorSpace)
    return {
      ...colors,
      outerColor: colors.armColor,
      hotColor: colors.brightColor,
      nebulaCoreColor: colors.coreColor,
      nebulaEdgeColor: `#${edge}`,
    }
  }
  const gradient = settings.palette === 'vasilisa'
    ? { core: colors.coreColor, mid: colors.nebulaColor, edge: '#271543' }
    : NEBULA_GRADIENTS[settings.palette]
  return {
    ...colors,
    outerColor: colors.armColor,
    hotColor: colors.brightColor,
    nebulaCoreColor: gradient.core,
    nebulaColor: gradient.mid,
    nebulaEdgeColor: gradient.edge,
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
