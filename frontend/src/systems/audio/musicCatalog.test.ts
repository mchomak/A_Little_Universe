import { expect, it } from 'vitest'
import { MUSIC_CONFIG } from './musicCatalog'

it('publishes the configured local intro, gallery order, outro, and relative levels', () => {
  expect(MUSIC_CONFIG.intro).toMatchObject({
    id: 'intro-in-the-pool',
    title: 'In the Pool',
    artist: 'Kensuke Ushio',
    assetPath: '/music/intro-in-the-pool.mp3',
    startOffset: 68,
    gain: 0.794,
  })
  expect(MUSIC_CONFIG.gallery.map(({ title, artist, assetPath, gain }) => [title, artist, assetPath, gain])).toEqual([
    ['Wonderwall (Instrumental Version)', '', '/music/Wonderwall (Instrumental Version)_spotdown.org.mp3', 1],
    ['Kiss Me - Instrumental', '', '/music/Kiss Me - Instrumental_spotdown.org.mp3', 1],
    ['Spring is Coming', '', '/music/Spring is Coming_spotdown.org.mp3', 1],
    ['Je te laisserai des mots (Piano Version)', '', '/music/Je te laisserai des mots (Piano Version)_spotdown.org.mp3', 1],
    ['Summer', '', '/music/Summer_spotdown.org.mp3', 1],
    ['Nuvole Bianche', '', '/music/Nuvole Bianche_spotdown.org.mp3', 0.484],
    ['Idea 20 (Orchestral Version)', '', '/music/Idea 20 (Orchestral Version)_spotdown.org.mp3', 1],
    ['Tres Notas para Decir Te Quiero', '', '/music/Tres Notas para Decir Te Quiero_spotdown.org.mp3', 0.393],
    ['Ethereal', '', '/music/Ethereal_spotdown.org.mp3', 1],
    ['Silence', '', '/music/Silence_spotdown.org.mp3', 1],
    ['Evening Sky', '', '/music/Evening Sky_spotdown.org.mp3', 1],
    ['Blissful', '', '/music/Blissful_spotdown.org.mp3', 1],
    ['Starry Night', '', '/music/Starry Night_spotdown.org.mp3', 1],
    ['Easy Lovers', '', '/music/Easy Lovers_spotdown.org.mp3', 1],
    ['A Town with an Ocean View', '', '/music/A Town with an Ocean View_spotdown.org.mp3', 1],
    ["Can't Help Falling in Love", '', "/music/Can't Help Falling in Love_spotdown.org.mp3", 1],
    ['A Sky Full of Stars', '', '/music/A Sky Full of Stars_spotdown.org.mp3', 1],
    ['Idea 9', '', '/music/Idea 9_spotdown.org.mp3', 1],
    ['Dreamland', '', '/music/Dreamland_spotdown.org.mp3', 1],
    ['I Wanted to Leave', '', '/music/I Wanted to Leave_spotdown.org.mp3', 1],
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
  })
})
