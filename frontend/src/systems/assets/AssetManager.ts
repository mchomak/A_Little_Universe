import { loadStartupConfig } from '../scene-config/config'

export type AssetKind = 'image' | 'audio' | 'model' | 'file'
export interface RuntimeAsset {
  url: string
  kind: AssetKind
  required: boolean
  bytes?: number
  sha256?: string
  contentType?: string
}
export interface RuntimeManifest { version: string; assets: RuntimeAsset[]; optionalAssets?: RuntimeAsset[] }
export interface PreparationProgress {
  phase: 'modules' | 'assets' | 'cache' | 'portrait' | 'ready' | 'error'
  completed: number
  total: number
  message: string
}
export interface PreparationResult {
  ready: boolean
  offline: 'verified' | 'unavailable' | 'development'
  recovery?: 'reload' | 'retry'
  warnings: string[]
  errors: string[]
}
export interface AssetManagerOptions {
  development?: boolean
  bundled?: boolean
  manifest?: RuntimeManifest
  fetch?: typeof fetch
  loadModules: () => Promise<unknown>
  verifyOffline?: (manifest: RuntimeManifest) => Promise<void>
  preparePortrait?: () => Promise<unknown>
}
export class AssetManager {
  private completed = new Set<string>()
  private pending: Promise<PreparationResult> | undefined
  private manifest?: RuntimeManifest
  private listeners = new Set<(progress: PreparationProgress) => void>()
  readonly options: AssetManagerOptions
  constructor(options: AssetManagerOptions) { this.options = options }
  prepare(onProgress?: (progress: PreparationProgress) => void): Promise<PreparationResult> {
    if (onProgress) this.listeners.add(onProgress)
    if (this.pending) return this.pending
    this.pending = this.run((value) => { for (const listener of this.listeners) listener(value) })
      .finally(() => { this.pending = undefined; this.listeners.clear() })
    return this.pending
  }
  private async run(report: (progress: PreparationProgress) => void = () => undefined): Promise<PreparationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const request = this.options.fetch ?? fetch
    let portraitCompleted = false
    const emit = (phase: PreparationProgress['phase'], message: string) => report({
      phase,
      completed: Number(this.completed.has('modules'))
        + (this.manifest?.assets.filter((asset) => asset.required && this.completed.has(asset.url)).length ?? 0)
        + Number(portraitCompleted),
      total: 1 + (this.manifest?.assets.filter((asset) => asset.required).length ?? 0)
        + Number(Boolean(this.options.preparePortrait)),
      message,
    })
    emit('modules', 'Создаём кое-что особенное…')
    try {
      if (!this.completed.has('modules')) {
        await this.options.loadModules()
        this.completed.add('modules')
      }
      this.manifest ??= this.options.manifest ?? (this.options.development ? { version: 'development', assets: [] }
        : await readManifest(await request(`${import.meta.env.BASE_URL}runtime-manifest.json`, { cache: 'no-cache', signal: AbortSignal.timeout(25000) })))
    } catch (error) {
      const recovery = this.completed.has('modules') ? 'retry' : 'reload'
      errors.push(`Не удалось подготовить фильм: ${errorMessage(error)}. ${recovery === 'reload' ? 'Перезагрузи страницу после восстановления сети.' : 'Повтори проверку.'}`)
      emit('error', 'Кажется, что-то задержалось…')
      return { ready: false, offline: 'unavailable', recovery, errors, warnings }
    }
    emit('assets', 'Собираем твою маленькую вселенную…')
    for (const asset of this.manifest.assets) {
      if (this.completed.has(asset.url)) continue
      try {
        // Old service workers can serve their cached entry document at this mutable URL.
        // The build query bypasses that stale URL match before checking the current manifest.
        const isEntryDocument = asset.url === `${import.meta.env.BASE_URL}index.html`
        const requestUrl = isEntryDocument ? `${asset.url}?build=${encodeURIComponent(this.manifest.version)}` : asset.url
        const response = await request(requestUrl, {
          ...(isEntryDocument ? { cache: 'reload' as const } : {}),
          signal: AbortSignal.timeout(25000),
        })
        const bytes = await validateResponse(response, asset)
        await decodeAsset(bytes, asset)
        this.completed.add(asset.url)
      } catch (error) {
        ;(asset.required ? errors : warnings).push(`${asset.url}: ${errorMessage(error)}`)
      }
      emit('assets', 'Собираем твою маленькую вселенную…')
    }
    if (errors.length) {
      emit('error', 'Кажется, что-то задержалось…')
      return { ready: false, offline: 'unavailable', errors, warnings }
    }
    let offline: PreparationResult['offline'] = 'development'
    if (this.options.bundled) offline = 'verified'
    else if (this.options.development) warnings.push('Режим разработки: автономный запуск проверяется в production-сборке.')
    else {
      emit('cache', 'Почти готово…')
      try {
        await (this.options.verifyOffline ?? prepareOffline)(this.manifest)
        offline = 'verified'
      } catch (error) {
        offline = 'unavailable'
        warnings.push(`Фильм загружен. Запуск после перезагрузки без сети не подтверждён: ${errorMessage(error)}`)
      }
    }
    if (this.options.preparePortrait) {
      try {
        await loadStartupConfig()
        emit('portrait', 'Подготавливаем частицы портрета…')
        await this.options.preparePortrait()
        portraitCompleted = true
      } catch (error) {
        errors.push(`portrait: ${errorMessage(error)}`)
        emit('error', 'Не удалось подготовить портрет. Можно попробовать ещё раз.')
        return { ready: false, offline: 'unavailable', recovery: 'retry', errors, warnings }
      }
    } else if (!this.options.development) {
      void loadStartupConfig()
    }
    emit('ready', 'Твоя маленькая вселенная готова.')
    return { ready: true, offline, errors, warnings }
  }
  retry(onProgress?: (progress: PreparationProgress) => void) { return this.prepare(onProgress) }
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

async function readManifest(response: Response): Promise<RuntimeManifest> {
  if (!response.ok) throw new Error(`HTTP ${response.status} (manifest)`)
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || !('version' in value) || typeof value.version !== 'string'
    || !('assets' in value) || !Array.isArray(value.assets) || !value.assets.length) throw new Error('Некорректный manifest')
  const manifest = value as RuntimeManifest
  validateAssets(manifest.assets)
  if (manifest.optionalAssets !== undefined) {
    if (!Array.isArray(manifest.optionalAssets) || manifest.optionalAssets.some((asset) => !asset || asset.required !== false)) {
      throw new Error('Некорректные optional assets manifest')
    }
    validateAssets(manifest.optionalAssets)
  }
  return value as RuntimeManifest
}

function validateAssets(assets: RuntimeAsset[]) {
  for (const asset of assets) {
    if (!asset || typeof asset.url !== 'string' || !asset.url.startsWith(import.meta.env.BASE_URL)
      || asset.url.startsWith('//') || asset.url.includes('..') || !['image', 'audio', 'model', 'file'].includes(asset.kind)
      || typeof asset.required !== 'boolean') throw new Error('Некорректный ресурс manifest')
  }
}

async function validateResponse(response: Response, asset: RuntimeAsset): Promise<ArrayBuffer> {
  if (!response.ok || response.type === 'opaque') throw new Error(`HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  if (!bytes.byteLength || (asset.bytes !== undefined && bytes.byteLength !== asset.bytes)) throw new Error('Неполный ресурс')
  if (asset.contentType && !(response.headers.get('content-type') ?? '').includes(asset.contentType)) throw new Error('Неверный тип ресурса')
  if (asset.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (actual !== asset.sha256) throw new Error('Контрольная сумма не совпадает')
  }
  return bytes
}

async function decodeAsset(bytes: ArrayBuffer, asset: RuntimeAsset) {
  if (asset.kind === 'image') {
    const blob = new Blob([bytes])
    if (typeof createImageBitmap === 'function') (await createImageBitmap(blob)).close()
    else {
      const url = URL.createObjectURL(blob)
      try { const image = new Image(); image.src = url; await image.decode() }
      finally { URL.revokeObjectURL(url) }
    }
  }
  if (asset.kind === 'audio') {
    if (typeof OfflineAudioContext === 'undefined') throw new Error('Декодирование аудио недоступно')
    await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes)
  }
  if (asset.kind === 'model') {
    // Import Three's decoder only when an actual model is configured, after the
    // lightweight loader has painted. parseAsync also prepares referenced buffers,
    // accessors, geometry, materials and textures instead of trusting JSON headers.
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
    const url = new URL(asset.url, globalThis.location?.href ?? 'http://localhost/')
    const model = await new GLTFLoader().parseAsync(bytes, new URL('.', url).href)
    const geometries = new Set<import('three').BufferGeometry>()
    const materials = new Set<import('three').Material>()
    const textures = new Set<import('three').Texture>()
    for (const scene of model.scenes) scene.traverse((object) => {
      const mesh = object as import('three').Mesh
      if (mesh.geometry) geometries.add(mesh.geometry)
      for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) {
        materials.add(material)
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
      }
    })
    for (const texture of textures) {
      const image = texture.image as { close?: () => void } | undefined
      image?.close?.()
      texture.dispose()
    }
    for (const material of materials) material.dispose()
    for (const geometry of geometries) geometry.dispose()
  }
}

export function runtimeCacheName(version: string) { return `little-universe-${version}` }

/** Read every mandatory cached response, optionally repairing exact current-build entries. */
export async function verifyRuntimeCache(manifest: RuntimeManifest, storage: Pick<CacheStorage, 'open'> = caches, repairFetch?: typeof fetch) {
  const cache = await storage.open(runtimeCacheName(manifest.version))
  for (const asset of manifest.assets.filter((entry) => entry.required)) {
    const response = await cache.match(asset.url, { ignoreVary: true })
    try {
      if (!response) throw new Error(`В автономном кэше нет ${asset.url}`)
      await validateResponse(response, asset)
    } catch (error) {
      if (!repairFetch) throw error
      // Remove only the known invalid entry before fetching its exact manifest URL.
      // The active worker then sees a cache miss rather than serving corrupt bytes
      // back to this repair request. Valid entries and other build versions stay intact.
      await cache.delete(asset.url, { ignoreVary: true })
      const replacement = await repairFetch(asset.url, { cache: 'reload', signal: AbortSignal.timeout(25000) })
      await validateResponse(replacement.clone(), asset)
      await cache.put(asset.url, replacement)
    }
  }
  const manifestUrl = `${import.meta.env.BASE_URL}runtime-manifest.json`
  const cachedManifest = await cache.match(manifestUrl, { ignoreVary: true })
  let matchingManifest = false
  if (cachedManifest?.ok) {
    try { matchingManifest = (await cachedManifest.json()).version === manifest.version }
    catch { matchingManifest = false }
  }
  if (!matchingManifest) {
    if (!repairFetch) throw new Error('Версия автономного кэша не подтверждена')
    await cache.put(manifestUrl, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }))
  }
  // Successful network fetches or writes alone are insufficient: read the entire
  // mandatory snapshot back from storage before promising offline readiness.
  if (repairFetch) await verifyRuntimeCache(manifest, storage)
}

async function prepareOffline(manifest: RuntimeManifest) {
  if (!('serviceWorker' in navigator) || !('caches' in globalThis)) throw new Error('Хранилище или Service Worker недоступны')
  const script = `${import.meta.env.BASE_URL}sw.js?v=${manifest.version}`
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  if (existing?.active?.scriptURL === new URL(script, location.href).href) {
    await verifyRuntimeCache(manifest, caches, fetch)
    return
  }
  const registration = await navigator.serviceWorker.register(script, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
  const worker = registration.installing ?? registration.waiting ?? registration.active
  if (!worker) throw new Error('Автономный обработчик не установлен')
  if (worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error('Проверка автономного кэша заняла слишком много времени')), 30000)
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      worker.removeEventListener('statechange', changed)
      if (error) reject(error); else resolve()
    }
    const changed = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'installed' && registration.active) finish(new Error('Новая автономная сборка подготовлена. Для её включения закрой другие вкладки подарка и открой страницу заново'))
      else if (worker.state === 'redundant') finish(new Error('Не удалось сохранить автономную сборку'))
    }
    worker.addEventListener('statechange', changed)
    changed()
  })
  await verifyRuntimeCache(manifest, caches, fetch)
}
