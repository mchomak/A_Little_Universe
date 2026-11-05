export const GROWTH_CLOUD_LAYER_IDS = ['far', 'sides', 'foreground'] as const
export type GrowthCloudLayerId = (typeof GROWTH_CLOUD_LAYER_IDS)[number]

export interface GrowthCloudLayerSettings {
  count: number
  density: number
  scale: number
  opacity: number
  brightness: number
  height: number
  distance: number
  depth: number
}

export type GrowthCloudLayers = Readonly<Record<GrowthCloudLayerId, Readonly<GrowthCloudLayerSettings>>>

export const GROWTH_CLOUD_LAYER_MAX_COUNTS: Readonly<Record<GrowthCloudLayerId, number>> = {
  far: 2,
  sides: 2,
  foreground: 2,
}

export const DEFAULT_GROWTH_CLOUD_LAYERS: GrowthCloudLayers = {
  // Distant clouds sit behind and around the island; their shader uses fewer ray steps.
  far: { count: 2, density: 1, scale: 1, opacity: 1, brightness: 1, height: 0.25, distance: 0.4, depth: -2.4 },
  sides: { count: 2, density: 1, scale: 1, opacity: 1, brightness: 1, height: 0.7, distance: 0.65, depth: 0 },
  foreground: { count: 2, density: 0.9, scale: 0.95, opacity: 0.8, brightness: 0.9, height: -0.1, distance: 0.2, depth: 1.8 },
}

/** Missing groups in older DEV files get current defaults; invalid values remain bounded. */
export function normalizeGrowthCloudLayers(input: unknown): GrowthCloudLayers {
  const source = asRecord(input)
  return Object.fromEntries(GROWTH_CLOUD_LAYER_IDS.map((id) => {
    const layer = asRecord(source?.[id])
    const defaults = DEFAULT_GROWTH_CLOUD_LAYERS[id]
    return [id, {
      count: numberValue(layer?.count, defaults.count, 0, GROWTH_CLOUD_LAYER_MAX_COUNTS[id], true),
      density: numberValue(layer?.density, defaults.density, 0, 1.8),
      scale: numberValue(layer?.scale, defaults.scale, 0.55, 2),
      opacity: numberValue(layer?.opacity, defaults.opacity, 0, 1.8),
      brightness: numberValue(layer?.brightness, defaults.brightness, 0, 2),
      height: numberValue(layer?.height, defaults.height, -3, 3),
      distance: numberValue(layer?.distance, defaults.distance, 0, 8),
      depth: numberValue(layer?.depth, defaults.depth, -8, 8),
    }]
  })) as unknown as GrowthCloudLayers
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function numberValue(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const bounded = Math.max(min, Math.min(max, parsed))
  return integer ? Math.floor(bounded) : bounded
}
