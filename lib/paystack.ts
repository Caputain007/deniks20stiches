import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// PAYSTACK_BASE_URL only exists so tests can point at a mock; leave it unset.
const BASE_URL = (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').replace(/\/$/, '')

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('PAYSTACK_SECRET_KEY is not set')
  }
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new PaymentsNotConfiguredError()
  return key
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null
  if (!res.ok || !body?.status || body.data === undefined) {
    throw new Error(`Paystack ${path.split('?')[0]} failed (${res.status}): ${body?.message ?? 'no response body'}`)
  }
  return body.data
}

export type InitializedPayment = { authorizationUrl: string; accessCode: string; reference: string }

/** Starts a hosted Paystack checkout. Amount is in kobo. */
export async function initializeTransaction(input: {
  email: string
  amountKobo: number
  reference: string
  callbackUrl: string
  metadata: Record<string, unknown>
}): Promise<InitializedPayment> {
  const data = await call<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: 'NGN',
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
  )
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference }
}

export type VerifiedTransaction = {
  status: string
  reference: string
  /** What was charged, including any Paystack fees passed on to the customer. */
  amount: number
  /** The amount the shop asked for. Differs from `amount` when fees are passed on to the customer. */
  requestedAmount: number | null
  currency: string
  channel: string | null
  paidAt: string | null
  metadata: Record<string, unknown> | null
}

/** Asks Paystack for the real state of a payment. This, not the redirect or webhook body, decides whether an order is paid. */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await call<{
    status: string
    reference: string
    amount: number
    requested_amount?: number | null
    currency: string
    channel?: string | null
    paid_at?: string | null
    metadata?: unknown
  }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  let metadata: Record<string, unknown> | null = null
  if (data.metadata && typeof data.metadata === 'object') metadata = data.metadata as Record<string, unknown>
  else if (typeof data.metadata === 'string') {
    try {
      metadata = JSON.parse(data.metadata)
    } catch {
      metadata = null
    }
  }
  return {
    status: data.status,
    reference: data.reference,
    amount: Number(data.amount),
    requestedAmount: typeof data.requested_amount === 'number' ? data.requested_amount : null,
    currency: data.currency,
    channel: data.channel ?? null,
    paidAt: data.paid_at ?? null,
    metadata,
  }
}

function hexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]{128}$/i.test(a) || !/^[0-9a-f]{128}$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a.toLowerCase(), 'hex'), Buffer.from(b.toLowerCase(), 'hex'))
}

/**
 * Checks that a webhook came from Paystack. Supports the current
 * `Paystack-Signature` header (needs PAYSTACK_WEBHOOK_SECRET, "whsec_…") and the
 * older `X-Paystack-Signature` header (signed with the secret key).
 */
export function verifyWebhookSignature(rawBody: Buffer, headers: Headers, nowSeconds = Date.now() / 1000): boolean {
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET
  const modern = headers.get('paystack-signature')
  if (signingSecret && modern) {
    let timestamp: string | null = null
    const signatures: string[] = []
    for (const part of modern.split(',')) {
      const [key, ...rest] = part.trim().split('=')
      const value = rest.join('=')
      if (key === 't') timestamp = value
      if (key === 'v1') signatures.push(value.slice(value.indexOf(':') + 1))
    }
    if (timestamp && /^\d+$/.test(timestamp) && Math.abs(nowSeconds - Number(timestamp)) <= 300) {
      const expected = createHmac('sha512', signingSecret)
        .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
        .digest('hex')
      if (signatures.some((s) => hexEqual(expected, s))) return true
    }
  }

  const legacy = headers.get('x-paystack-signature')
  const key = process.env.PAYSTACK_SECRET_KEY
  if (legacy && key) {
    const expected = createHmac('sha512', key).update(rawBody).digest('hex')
    if (hexEqual(expected, legacy)) return true
  }
  return false
}
