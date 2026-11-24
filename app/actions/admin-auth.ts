'use server'

import { and, count, eq, gte, lt, ne, or, sql } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { endSession, hashPassword, requireAdmin, startSession, verifyPassword } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'

export type FormState = { ok?: boolean; message?: string; error?: string } | null

const WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 5

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.' }

  const db = getDb()
  const ip = await clientIp()
  const since = new Date(Date.now() - WINDOW_MS)

  const [{ failures }] = await db
    .select({ failures: count() })
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.success, false),
        gte(schema.loginAttempts.createdAt, since),
        or(eq(schema.loginAttempts.ip, ip), eq(schema.loginAttempts.email, email)),
      ),
    )
  if (failures >= MAX_FAILURES) {
    return { error: 'Too many attempts. Wait 15 minutes, then try again.' }
  }

  let [admin] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email))

  // First sign-in: create the owner account from ADMIN_EMAIL / ADMIN_PASSWORD.
  if (!admin) {
    const [{ admins }] = await db.select({ admins: count() }).from(schema.adminUsers)
    const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const bootstrapPassword = process.env.ADMIN_PASSWORD
    if (
      admins === 0 &&
      bootstrapEmail &&
      bootstrapPassword &&
      email === bootstrapEmail &&
      password === bootstrapPassword
    ) {
      ;[admin] = await db
        .insert(schema.adminUsers)
        .values({ email, name: 'Owner', passwordHash: await hashPassword(password) })
        .onConflictDoNothing()
        .returning()
      admin ??= (await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email)))[0]
    }
  }

  const ok = admin ? await verifyPassword(password, admin.passwordHash) : false
  await db.insert(schema.loginAttempts).values({ ip, email, success: ok })
  // Keep the table small: forget attempts older than a day.
  await db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 86_400_000)))

  if (!ok || !admin) return { error: 'That email and password don’t match.' }

  await db.update(schema.adminUsers).set({ lastLoginAt: new Date() }).where(eq(schema.adminUsers.id, admin.id))
  await startSession(admin.id, admin.sessionVersion)
  redirect('/admin')
}

export async function logout() {
  await endSession()
  redirect('/admin/login')
}

const passwordSchema = z.string().min(10, 'Use at least 10 characters.').max(200)

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin()
  const current = String(formData.get('current') ?? '')
  const next = passwordSchema.safeParse(String(formData.get('next') ?? ''))
  if (!next.success) return { error: next.error.issues[0].message }

  const db = getDb()
  const [admin] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, me.id))
  if (!admin || !(await verifyPassword(current, admin.passwordHash))) {
    return { error: 'Your current password is wrong.' }
  }
  const [updated] = await db
    .update(schema.adminUsers)
    .set({ passwordHash: await hashPassword(next.data), sessionVersion: sql`${schema.adminUsers.sessionVersion} + 1` })
    .where(eq(schema.adminUsers.id, me.id))
    .returning()
  // Other devices are signed out; keep this one signed in.
  await startSession(updated.id, updated.sessionVersion)
  return { ok: true, message: 'Password changed. Other devices have been signed out.' }
}

export async function addAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const email = z.email().safeParse(
    String(formData.get('email') ?? '')
      .trim()
      .toLowerCase(),
  )
  const name = String(formData.get('name') ?? '')
    .trim()
    .slice(0, 80)
  const password = passwordSchema.safeParse(String(formData.get('password') ?? ''))
  if (!email.success) return { error: 'Enter a valid email address.' }
  if (!password.success) return { error: `Temporary password: ${password.error.issues[0].message}` }

  const [created] = await getDb()
    .insert(schema.adminUsers)
    .values({ email: email.data, name, passwordHash: await hashPassword(password.data) })
    .onConflictDoNothing()
    .returning()
  if (!created) return { error: 'There is already an admin with that email.' }
  refresh()
  return { ok: true, message: `${email.data} can now sign in. Ask them to change the temporary password.` }
}

export async function removeAdmin(id: number): Promise<FormState> {
  const me = await requireAdmin()
  if (id === me.id) return { error: 'You can’t remove yourself.' }
  const db = getDb()
  const [{ others }] = await db.select({ others: count() }).from(schema.adminUsers).where(ne(schema.adminUsers.id, id))
  if (others === 0) return { error: 'The shop needs at least one admin.' }
  await db.delete(schema.adminUsers).where(eq(schema.adminUsers.id, id))
  refresh()
  return { ok: true, message: 'Admin removed.' }
}
