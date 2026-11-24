import 'server-only'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { del } from '@vercel/blob'

/**
 * Product photos live in Vercel Blob (BLOB_READ_WRITE_TOKEN is added when you
 * connect a Blob store to the project). LOCAL_UPLOADS=1 keeps them on disk,
 * for trying the shop on your own computer only.
 */
export type StorageMode = 'blob' | 'local' | 'none'

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob'
  if (process.env.LOCAL_UPLOADS === '1') return 'local'
  return 'none'
}

export const LOCAL_UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), '.local-uploads')
export const LOCAL_UPLOAD_PREFIX = '/api/local-uploads/'

/** Whether a URL is one of our stored photos (so we never save or delete arbitrary URLs). */
export function isStoredPhotoUrl(url: string): boolean {
  if (url.startsWith(LOCAL_UPLOAD_PREFIX)) return /^\/api\/local-uploads\/[\w-]+\.(webp|jpg)$/.test(url)
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export async function deleteStoredFiles(urls: string[]): Promise<void> {
  const blobUrls = urls.filter((u) => u.startsWith('https://'))
  const localUrls = urls.filter((u) => u.startsWith(LOCAL_UPLOAD_PREFIX))
  try {
    if (blobUrls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(blobUrls)
    for (const url of localUrls) {
      await unlink(path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, path.basename(url))).catch(() => {})
    }
  } catch (error) {
    // A leftover file costs a little storage; it must not block the admin.
    console.error('Could not delete stored photos', error)
  }
}
