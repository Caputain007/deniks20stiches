import { NextResponse, type NextRequest } from 'next/server'

// Quick redirect for visitors without an admin session cookie. The real check
// (signature, expiry, account) happens in every admin page and Server Action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has('ds_admin')) {
    const login = new URL('/admin/login', request.url)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/((?!login).*)'],
}
