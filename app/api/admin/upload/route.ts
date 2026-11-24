import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getAdmin } from '@/lib/auth'

// Gives the admin's browser a short-lived token to upload a product or banner photo
// straight to Vercel Blob (so large phone photos never pass through this server).
export async function POST(request: Request) {
  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await getAdmin())) throw new Error('Sign in to upload photos.')
        if (!/^(products\/\d+|banners)\/[\w-]+\.(webp|jpg)$/.test(pathname)) throw new Error('Unexpected file name.')
        return {
          allowedContentTypes: ['image/webp', 'image/jpeg'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
