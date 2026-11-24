import { NextResponse } from 'next/server'
import { afterPaid } from '@/lib/after-paid'
import { getDb, schema } from '@/lib/db'
import { finalizePayment } from '@/lib/orders'
import { originFromRequest } from '@/lib/origin'
import { verifyWebhookSignature } from '@/lib/paystack'

// Set this URL in Paystack → Settings → API Keys & Webhooks: https://<your-domain>/api/paystack/webhook
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer())
  if (!verifyWebhookSignature(raw, request.headers)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(raw.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const reference = event.data?.reference
  if (!event.event || typeof reference !== 'string') return NextResponse.json({ ok: true })

  await getDb()
    .insert(schema.paymentEvents)
    .values({ reference, event: event.event, payload: event })
    .catch((error) => console.error('Could not log Paystack event', error))

  if (event.event === 'charge.success') {
    try {
      // finalizePayment asks Paystack to confirm the payment before marking anything paid.
      const result = await finalizePayment(reference)
      if (result?.newlyPaid) afterPaid(result.order.id, originFromRequest(request))
    } catch (error) {
      console.error('Webhook could not confirm payment', reference, error)
      // A non-2xx answer makes Paystack retry later.
      return NextResponse.json({ error: 'try again' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
