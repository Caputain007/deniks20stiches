/* eslint-disable @next/next/no-img-element -- thumbnails are already small */
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { Suspense } from 'react'
import { ClearBagAfterPayment, PayNowButton } from '@/components/shop/order-actions'
import { countryName } from '@/lib/geo'
import { formatNaira } from '@/lib/money'
import { getOrderWithItems } from '@/lib/orders'
import { getSettings, mapsLink, whatsappLink } from '@/lib/settings'

export const metadata: Metadata = { title: 'Your order', robots: { index: false } }

export default function OrderPage(props: PageProps<'/order/[number]'>) {
  return (
    <div className="wrap pt-10">
      <Suspense fallback={<div className="h-96 animate-pulse bg-blush" aria-label="Loading your order" />}>
        <OrderView {...props} />
      </Suspense>
    </div>
  )
}

function sameKey(given: string, actual: string) {
  const a = Buffer.from(given)
  const b = Buffer.from(actual)
  return a.length === b.length && timingSafeEqual(a, b)
}

const STEPS = {
  delivery: ['Paid', 'Shipped', 'Delivered'],
  pickup: ['Paid', 'Ready to collect', 'Collected'],
} as const

const HEADLINES = {
  delivery: {
    pending: 'Waiting for payment',
    paid: 'Thank you, your order is confirmed',
    shipped: 'Your order is on its way',
    delivered: 'Your order has been delivered',
    cancelled: 'This order was cancelled',
  },
  pickup: {
    pending: 'Waiting for payment',
    paid: 'Thank you, your order is confirmed',
    shipped: 'Your order is ready to collect',
    delivered: 'You’ve collected your order',
    cancelled: 'This order was cancelled',
  },
} as const

async function OrderView({ params, searchParams }: PageProps<'/order/[number]'>) {
  const [{ number }, query] = await Promise.all([params, searchParams])
  await connection() // orders are personal: render them per request only
  const key = typeof query.key === 'string' ? query.key : ''
  const order = await getOrderWithItems({ number: decodeURIComponent(number).toUpperCase() })

  if (!order || !sameKey(key, order.accessKey)) {
    return (
      <div className="max-w-xl">
        <h1 className="text-4xl">Order not found</h1>
        <p className="mt-3 text-muted">
          The link may be incomplete. Find your order with its number and your email instead.
        </p>
        <Link href="/track" className="btn btn-primary mt-6">
          Track an order
        </Link>
      </div>
    )
  }

  const settings = await getSettings()
  const help = whatsappLink(
    settings.whatsapp,
    `Hello Deniks20 Stitches, I have a question about order ${order.number}.`,
  )
  const maps = mapsLink(settings.address)
  const reached = order.status === 'delivered' ? 3 : order.status === 'shipped' ? 2 : order.status === 'paid' ? 1 : 0
  const justPaid = query.paid === '1' && order.status !== 'pending' && order.status !== 'cancelled'

  return (
    <div>
      {justPaid && <ClearBagAfterPayment />}
      <p className="text-muted">Order {order.number}</p>
      <h1 className="mt-1 text-4xl sm:text-5xl">{HEADLINES[order.fulfillment][order.status]}</h1>

      {order.status === 'pending' && (
        <div className="mt-6 max-w-xl space-y-4">
          <p>
            We haven’t received payment for this order yet. If you’ve just paid, it can take a minute to confirm.
            Refresh this page in a moment.
          </p>
          <PayNowButton
            number={order.number}
            accessKey={order.accessKey}
            label={`Pay ${formatNaira(order.totalKobo)}`}
          />
        </div>
      )}

      {order.status !== 'pending' && order.status !== 'cancelled' && (
        <ol className="mt-8 grid max-w-xl grid-cols-3 gap-2" aria-label="Order progress">
          {STEPS[order.fulfillment].map((label, i) => (
            <li key={label} className="text-sm">
              <span className={`block h-1.5 ${i < reached ? 'bg-plum' : 'bg-line'}`} />
              <span className={`mt-2 block ${i < reached ? 'font-semibold text-plum' : 'text-muted'}`}>
                {label}
                {i < reached && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {order.fulfillment === 'pickup' && order.status === 'shipped' && settings.address && (
        <div className="mt-8 max-w-xl border border-dashed border-plum bg-white px-5 py-4">
          <p className="font-semibold">Collect from</p>
          <p className="mt-1">{settings.address}</p>
          {settings.hours && <p className="mt-1 text-sm text-muted">Open {settings.hours}</p>}
          <p className="mt-1 text-sm text-muted">Bring your order number, {order.number}.</p>
        </div>
      )}

      {order.fulfillment === 'delivery' &&
        (order.status === 'shipped' || order.status === 'delivered') &&
        (order.courier || order.trackingNumber) && (
          <div className="mt-8 max-w-xl border border-dashed border-plum bg-white px-5 py-4">
            <p className="font-semibold">Tracking</p>
            <p className="mt-1">
              {order.courier || 'Courier'}
              {order.trackingNumber && `: ${order.trackingNumber}`}
            </p>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                className="mt-2 inline-block font-semibold text-plum"
                rel="noopener noreferrer"
              >
                Track the delivery
              </a>
            )}
          </div>
        )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="text-2xl">
            Items
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="h-24 w-[4.5rem] shrink-0 bg-blush">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-sm text-muted">
                    Size {item.variantLabel}, qty {item.quantity}
                  </p>
                </div>
                <p>{formatNaira(item.unitPriceKobo * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 max-w-sm space-y-1 sm:ml-auto">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatNaira(order.subtotalKobo)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</dt>
              <dd>{order.fulfillment === 'pickup' ? 'Free' : formatNaira(order.shippingKobo)}</dd>
            </div>
            {order.discountKobo > 0 && (
              <div className="flex justify-between text-leaf">
                <dt>Coupon {order.couponCode}</dt>
                <dd>−{formatNaira(order.discountKobo)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatNaira(order.totalKobo)}</dd>
            </div>
          </dl>
        </section>

        <aside className="space-y-6 self-start bg-white p-6 ring-1 ring-line">
          {order.fulfillment === 'pickup' ? (
            <div>
              <h2 className="font-sans text-sm font-bold">Collecting from</h2>
              <p className="mt-2 leading-relaxed">{settings.address || 'Our shop'}</p>
              {settings.pickupNote && order.status === 'paid' && (
                <p className="mt-2 text-sm text-muted">{settings.pickupNote}</p>
              )}
              {maps && (
                <a
                  href={maps}
                  className="mt-2 inline-block text-sm font-semibold text-plum"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          ) : (
            <div>
              <h2 className="font-sans text-sm font-bold">Delivering to</h2>
              <address className="mt-2 not-italic leading-relaxed">
                {order.customerName}
                <br />
                {order.shipAddress1}
                {order.shipAddress2 && (
                  <>
                    <br />
                    {order.shipAddress2}
                  </>
                )}
                <br />
                {[order.shipCity, order.shipRegion, order.shipPostcode].filter(Boolean).join(', ')}
                <br />
                {countryName(order.shipCountry)}
              </address>
              {order.shippingEta && order.status === 'paid' && (
                <p className="mt-2 text-sm text-muted">Usually arrives in {order.shippingEta} once shipped.</p>
              )}
            </div>
          )}
          <div>
            <h2 className="font-sans text-sm font-bold">Contact</h2>
            <p className="mt-2 break-words">
              {order.email}
              <br />
              {order.phone}
            </p>
          </div>
          {help && (
            <a href={help} className="btn btn-secondary w-full">
              Ask about this order
            </a>
          )}
        </aside>
      </div>
    </div>
  )
}
