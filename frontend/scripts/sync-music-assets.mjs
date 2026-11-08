import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { argv, stderr } from 'node:process'
import { fileURLToPath, URL } from 'node:url'

const galleryPlaylist = JSON.parse(readFileSync(new URL('../src/data/galleryMusicPlaylist.json', import.meta.url), 'utf8'))

function galleryAssetFileName(assetPath) {
  const match = /^\/music\/([^/]+\.mp3)$/i.exec(assetPath)
  if (!match) throw new Error(`Gallery track path must point to a file under /music/: ${assetPath}`)
  try { return decodeURIComponent(match[1]) } catch { return match[1] }
}

const galleryAssets = [...new Map(galleryPlaylist.map((track, index) => {
  const fileName = galleryAssetFileName(track.assetPath)
  return [fileName, {
    role: `Gallery ${index + 1}`,
    sourceFileName: track.sourceFileName ?? fileName,
    runtimeFileName: fileName,
  }]
})).values()]

export const MUSIC_ASSET_MAP = Object.freeze([
  {
    role: 'Intro',
    sourceFileName: 'Perda \u2014 In the pool (Chainsaw Man - The Movie_ Reze Arc Soundtrack 09) (www.lightaudio.ru).mp3',
    runtimeFileName: 'intro-in-the-pool.mp3',
  },
  ...galleryAssets,
  {
    role: 'Outro',
    sourceFileName: 'M83_-_Outro_76602076.mp3',
    runtimeFileName: 'final-m83-outro.mp3',
  },
])

const OWNERSHIP_MANIFEST_VERSION = 1
const MUSIC_OUTPUTS = new Set([
  ...MUSIC_ASSET_MAP.map((asset) => asset.runtimeFileName),
  'gallery-glass.mp3',
  'gallery-nuvole-bianche.mp3',
  'gallery-tres-notas.mp3',
  'gallery-je-te-laisserai-des-mots.mp3',
  'gallery-la-femme-dargent.mp3',
])

export function normalizeMusicSourceName(name) {
  const basename = name.replaceAll('\\', '/').split('/').at(-1) ?? name
  return basename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.mp3$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findMusicSource(repositoryRoot, sourceFileName) {
  const expectedName = normalizeMusicSourceName(sourceFileName)
  for (const directoryName of ['musics', 'music']) {
    const directory = join(repositoryRoot, directoryName)
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }

    const matches = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')
        && normalizeMusicSourceName(entry.name) === expectedName)
      .sort((left, right) => left.name.localeCompare(right.name))
    if (matches.length > 0) {
      const exactMatch = matches.find((entry) => entry.name === sourceFileName)
      return join(directory, (exactMatch ?? matches[0]).name)
    }
  }
  return null
}

function readTargetFile(filePath) {
  try {
    return lstatSync(filePath)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function ensureOutputDirectory(outputDirectory) {
  let directory = readTargetFile(outputDirectory)
  if (!directory) {
    mkdirSync(outputDirectory, { recursive: true })
    directory = readTargetFile(outputDirectory)
  }
  if (!directory?.isDirectory() || directory.isSymbolicLink()) {
    throw new Error(`Generated music output must be a real directory: ${outputDirectory}`)
  }
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function readOwnedOutputs(manifestPath, outputDirectory, warn) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return new Map()
    warn(`[music-assets] Ignoring unreadable ownership record: ${manifestPath}`)
    return new Map()
  }

  if (manifest?.version !== OWNERSHIP_MANIFEST_VERSION
    || manifest.outputDirectory !== outputDirectory
    || !manifest.outputs || typeof manifest.outputs !== 'object' || Array.isArray(manifest.outputs)) {
    warn(`[music-assets] Ignoring mismatched ownership record: ${manifestPath}`)
    return new Map()
  }

  return new Map(Object.entries(manifest.outputs)
    .filter(([name, hash]) => MUSIC_OUTPUTS.has(name) && typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)))
}

function writeOwnedOutputs(manifestPath, outputDirectory, ownedOutputs, warn) {
  const temporaryPath = `${manifestPath}.${randomUUID()}.tmp`
  try {
    mkdirSync(dirname(manifestPath), { recursive: true })
    const outputs = Object.fromEntries([...ownedOutputs].sort(([left], [right]) => left.localeCompare(right)))
    writeFileSync(temporaryPath, `${JSON.stringify({ version: OWNERSHIP_MANIFEST_VERSION, outputDirectory, outputs }, null, 2)}\n`)
    renameSync(temporaryPath, manifestPath)
  } catch (error) {
    warn(`[music-assets] Could not update ownership record; unrecorded outputs will be preserved: ${manifestPath} (${error.message})`)
  }
}

function removeGeneratedCopy(outputPath, expectedHash, warn) {
  const target = readTargetFile(outputPath)
  if (!target) return false
  if (!target.isFile() || target.isSymbolicLink()) {
    warn(`[music-assets] Leaving non-file output in place: ${outputPath}`)
    return false
  }
  if (!expectedHash) return false
  if (hashFile(outputPath) !== expectedHash) {
    warn(`[music-assets] Leaving modified output in place: ${outputPath}`)
    return false
  }
  unlinkSync(outputPath)
  return true
}

export function syncMusicAssets({ repositoryRoot, outputDirectory, warn = (message) => stderr.write(`${message}\n`) } = {}) {
  const root = resolve(repositoryRoot ?? resolve(fileURLToPath(new URL('../..', import.meta.url))))
  const output = resolve(outputDirectory ?? join(root, 'frontend', 'public', 'music'))
  const ownershipPath = join(root, 'frontend', '.cache', 'music-assets-ownership.json')
  ensureOutputDirectory(output)

  const ownedOutputs = readOwnedOutputs(ownershipPath, output, warn)
  const nextOwnedOutputs = new Map()
  const copied = []
  const missing = []
  for (const asset of MUSIC_ASSET_MAP) {
    const sourcePath = findMusicSource(root, asset.sourceFileName)
    const outputPath = join(output, asset.runtimeFileName)
    if (!sourcePath) {
      missing.push(asset.runtimeFileName)
      warn(`[music-assets] Missing local MP3 for ${asset.role}: ${asset.sourceFileName}; the film will start without it.`)
      removeGeneratedCopy(outputPath, ownedOutputs.get(asset.runtimeFileName), warn)
      continue
    }

    const target = readTargetFile(outputPath)
    if (target && (!target.isFile() || target.isSymbolicLink())) {
      warn(`[music-assets] Leaving non-file output in place: ${outputPath}`)
      continue
    }
    copyFileSync(sourcePath, outputPath)
    nextOwnedOutputs.set(asset.runtimeFileName, hashFile(outputPath))
    copied.push(asset.runtimeFileName)
  }
  for (const [fileName, expectedHash] of ownedOutputs) {
    if (nextOwnedOutputs.has(fileName)) continue
    removeGeneratedCopy(join(output, fileName), expectedHash, warn)
  }
  writeOwnedOutputs(ownershipPath, output, nextOwnedOutputs, warn)
  return { copied, missing }
}

export function createMusicOfflineManifestEntries(publicMusicDirectory, base = '/') {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const entries = []
  for (const asset of MUSIC_ASSET_MAP) {
    const filePath = join(publicMusicDirectory, asset.runtimeFileName)
    const stat = readTargetFile(filePath)
    if (!stat?.isFile() || stat.isSymbolicLink()) continue
    const source = readFileSync(filePath)
    entries.push({
      url: `${normalizedBase}music/${asset.runtimeFileName.split('/').map(encodeURIComponent).join('/')}`,
      kind: 'audio',
      required: false,
      bytes: source.length,
      sha256: createHash('sha256').update(source).digest('hex'),
      contentType: 'audio/mpeg',
      cacheOnInstall: true,
    })
  }
  return entries
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const result = syncMusicAssets()
  if (result.missing.length > 0) {
    stderr.write(`[music-assets] ${result.missing.length} optional track(s) are unavailable.\n`)
  }
}
