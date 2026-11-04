export interface GalleryCollageConfig {
  readonly particleEnabled: boolean
}

export type GalleryCollageConfigOverrides = Readonly<Record<string, Partial<GalleryCollageConfig>>>

/** Event-specific opt-outs are keyed by stable gallery event id. */
export const galleryCollageConfig: GalleryCollageConfigOverrides = Object.freeze({})

const PARTICLES_ENABLED: Readonly<GalleryCollageConfig> = Object.freeze({ particleEnabled: true })
const PARTICLES_DISABLED: Readonly<GalleryCollageConfig> = Object.freeze({ particleEnabled: false })

/** Empty entries preserve the particle effect by default for every event. */
export function getGalleryCollageConfig(
  eventId: string,
  overrides: GalleryCollageConfigOverrides = galleryCollageConfig,
): Readonly<GalleryCollageConfig> {
  if (!Object.prototype.hasOwnProperty.call(overrides, eventId)) return PARTICLES_ENABLED
  return overrides[eventId]?.particleEnabled === false ? PARTICLES_DISABLED : PARTICLES_ENABLED
}
