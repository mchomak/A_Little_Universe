import type { RecordingInfo } from './MediaSession'

export interface RecordingStore {
  create(info: RecordingInfo): Promise<void>
  append(id: string, blob: Blob): Promise<RecordingInfo>
  finalize(id: string, status: 'complete' | 'incomplete', error?: string): Promise<RecordingInfo>
  list(): Promise<RecordingInfo[]>
  read(id: string): Promise<{ info: RecordingInfo; chunks: Blob[] }>
  delete(id: string): Promise<void>
  close(): void
}

/** Transactions resolve on commit, never on the earlier request success event. */
export class IndexedRecordingStore implements RecordingStore {
  private database: Promise<IDBDatabase> | null = null
  constructor(private readonly name = 'little-universe-reactions-v1') {}
  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) { reject(new Error('Локальное хранилище записей недоступно.')); return }
        const request = indexedDB.open(this.name, 1)
        let abandoned = false
        request.onupgradeneeded = () => {
          request.result.createObjectStore('sessions', { keyPath: 'id' })
          request.result.createObjectStore('chunks', { keyPath: ['id', 'order'] })
        }
        request.onsuccess = () => {
          const db = request.result
          if (abandoned) { db.close(); return }
          db.onversionchange = () => { db.close(); this.database = null }
          resolve(db)
        }
        request.onerror = () => { this.database = null; reject(request.error) }
        request.onblocked = () => { abandoned = true; this.database = null; reject(new Error('Хранилище занято другой вкладкой. Закрой её и повтори.')) }
      })
    }
    return this.database
  }
  private async transaction<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    const db = await this.open()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'chunks'], mode)
      let value: T
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(tx.error ?? new Error('Запись в локальное хранилище прервана.'))
      try { action(tx, (result) => { value = result }) } catch (error) { tx.abort(); reject(error) }
    })
  }
  create(info: RecordingInfo): Promise<void> { return this.transaction('readwrite', (tx) => { tx.objectStore('sessions').add(info) }) }
  append(id: string, blob: Blob): Promise<RecordingInfo> {
    return this.transaction('readwrite', (tx, result) => {
      const sessions = tx.objectStore('sessions')
      const request = sessions.get(id)
      request.onsuccess = () => {
        const previous = request.result as RecordingInfo | undefined
        if (!previous) { tx.abort(); return }
        const next = { ...previous, chunks: previous.chunks + 1, bytes: previous.bytes + blob.size }
        tx.objectStore('chunks').add({ id, order: previous.chunks, blob })
        sessions.put(next)
        result(next)
      }
    })
  }
  finalize(id: string, status: 'complete' | 'incomplete', error?: string): Promise<RecordingInfo> {
    return this.transaction('readwrite', (tx, result) => {
      const sessions = tx.objectStore('sessions')
      const request = sessions.get(id)
      request.onsuccess = () => {
        if (!request.result) { tx.abort(); return }
        const next: RecordingInfo = { ...request.result as RecordingInfo, status, ...(error ? { error } : {}) }
        sessions.put(next); result(next)
      }
    })
  }
  list(): Promise<RecordingInfo[]> {
    return this.transaction('readonly', (tx, result) => {
      const request = tx.objectStore('sessions').getAll()
      request.onsuccess = () => result((request.result as RecordingInfo[]).sort((a, b) => b.createdAt - a.createdAt))
    })
  }
  read(id: string): Promise<{ info: RecordingInfo; chunks: Blob[] }> {
    return this.transaction('readonly', (tx, result) => {
      const info = tx.objectStore('sessions').get(id)
      const chunks = tx.objectStore('chunks').getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]))
      let metadata: RecordingInfo | undefined
      let blobs: Blob[] | undefined
      const finish = () => { if (metadata && blobs) result({ info: metadata, chunks: blobs }) }
      info.onsuccess = () => { metadata = info.result as RecordingInfo | undefined; if (!metadata) { tx.abort(); return }; finish() }
      chunks.onsuccess = () => { blobs = (chunks.result as { blob: Blob }[]).map((chunk) => chunk.blob); finish() }
    })
  }
  delete(id: string): Promise<void> {
    return this.transaction('readwrite', (tx) => {
      tx.objectStore('sessions').delete(id)
      tx.objectStore('chunks').delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]))
    })
  }
  close(): void { void this.database?.then((db) => db.close(), () => undefined); this.database = null }
}
