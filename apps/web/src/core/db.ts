const DB_NAME = 'stellar-browser-v1'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export interface BlobRecord {
  id: string
  blob: Blob
  mime: string
  createdAt: number
}

export async function putBlob(blob: Blob, id = `blob_${crypto.randomUUID()}`): Promise<string> {
  await tx('blobs', 'readwrite', (s) => s.put({ id, blob, mime: blob.type, createdAt: Date.now() } satisfies BlobRecord))
  return id
}

export async function getBlob(id: string): Promise<Blob | null> {
  const rec = await tx<BlobRecord | undefined>('blobs', 'readonly', (s) => s.get(id))
  return rec?.blob ?? null
}

export async function hasBlob(id: string): Promise<boolean> {
  const rec = await tx<BlobRecord | undefined>('blobs', 'readonly', (s) => s.get(id))
  return Boolean(rec)
}

export async function deleteBlob(id: string): Promise<void> {
  await tx('blobs', 'readwrite', (s) => s.delete(id))
}

export async function listBlobIds(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>('blobs', 'readonly', (s) => s.getAllKeys())
  return keys.map(String)
}

export async function clearBlobs(): Promise<void> {
  await tx('blobs', 'readwrite', (s) => s.clear())
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await tx<T | undefined>('kv', 'readonly', (s) => s.get(key))) ?? undefined
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await tx('kv', 'readwrite', (s) => s.put(value, key))
}

export async function estimateUsage(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 }
  const est = await navigator.storage.estimate()
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
}

const urlCache = new Map<string, string>()

export async function getBlobUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!
  const blob = await getBlob(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function revokeBlobUrl(id: string) {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}
