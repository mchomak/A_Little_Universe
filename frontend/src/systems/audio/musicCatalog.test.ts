import { expect, it } from 'vitest'
import { MUSIC_CONFIG } from './musicCatalog'

it('publishes the approved local intro, gallery order, outro, and relative levels', () => {
  expect(MUSIC_CONFIG.intro).toMatchObject({
    id: 'intro-in-the-pool',
    title: 'In the Pool',
    artist: 'Kensuke Ushio',
    assetPath: '/music/intro-in-the-pool.mp3',
    startOffset: 68,
    gain: 0.794,
  })
  expect(MUSIC_CONFIG.gallery.map(({ title, artist, assetPath, gain }) => [title, artist, assetPath, gain])).toEqual([
    ['Glass', 'Hania Rani', '/music/gallery-glass.mp3', 1],
    ['Nuvole Bianche', 'Ludovico Einaudi', '/music/gallery-nuvole-bianche.mp3', 0.484],
    ['Tres Notas para Decir Te Quiero', 'Vicente Amigo', '/music/gallery-tres-notas.mp3', 0.393],
    ['Je te laisserai des mots', 'Patrick Watson', '/music/gallery-je-te-laisserai-des-mots.mp3', 0.519],
    ["La femme d'argent", 'Air', '/music/gallery-la-femme-dargent.mp3', 0.339],
  ])
  expect(MUSIC_CONFIG.outro).toMatchObject({
    id: 'final-m83-outro',
    title: 'Outro',
    artist: 'M83',
    assetPath: '/music/final-m83-outro.mp3',
    startOffset: 0,
    gain: 0.407,
  })
  expect(MUSIC_CONFIG).toMatchObject({
    groupGains: { intro: 1, gallery: 1, outro: 1 },
    masterVolume: 1,
    fades: { introToGallery: 8, galleryToGallery: 7, galleryLoop: 8, galleryToOutro: 10 },
  })
})
