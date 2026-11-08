import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMusicOfflineManifestEntries, MUSIC_ASSET_MAP, syncMusicAssets } from './sync-music-assets.mjs'

const sources = MUSIC_ASSET_MAP.map((asset) => asset.sourceFileName)
const runtimeFiles = MUSIC_ASSET_MAP.map((asset) => asset.runtimeFileName)
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
  it('maps the supplied M83 Outro source to the runtime URL used by MusicCatalog', () => {
    expect(MUSIC_ASSET_MAP.find((asset) => asset.role === 'Outro')).toEqual({
      role: 'Outro',
      sourceFileName: 'M83_-_Outro_76602076.mp3',
      runtimeFileName: 'final-m83-outro.mp3',
    })
  })

  it('copies the selected sources to playlist paths and prefers musics/', () => {
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
    writeFileSync(join(music, runtimeFiles[8]!), gallery)

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
        url: `/film/music/${encodeURIComponent(runtimeFiles[8]!)}`,
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
