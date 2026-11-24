import { NextResponse } from 'next/server'
import { afterPaid, afterPaymentIssue } from '@/lib/after-paid'
import { getDb, schema } from '@/lib/db'
import { finalizePayment, isOurPayment } from '@/lib/orders'
import { originFromRequest } from '@/lib/origin'
import { verifyWebhookSignature } from '@/lib/paystack'

// Set this URL in Paystack → Settings → API Keys & Webhooks: https://<your-domain>/api/paystack/webhook
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer())
  if (!verifyWebhookSignature(raw, request.headers)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: { event?: string; data?: Record<string, unknown> & { reference?: string } }
  try {
    event = JSON.parse(raw.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const reference = event.data?.reference
  if (!event.event || typeof reference !== 'string') return NextResponse.json({ ok: true })

  // The same Paystack account may also take payments elsewhere (payment links,
  // other sites). Only references this shop created are handled.
  if (!(await isOurPayment(reference))) return NextResponse.json({ ok: true, ignored: true })

  await getDb()
    .insert(schema.paymentEvents)
    // Keep only what helps with troubleshooting; skip card and customer details.
    .values({
      reference,
      event: event.event,
      payload: {
        status: event.data?.status,
        amount: event.data?.amount,
        currency: event.data?.currency,
        channel: event.data?.channel,
        paid_at: event.data?.paid_at,
        gateway_response: event.data?.gateway_response,
      },
    })
    .catch((error) => console.error('Could not log Paystack event', error))

  if (event.event === 'charge.success') {
    try {
      // finalizePayment asks Paystack to confirm the payment before marking anything paid.
      const result = await finalizePayment(reference)
      const origin = originFromRequest(request)
      if (result?.newlyPaid) afterPaid(result.order.id, origin)
      if (result?.newIssue) afterPaymentIssue(result.order, result.newIssue, origin)
    } catch (error) {
      console.error('Webhook could not confirm payment', reference, error)
      // A non-2xx answer makes Paystack retry later.
      return NextResponse.json({ error: 'try again' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
