import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { LOCAL_UPLOAD_DIR, storageMode } from '@/lib/storage'

// Serves photos saved with LOCAL_UPLOADS=1 (local testing only).
export async function GET(_request: Request, { params }: RouteContext<'/api/local-uploads/[name]'>) {
  const { name } = await params
  if (storageMode() !== 'local' || !/^[\w-]+\.(webp|jpg)$/.test(name)) return new Response('Not found', { status: 404 })
  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, name))
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
