import galleryPlaylist from '../../data/galleryMusicPlaylist.json'

interface GalleryPlaylistEntry {
  title: string
  artist?: string
  assetPath: string
  gain?: number
}

export type MusicGroup = 'intro' | 'gallery' | 'outro'

export interface MusicTrackDefinition {
  id: string
  title: string
  artist: string
  assetPath: string
  url: string
  startOffset: number
  gain: number
  group: MusicGroup
}

function publicMusicUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const encodedAssetPath = assetPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')
  return `${base.endsWith('/') ? base : `${base}/`}${encodedAssetPath}`
}

function track(
  definition: Omit<MusicTrackDefinition, 'url'>,
): MusicTrackDefinition {
  return Object.freeze({ ...definition, url: publicMusicUrl(definition.assetPath) })
}

const intro = track({
  id: 'intro-in-the-pool',
  title: 'In the Pool',
  artist: 'Kensuke Ushio',
  assetPath: '/music/intro-in-the-pool.mp3',
  startOffset: 68,
  gain: 0.794,
  group: 'intro',
})

const galleryIds = new Map<string, number>()
const gallery = Object.freeze((galleryPlaylist as GalleryPlaylistEntry[]).map((definition) => {
  const fileName = definition.assetPath.split('/').at(-1) ?? 'track'
  const slug = fileName.replace(/\.mp3$/i, '').replace(/^gallery-/i, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track'
  const baseId = `gallery-${slug}`
  const occurrence = galleryIds.get(baseId) ?? 0
  galleryIds.set(baseId, occurrence + 1)
  return track({
    id: occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`,
    title: definition.title,
    artist: definition.artist ?? '',
    assetPath: definition.assetPath,
    startOffset: 0,
    gain: definition.gain ?? 1,
    group: 'gallery',
  })
}))

const outro = track({
  id: 'final-m83-outro',
  title: 'Outro',
  artist: 'M83',
  assetPath: '/music/final-m83-outro.mp3',
  startOffset: 0,
  gain: 0.407,
  group: 'outro',
})

export const MUSIC_CONFIG = Object.freeze({
  intro,
  gallery,
  outro,
  groupGains: Object.freeze({ intro: 1, gallery: 1, outro: 1 }),
  masterVolume: 1,
})
