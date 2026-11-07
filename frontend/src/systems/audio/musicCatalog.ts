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
  return `${base.endsWith('/') ? base : `${base}/`}${assetPath.replace(/^\/+/, '')}`
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

const gallery = Object.freeze([
  track({ id: 'gallery-glass', title: 'Glass', artist: 'Hania Rani', assetPath: '/music/gallery-glass.mp3', startOffset: 0, gain: 1, group: 'gallery' }),
  track({ id: 'gallery-nuvole-bianche', title: 'Nuvole Bianche', artist: 'Ludovico Einaudi', assetPath: '/music/gallery-nuvole-bianche.mp3', startOffset: 0, gain: 0.484, group: 'gallery' }),
  track({ id: 'gallery-tres-notas', title: 'Tres Notas para Decir Te Quiero', artist: 'Vicente Amigo', assetPath: '/music/gallery-tres-notas.mp3', startOffset: 0, gain: 0.393, group: 'gallery' }),
  track({ id: 'gallery-je-te-laisserai-des-mots', title: 'Je te laisserai des mots', artist: 'Patrick Watson', assetPath: '/music/gallery-je-te-laisserai-des-mots.mp3', startOffset: 0, gain: 0.519, group: 'gallery' }),
  track({ id: 'gallery-la-femme-dargent', title: "La femme d'argent", artist: 'Air', assetPath: '/music/gallery-la-femme-dargent.mp3', startOffset: 0, gain: 0.339, group: 'gallery' }),
])

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
  fades: Object.freeze({ introToGallery: 8, galleryToGallery: 7, galleryLoop: 8, galleryToOutro: 10 }),
})
