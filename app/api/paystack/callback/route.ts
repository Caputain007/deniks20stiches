import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { afterPaid, afterPaymentIssue } from '@/lib/after-paid'
import { getDb, schema } from '@/lib/db'
import { finalizePayment, findPaymentAttempt } from '@/lib/orders'
import { originFromRequest } from '@/lib/origin'

// Paystack sends the shopper here after checkout: /api/paystack/callback?reference=…
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('trxref') ?? ''
  const origin = originFromRequest(request)
  const track = NextResponse.redirect(new URL('/track', origin), 303)
  if (!/^DS-[A-Z0-9]{6}-[A-Z0-9]{12}$/.test(reference)) return track

  // Only references this shop created (random and unguessable) lead to an order.
  const attempt = await findPaymentAttempt(reference)
  if (!attempt) return track

  try {
    const result = await finalizePayment(reference)
    if (result?.newlyPaid) afterPaid(result.order.id, origin)
    if (result?.newIssue) afterPaymentIssue(result.order, result.newIssue, origin)
  } catch (error) {
    // Paystack or the database didn't answer. The webhook will confirm the
    // payment shortly; the order page tells the shopper to refresh.
    console.error('Payment confirmation failed for', reference, error)
  }

  const [order] = await getDb()
    .select({ number: schema.orders.number, accessKey: schema.orders.accessKey })
    .from(schema.orders)
    .where(eq(schema.orders.id, attempt.orderId))
  if (!order) return track
  return NextResponse.redirect(new URL(`/order/${order.number}?key=${order.accessKey}&paid=1`, origin), 303)
}
