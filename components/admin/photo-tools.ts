// Photo helpers for admin uploads: resize in the browser, then store in Vercel
// Blob (or on disk when LOCAL_UPLOADS=1), so big phone photos never hit the server.
import { upload } from '@vercel/blob/client'

export async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height }
}

export async function encode(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const { width, height } = sizeOf(source)
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t process photos.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  let blob = await toBlob('image/webp')
  // Older Safari can't write WebP and quietly returns PNG; use JPEG then.
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  if (!blob) throw new Error('Couldn’t prepare the photo.')
  return { blob, width: canvas.width, height: canvas.height, ext: blob.type === 'image/webp' ? 'webp' : 'jpg' }
}

export function randomName() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function store(mode: 'blob' | 'local', pathname: string, blob: Blob): Promise<string> {
  if (mode === 'blob') {
    const result = await upload(pathname, blob, {
      access: 'public',
      handleUploadUrl: '/api/admin/upload',
      contentType: blob.type,
    })
    return result.url
  }
  const form = new FormData()
  form.append('file', blob, pathname.split('/').pop())
  const res = await fetch('/api/local-uploads', { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed.')
  return data.url
}
