import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMusicOfflineManifestEntries, syncMusicAssets } from './sync-music-assets.mjs'

const sources = [
  'Perda — In the pool (Chainsaw Man - The Movie_ Reze Arc Soundtrack 09) (www.lightaudio.ru).mp3',
  'Glass_spotdown.org.mp3',
  'SpotiDownloader.com - Nuvole Bianche - Ludovico Einaudi.mp3',
  'SpotiDownloader.com - Tres Notas para Decir Te Quiero - Vicente Amigo.mp3',
  'SpotiDownloader.com - Je te laisserai des mots - Patrick Watson.mp3',
  "SpotiDownloader.com - La femme d'argent - Air.mp3",
  'M83_-_Outro_76602076.mp3',
]

const runtimeFiles = [
  'intro-in-the-pool.mp3',
  'gallery-glass.mp3',
  'gallery-nuvole-bianche.mp3',
  'gallery-tres-notas.mp3',
  'gallery-je-te-laisserai-des-mots.mp3',
  'gallery-la-femme-dargent.mp3',
  'final-m83-outro.mp3',
]

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'little-universe-music-assets-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('syncMusicAssets', () => {
  it('copies only the seven approved sources to canonical names and prefers musics/', () => {
    const root = makeRoot()
    const music = join(root, 'music')
    const musics = join(root, 'musics')
    const output = join(root, 'frontend', 'public', 'music')
    mkdirSync(music)
    mkdirSync(musics)

    sources.forEach((source, index) => writeFileSync(join(music, source), `legacy-${index}`))
    writeFileSync(join(musics, sources[0]!), 'preferred-intro')
    writeFileSync(join(music, 'SpotiDown.App - Outro - M83.mp3'), 'unapproved-outro')
    writeFileSync(join(music, 'Near Light_spotdown.org.mp3'), 'unapproved-gallery')
    const warnings: string[] = []

    syncMusicAssets({ repositoryRoot: root, warn: (message) => warnings.push(message) })

    expect(readdirSync(output).sort()).toEqual([...runtimeFiles].sort())
    expect(readFileSync(join(output, runtimeFiles[0]!), 'utf8')).toBe('preferred-intro')
    expect(warnings).toEqual([])
  })

  it('warns for a missing source and removes only that track’s generated copy', () => {
    const root = makeRoot()
    const music = join(root, 'music')
    const output = join(root, 'frontend', 'public', 'music')
    mkdirSync(music)
    mkdirSync(output, { recursive: true })
    sources.forEach((source, index) => writeFileSync(join(music, source), `track-${index}`))
    syncMusicAssets({ repositoryRoot: root, warn: () => undefined })
    unlinkSync(join(music, sources.at(-1)!))
    writeFileSync(join(output, 'keep.note'), 'unrelated generated-folder content')
    const warnings: string[] = []

    const result = syncMusicAssets({ repositoryRoot: root, warn: (message) => warnings.push(message) })

    expect(result.missing).toEqual([runtimeFiles.at(-1)])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(sources.at(-1))
    expect(readdirSync(output).sort()).toEqual([...runtimeFiles.slice(0, -1), 'keep.note'].sort())
  })

  it('preserves an unowned regular file at a canonical path when its source is missing', () => {
    const root = makeRoot()
    const output = join(root, 'frontend', 'public', 'music')
    mkdirSync(output, { recursive: true })
    const canonicalPath = join(output, runtimeFiles[1]!)
    writeFileSync(canonicalPath, 'user-owned content')

    syncMusicAssets({ repositoryRoot: root, warn: () => undefined })

    expect(readFileSync(canonicalPath, 'utf8')).toBe('user-owned content')
  })

  it('does not treat a same-named non-MP3 file as a music source', () => {
    const root = makeRoot()
    const music = join(root, 'music')
    mkdirSync(music)
    const notMp3 = sources[1]!.replace(/\.mp3$/i, '')
    writeFileSync(join(music, notMp3), 'not an MP3')
    const warnings: string[] = []

    const result = syncMusicAssets({ repositoryRoot: root, warn: (message) => warnings.push(message) })

    expect(result.copied).not.toContain(runtimeFiles[1])
    expect(result.missing).toContain(runtimeFiles[1])
    expect(warnings.some((message) => message.includes('Gallery 1'))).toBe(true)
    expect(readdirSync(join(root, 'frontend', 'public', 'music'))).not.toContain(runtimeFiles[1])
  })
})

describe('createMusicOfflineManifestEntries', () => {
  it('marks only present canonical MP3s as optional install-cache assets with hashes', () => {
    const root = makeRoot()
    const music = join(root, 'public', 'music')
    mkdirSync(music, { recursive: true })
    const intro = Buffer.from('temporary intro audio fixture')
    const gallery = Buffer.from('temporary gallery audio fixture')
    writeFileSync(join(music, 'intro-in-the-pool.mp3'), intro)
    writeFileSync(join(music, 'gallery-tres-notas.mp3'), gallery)

    const entries = createMusicOfflineManifestEntries(music, '/film/')

    expect(entries).toEqual([
      {
        url: '/film/music/intro-in-the-pool.mp3',
        kind: 'audio',
        required: false,
        bytes: intro.length,
        sha256: createHash('sha256').update(intro).digest('hex'),
        contentType: 'audio/mpeg',
        cacheOnInstall: true,
      },
      {
        url: '/film/music/gallery-tres-notas.mp3',
        kind: 'audio',
        required: false,
        bytes: gallery.length,
        sha256: createHash('sha256').update(gallery).digest('hex'),
        contentType: 'audio/mpeg',
        cacheOnInstall: true,
      },
    ])
  })
})
