import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { afterPaid } from '@/lib/after-paid'
import { getDb, schema } from '@/lib/db'
import { finalizePayment } from '@/lib/orders'
import { originFromRequest } from '@/lib/origin'

// Paystack sends the shopper here after checkout: /api/paystack/callback?reference=…
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('trxref') ?? ''
  const origin = originFromRequest(request)
  if (!/^[A-Za-z0-9.=-]{1,100}$/.test(reference)) return NextResponse.redirect(new URL('/track', origin), 303)

  let order: { number: string; accessKey: string } | null = null
  try {
    const result = await finalizePayment(reference)
    if (result) {
      order = result.order
      if (result.newlyPaid) afterPaid(result.order.id, origin)
    }
  } catch (error) {
    // Paystack or the database didn't answer. The webhook will confirm the
    // payment shortly; send the shopper to their order page meanwhile.
    console.error('Payment confirmation failed for', reference, error)
  }

  if (!order) {
    const [found] = await getDb()
      .select({ number: schema.orders.number, accessKey: schema.orders.accessKey })
      .from(schema.orders)
      .where(eq(schema.orders.paymentReference, reference))
    order = found ?? null
  }
  if (!order) return NextResponse.redirect(new URL('/track', origin), 303)
  return NextResponse.redirect(new URL(`/order/${order.number}?key=${order.accessKey}&paid=1`, origin), 303)
}
