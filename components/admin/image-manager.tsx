'use client'
/* eslint-disable @next/next/no-img-element -- admin thumbnails */

import { upload } from '@vercel/blob/client'
import { useRef, useState, useTransition } from 'react'
import { addProductImage, deleteImage, moveImage, saveImageAlt, type ActionState } from '@/app/actions/admin-products'

type Photo = { id: number; url: string; thumbUrl: string; alt: string }
type Job = { id: string; name: string; state: 'working' | 'done' | 'error'; error?: string }

const LARGE = 1600
const SMALL = 640

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
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

async function encode(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
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

function randomName() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function store(mode: 'blob' | 'local', pathname: string, blob: Blob): Promise<string> {
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

export function ImageManager({
  productId,
  photos,
  mode,
  minPhotos,
}: {
  productId: number
  photos: Photo[]
  mode: 'blob' | 'local' | 'none'
  minPhotos: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [message, setMessage] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()
  const uploading = jobs.some((j) => j.state === 'working')

  async function handleFiles(files: FileList | null) {
    if (!files?.length || mode === 'none') return
    setMessage(null)
    const list = Array.from(files).slice(0, 20)
    const queued: Job[] = list.map((f) => ({ id: randomName(), name: f.name, state: 'working' }))
    setJobs((j) => [...j.filter((x) => x.state !== 'done'), ...queued])

    // One at a time keeps memory low on phones and keeps the photo order.
    for (const [i, file] of list.entries()) {
      const job = queued[i]
      try {
        if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name))
          throw new Error('This isn’t a photo.')
        let source: ImageBitmap | HTMLImageElement
        try {
          source = await decode(file)
        } catch {
          throw new Error('This browser can’t open this photo format. Save it as JPG or PNG and try again.')
        }
        const large = await encode(source, LARGE, 0.86)
        const small = await encode(source, SMALL, 0.8)
        if ('close' in source) source.close()
        const base = `products/${productId}/${randomName()}`
        const [url, thumbUrl] = await Promise.all([
          store(mode, `${base}-lg.${large.ext}`, large.blob),
          store(mode, `${base}-sm.${small.ext}`, small.blob),
        ])
        const result = await addProductImage(productId, { url, thumbUrl, width: large.width, height: large.height })
        if (result?.error) throw new Error(result.error)
        setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, state: 'done' } : j)))
      } catch (error) {
        setJobs((js) =>
          js.map((j) => (j.id === job.id ? { ...j, state: 'error', error: (error as Error).message } : j)),
        )
      }
    }
    if (input.current) input.current.value = ''
  }

  const act = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      setMessage(await fn())
    })

  const missing = Math.max(0, minPhotos - photos.length)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className={missing ? 'font-semibold text-amber' : 'text-leaf'}>
          {photos.length} photo{photos.length === 1 ? '' : 's'}
          {missing > 0 ? `. Add ${missing} more to publish (at least ${minPhotos}).` : '. Enough to publish.'}
        </p>
        {mode !== 'none' && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="peer sr-only"
              id="photo-input"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
            <label
              htmlFor="photo-input"
              className={`btn btn-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum peer-focus-visible:outline-dashed ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {uploading ? 'Uploading…' : 'Upload photos'}
            </label>
          </>
        )}
      </div>

      {mode === 'none' && (
        <p className="mb-4 border border-dashed border-amber bg-white px-4 py-3 text-sm text-amber">
          Photo uploads need a Vercel Blob store. In Vercel, open Storage, create a Blob store, connect it to this
          project, then redeploy.
        </p>
      )}

      {jobs.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm" aria-live="polite">
          {jobs.map((j) => (
            <li
              key={j.id}
              className={j.state === 'error' ? 'text-rose' : j.state === 'done' ? 'text-leaf' : 'text-muted'}
            >
              {j.name}: {j.state === 'working' ? 'uploading…' : j.state === 'done' ? 'added' : j.error}
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-muted">
          No photos yet. Upload at least {minPhotos}: front, back, a close-up of the detail and one worn or styled.
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <li key={photo.id} className="bg-mist p-2 ring-1 ring-line">
              <div className="relative">
                <img src={photo.thumbUrl} alt={photo.alt} className="aspect-[4/5] w-full object-cover" />
                <span className="absolute left-2 top-2 bg-white/95 px-2 py-0.5 text-xs font-bold">
                  {i === 0 ? 'Cover' : i + 1}
                </span>
              </div>
              <AltInput photo={photo} onSave={(alt) => act(() => saveImageAlt(photo.id, alt))} />
              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm px-2"
                    disabled={i === 0 || pending}
                    onClick={() => act(() => moveImage(photo.id, -1))}
                    aria-label={`Move photo ${i + 1} earlier`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm px-2"
                    disabled={i === photos.length - 1 || pending}
                    onClick={() => act(() => moveImage(photo.id, 1))}
                    aria-label={`Move photo ${i + 1} later`}
                  >
                    →
                  </button>
                </div>
                <DeleteButton disabled={pending} onConfirm={() => act(() => deleteImage(photo.id))} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <p aria-live="polite" className="mt-3 text-sm">
        {message?.error && <span className="font-semibold text-rose">{message.error}</span>}
      </p>
      {photos.length > 1 && (
        <p className="mt-2 text-sm text-muted">The first photo is the cover in the shop. Use the arrows to reorder.</p>
      )}
    </div>
  )
}

function AltInput({ photo, onSave }: { photo: Photo; onSave: (alt: string) => void }) {
  const [value, setValue] = useState(photo.alt)
  return (
    <input
      aria-label="Photo description"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== photo.alt && onSave(value)}
      placeholder="Describe the photo"
      className="field mt-2 min-h-9 py-1 text-sm"
      maxLength={200}
    />
  )
}

function DeleteButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [asking, setAsking] = useState(false)
  if (asking) {
    return (
      <span className="flex gap-1">
        <button
          type="button"
          className="btn btn-danger btn-sm px-2"
          onClick={() => {
            setAsking(false)
            onConfirm()
          }}
        >
          Delete
        </button>
        <button type="button" className="btn btn-quiet btn-sm px-2" onClick={() => setAsking(false)}>
          Keep
        </button>
      </span>
    )
  }
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm px-2 text-rose"
      disabled={disabled}
      onClick={() => setAsking(true)}
    >
      Delete
    </button>
  )
}
