import Link from 'next/link'
import { Suspense } from 'react'
import { logout } from '@/app/actions/admin-auth'
import { AdminNav, AdminNavFallback } from '@/components/admin/admin-nav'
import { Wordmark } from '@/components/shop/wordmark'

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-4">
          <Link href="/admin" className="no-underline">
            <Wordmark size={34} />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-semibold text-plum" target="_blank">
              View shop
            </Link>
            <form action={logout}>
              <button type="submit" className="font-semibold text-muted hover:text-plum">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5">
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <Suspense fallback={<div className="h-64 animate-pulse bg-white/60" aria-label="Loading" />}>
          {children}
        </Suspense>
      </main>
    </>
  )
}
