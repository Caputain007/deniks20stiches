import type { Metadata } from 'next'
import { count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoginForm } from '@/components/admin/login-form'
import { Wordmark } from '@/components/shop/wordmark'
import { getAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <div className="bg-white p-6 ring-1 ring-line sm:p-8">
          <h1 className="text-3xl">Shop admin</h1>
          <Suspense fallback={<div className="mt-6 h-48 animate-pulse bg-blush" />}>
            <LoginBody />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

async function LoginBody() {
  const authReady = (process.env.AUTH_SECRET?.length ?? 0) >= 32
  if (!authReady) {
    return (
      <p className="mt-4 text-sm leading-relaxed">
        Admin sign-in isn’t set up yet. Add an <strong>AUTH_SECRET</strong> environment variable (a random string of 32+
        characters) in Vercel, then redeploy.
      </p>
    )
  }
  if (await getAdmin()) redirect('/admin')
  const [{ admins }] = await getDb().select({ admins: count() }).from(schema.adminUsers)
  const canBootstrap = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)

  if (admins === 0 && !canBootstrap) {
    return (
      <p className="mt-4 text-sm leading-relaxed">
        No admin account exists yet. Add <strong>ADMIN_EMAIL</strong> and <strong>ADMIN_PASSWORD</strong> environment
        variables in Vercel, redeploy, then sign in with them here.
      </p>
    )
  }
  return (
    <>
      {admins === 0 && (
        <p className="mt-3 text-sm text-muted">
          First sign-in: use the ADMIN_EMAIL and ADMIN_PASSWORD you set in Vercel.
        </p>
      )}
      <LoginForm />
    </>
  )
}
