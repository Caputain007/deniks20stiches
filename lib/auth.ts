import 'server-only'
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getDb, schema } from './db'

const COOKIE = 'ds_admin'
const SESSION_DAYS = 14

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

const SCRYPT = { N: 16384, r: 8, p: 1 }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', authSecret()).update(payload).digest('base64url')
}

type SessionPayload = { u: number; v: number; e: number }

export async function startSession(adminId: number, sessionVersion: number): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({
      u: adminId,
      v: sessionVersion,
      e: Date.now() + SESSION_DAYS * 86_400_000,
    } satisfies SessionPayload),
  ).toString('base64url')
  ;(await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

export async function endSession(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}

export type Admin = { id: number; email: string; name: string }

/** The signed-in admin, or null. Reads the session cookie, so call it at request time. */
export async function getAdmin(): Promise<Admin | null> {
  // Admin data is only ever rendered for a real request, never prerendered.
  await connection()
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  let session: SessionPayload
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof session.u !== 'number' || typeof session.e !== 'number' || session.e < Date.now()) return null

  const [admin] = await getDb()
    .select({
      id: schema.adminUsers.id,
      email: schema.adminUsers.email,
      name: schema.adminUsers.name,
      sessionVersion: schema.adminUsers.sessionVersion,
    })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, session.u))
  if (!admin || admin.sessionVersion !== session.v) return null
  return { id: admin.id, email: admin.email, name: admin.name }
}

/** Use at the top of every admin page and Server Action. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}
