export interface MusicAsset {
  readonly role: string
  readonly sourceFileName: string
  readonly runtimeFileName: string
}

export interface MusicAssetSyncResult {
  copied: string[]
  missing: string[]
}

export interface SyncMusicAssetsOptions {
  repositoryRoot?: string
  outputDirectory?: string
  warn?: (message: string) => void
}

export interface MusicOfflineManifestEntry {
  url: string
  kind: 'audio'
  required: false
  bytes: number
  sha256: string
  contentType: 'audio/mpeg'
  cacheOnInstall: true
}

export const MUSIC_ASSET_MAP: readonly MusicAsset[]
export function normalizeMusicSourceName(name: string): string
export function syncMusicAssets(options?: SyncMusicAssetsOptions): MusicAssetSyncResult

export function createMusicOfflineManifestEntries(
  publicMusicDirectory: string,
  base: string,
): MusicOfflineManifestEntry[]
