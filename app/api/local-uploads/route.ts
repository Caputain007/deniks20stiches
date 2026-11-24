import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getAdmin } from '@/lib/auth'
import { LOCAL_UPLOAD_DIR, LOCAL_UPLOAD_PREFIX, storageMode } from '@/lib/storage'

// Only for running the shop on your own computer (LOCAL_UPLOADS=1). On Vercel, photos go to Vercel Blob.
export async function POST(request: Request) {
  if (storageMode() !== 'local') return NextResponse.json({ error: 'Not available' }, { status: 404 })
  if (!(await getAdmin())) return NextResponse.json({ error: 'Sign in to upload photos.' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Send one image under 10 MB.' }, { status: 400 })
  }
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : null
  if (!ext) return NextResponse.json({ error: 'Only WebP or JPEG.' }, { status: 400 })

  const name = `${randomBytes(12).toString('hex')}.${ext}`
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()))
  return NextResponse.json({ url: `${LOCAL_UPLOAD_PREFIX}${name}` })
}
