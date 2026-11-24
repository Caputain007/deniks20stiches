import 'server-only'
import type { MeasurementPurpose } from './db/schema'
import { countryName } from './geo'
import { formatMeasure, MEASUREMENTS, type Unit } from './measurements'
import { formatNaira } from './money'
import type { Order, OrderItem, PaymentIssue } from './orders'

// Optional: order emails are sent through Resend when RESEND_API_KEY and
// EMAIL_FROM are set. Without them the shop works the same, just without emails.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

async function send(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  if (!emailConfigured() || !to) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) console.error(`Email "${subject}" failed: ${res.status} ${await res.text().catch(() => '')}`)
  } catch (error) {
    console.error(`Email "${subject}" failed`, error)
  }
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7fa;font-family:Helvetica,Arial,sans-serif;color:#2a1531">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-family:Georgia,serif;font-size:20px;letter-spacing:.08em;margin:0 0 24px">DENIKS20 STITCHES</p>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">${esc(title)}</h1>
${body}
</div></body></html>`
}

function itemsTable(order: Order, items: OrderItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e0d3e0">${esc(i.productName)}<br><span style="color:#6e5d73;font-size:13px">Size ${esc(i.variantLabel)} × ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #e0d3e0;text-align:right">${formatNaira(i.unitPriceKobo * i.quantity)}</td></tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
<tr><td style="padding:8px 0">${order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</td><td style="padding:8px 0;text-align:right">${order.fulfillment === 'pickup' ? 'Free' : formatNaira(order.shippingKobo)}</td></tr>
${order.discountKobo > 0 ? `<tr><td style="padding:8px 0">Coupon ${esc(order.couponCode)}</td><td style="padding:8px 0;text-align:right">−${formatNaira(order.discountKobo)}</td></tr>` : ''}
<tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${formatNaira(order.totalKobo)}</td></tr></table>`
}

function address(order: Order): string {
  if (order.fulfillment === 'pickup') return [order.customerName, order.phone].filter(Boolean).map(esc).join('<br>')
  return [
    order.customerName,
    order.shipAddress1,
    order.shipAddress2,
    [order.shipCity, order.shipRegion, order.shipPostcode].filter(Boolean).join(', '),
    countryName(order.shipCountry),
    order.phone,
  ]
    .filter(Boolean)
    .map(esc)
    .join('<br>')
}

export async function sendOrderPaidEmails(
  order: Order,
  items: OrderItem[],
  origin: string,
  shop: { email: string; address: string; pickupNote: string },
) {
  const link = `${origin}/order/${order.number}?key=${order.accessKey}`
  const pickup = order.fulfillment === 'pickup'
  const shopEmail = shop.email
  await send(
    order.email,
    `Order ${order.number} confirmed`,
    layout(
      'Thank you for your order',
      `<p style="line-height:1.6">We've received your payment for order <strong>${esc(order.number)}</strong> and we're getting it ready. ${pickup ? "We'll let you know when it's ready to collect." : "We'll email you again when it ships."}</p>
${itemsTable(order, items)}
${
  pickup
    ? `<p style="line-height:1.6;margin-top:24px"><strong>Collect from</strong><br>${esc(shop.address)}${shop.pickupNote ? `<br><span style="color:#6e5d73">${esc(shop.pickupNote)}</span>` : ''}</p>`
    : `<p style="line-height:1.6;margin-top:24px"><strong>Delivering to</strong><br>${address(order)}</p>`
}
<p style="margin-top:24px"><a href="${esc(link)}" style="color:#4c2071">View your order</a></p>`,
    ),
    shopEmail || undefined,
  )

  const alertTo = process.env.ORDER_ALERT_EMAIL || shopEmail
  if (alertTo) {
    await send(
      alertTo,
      `New order ${order.number}: ${formatNaira(order.totalKobo)}`,
      layout(
        `New paid order ${order.number}`,
        `${itemsTable(order, items)}
<p style="line-height:1.6;margin-top:24px"><strong>${pickup ? 'Customer collects from the shop' : 'Ship to'}</strong><br>${address(order)}<br>${esc(order.email)}</p>
${order.deliveryNote ? `<p style="line-height:1.6"><strong>Delivery note</strong><br>${esc(order.deliveryNote)}</p>` : ''}
<p style="margin-top:24px"><a href="${esc(origin)}/admin/orders/${order.id}" style="color:#4c2071">Open in admin</a></p>`,
      ),
    )
  }
}

export async function sendOrderShippedEmail(
  order: Order,
  origin: string,
  shop: { email: string; address: string; hours: string },
) {
  const link = `${origin}/order/${order.number}?key=${order.accessKey}`
  const shopEmail = shop.email
  if (order.fulfillment === 'pickup') {
    await send(
      order.email,
      `Order ${order.number} is ready to collect`,
      layout(
        'Your order is ready to collect',
        `<p style="line-height:1.6">Order <strong>${esc(order.number)}</strong> is ready for you at our shop.</p>
<p style="line-height:1.6"><strong>Collect from</strong><br>${esc(shop.address)}${shop.hours ? `<br>Open ${esc(shop.hours)}` : ''}</p>
<p style="line-height:1.6">Bring your order number. If someone else is collecting it for you, reply to this email with their name.</p>
<p style="margin-top:24px"><a href="${esc(link)}" style="color:#4c2071">View your order</a></p>`,
      ),
      shopEmail || undefined,
    )
    return
  }
  const tracking = order.trackingNumber
    ? `<p style="line-height:1.6"><strong>Tracking</strong><br>${esc(order.courier || 'Courier')}: ${esc(order.trackingNumber)}${order.trackingUrl ? `<br><a href="${esc(order.trackingUrl)}" style="color:#4c2071">Track the delivery</a>` : ''}</p>`
    : ''
  await send(
    order.email,
    `Order ${order.number} is on its way`,
    layout(
      'Your order is on its way',
      `<p style="line-height:1.6">Order <strong>${esc(order.number)}</strong> has been handed to ${esc(order.courier || 'our courier')}.${order.shippingEta ? ` Expected delivery: ${esc(order.shippingEta)}.` : ''}</p>
${tracking}
<p style="margin-top:24px"><a href="${esc(link)}" style="color:#4c2071">View your order</a></p>`,
    ),
    shopEmail || undefined,
  )
}

export async function sendPaymentIssueEmail(order: Order, issue: PaymentIssue, origin: string, shopEmail: string) {
  const to = process.env.ORDER_ALERT_EMAIL || shopEmail
  if (!to) return
  await send(
    to,
    `Payment needs attention: order ${order.number}`,
    layout(
      `Payment needs attention`,
      `<p style="line-height:1.6">${esc(issue.message)}</p>
<p style="margin-top:24px"><a href="${esc(origin)}/admin/orders/${order.id}" style="color:#4c2071">Open order ${esc(order.number)} in admin</a></p>`,
    ),
  )
}

const PURPOSES: Record<MeasurementPurpose, string> = {
  bespoke: 'A bespoke outfit',
  alteration: 'Adjusting something they bought',
  keep: 'To keep on file',
}

export async function sendMeasurementAlert(
  request: {
    id: number
    reference: string
    name: string
    phone: string
    email: string
    purpose: MeasurementPurpose
    unit: Unit
    values: Record<string, number>
    notes: string
    orderNumber: string
  },
  origin: string,
  shopEmail: string,
) {
  const to = process.env.ORDER_ALERT_EMAIL || shopEmail
  if (!to) return
  const rows = MEASUREMENTS.filter((m) => request.values[m.key] !== undefined)
    .map(
      (m) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e0d3e0">${esc(m.label)}</td><td style="padding:6px 0;border-bottom:1px solid #e0d3e0;text-align:right">${esc(formatMeasure(request.values[m.key], request.unit))}</td></tr>`,
    )
    .join('')
  await send(
    to,
    `New measurements from ${request.name} (${request.reference})`,
    layout(
      `New measurements: ${request.reference}`,
      `<p style="line-height:1.6"><strong>${esc(request.name)}</strong><br>${esc(request.phone)}${request.email ? `<br>${esc(request.email)}` : ''}</p>
<p style="line-height:1.6"><strong>For</strong><br>${esc(PURPOSES[request.purpose])}${request.orderNumber ? ` (order ${esc(request.orderNumber)})` : ''}</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>
${request.notes ? `<p style="line-height:1.6;margin-top:16px"><strong>Notes</strong><br>${esc(request.notes)}</p>` : ''}
<p style="margin-top:24px"><a href="${esc(origin)}/admin/measurements/${request.id}" style="color:#4c2071">Open in admin</a></p>`,
    ),
    request.email || undefined,
  )
}
