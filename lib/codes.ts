import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'

// No 0/O or 1/I, so codes are easy to read out on the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function randomCode(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length] // 256 is a multiple of 32: no bias
  return out
}

export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause
  return (error as { code?: string })?.code === '23505' || cause?.code === '23505'
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

/** A one-way fingerprint of the sender's address, for rate limits without storing the address. */
export async function clientFingerprint(): Promise<string> {
  const ip = await clientIp()
  return createHash('sha256')
    .update(`${process.env.AUTH_SECRET ?? 'deniks20'}:${ip}`)
    .digest('base64url')
    .slice(0, 22)
}
