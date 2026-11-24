/* eslint-disable @next/next/no-img-element -- thumbnails are already small */
import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { markShipped, resolvePaymentIssue, saveOrderNotes, setOrderStatus } from '@/app/actions/admin-shop'
import { ActionButton } from '@/components/admin/action-button'
import { CopyButton, NotesForm, PrintButton, ShipForm } from '@/components/admin/order-forms'
import { formatDate, Notice, OrderBadge, PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { emailConfigured } from '@/lib/email'
import { countryName } from '@/lib/geo'
import { formatNaira } from '@/lib/money'
import { getOrderWithItems } from '@/lib/orders'
import { whatsappLink } from '@/lib/settings'

export const metadata: Metadata = { title: 'Order' }

export default async function OrderDetailPage({ params }: PageProps<'/admin/orders/[id]'>) {
  await requireAdmin()
  const { id } = await params
  const orderId = Number(id)
  if (!Number.isInteger(orderId)) notFound()
  const order = await getOrderWithItems({ id: orderId })
  if (!order) notFound()
  const issues = await getDb()
    .select()
    .from(schema.paymentIssues)
    .where(eq(schema.paymentIssues.orderId, order.id))
    .orderBy(desc(schema.paymentIssues.createdAt))
  const events = await getDb()
    .select()
    .from(schema.paymentEvents)
    .where(eq(schema.paymentEvents.reference, order.paymentReference ?? '-'))
    .orderBy(desc(schema.paymentEvents.createdAt))
    .limit(5)

  const addressLines = [
    order.customerName,
    order.shipAddress1,
    order.shipAddress2,
    [order.shipCity, order.shipRegion, order.shipPostcode].filter(Boolean).join(', '),
    countryName(order.shipCountry),
    order.phone,
  ].filter(Boolean)
  const customerWhatsapp = whatsappLink(
    order.phone,
    `Hello ${order.customerName}, this is Deniks20 Stitches about your order ${order.number}.`,
  )
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0)

  return (
    <>
      <PageHeader title={`Order ${order.number}`} back={{ href: '/admin/orders', label: 'Orders' }}>
        <PrintButton />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <OrderBadge status={order.status} />
        <span className="text-muted">Placed {formatDate(order.createdAt)}</span>
        {order.paidAt && <span className="text-muted">Paid {formatDate(order.paidAt)}</span>}
        {order.shippedAt && <span className="text-muted">Shipped {formatDate(order.shippedAt)}</span>}
        {order.deliveredAt && <span className="text-muted">Delivered {formatDate(order.deliveredAt)}</span>}
      </div>

      <div className="space-y-4">
        {issues
          .filter((issue) => !issue.resolvedAt)
          .map((issue) => (
            <Notice key={issue.id} tone="error">
              <p className="font-semibold">Payment needs attention</p>
              <p className="mt-1 text-ink">{issue.message}</p>
              <div className="mt-3">
                <ActionButton action={resolvePaymentIssue.bind(null, issue.id)}>Mark as resolved</ActionButton>
              </div>
            </Notice>
          ))}
        {order.status === 'cancelled' && order.paidAt && (
          <Notice tone="warning">
            This order was paid, then cancelled, and its items went back into stock. If you haven’t refunded the
            customer yet, do it from your Paystack dashboard (Transactions → find {order.paymentReference} → Refund).
          </Notice>
        )}
        {order.stockIssue && (
          <Notice tone="warning">
            This order was paid when there wasn’t enough stock left for every item. Check you can fulfil it, or contact
            the customer and refund in Paystack.
          </Notice>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title={`Items (${itemCount})`}>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-3">
                  <div className="h-20 w-16 shrink-0 bg-blush">
                    {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    {item.productId ? (
                      <Link
                        href={`/admin/products/${item.productId}`}
                        className="font-semibold text-ink no-underline hover:text-plum"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.productName}</p>
                    )}
                    <p className="text-sm">
                      Size <strong>{item.variantLabel}</strong>, qty <strong>{item.quantity}</strong>
                    </p>
                    <p className="text-sm text-muted">{formatNaira(item.unitPriceKobo)} each</p>
                  </div>
                  <p className="font-semibold">{formatNaira(item.unitPriceKobo * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatNaira(order.subtotalKobo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Delivery{order.shippingEta ? ` (${order.shippingEta})` : ''}</dt>
                <dd>{formatNaira(order.shippingKobo)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{formatNaira(order.totalKobo)}</dd>
              </div>
            </dl>
          </Panel>

          <div className="no-print">
            {(order.status === 'paid' || order.status === 'shipped') && (
              <Panel title={order.status === 'paid' ? 'Ship this order' : 'Tracking'}>
                <ShipForm
                  action={markShipped.bind(null, order.id)}
                  defaults={{
                    courier: order.courier,
                    trackingNumber: order.trackingNumber,
                    trackingUrl: order.trackingUrl,
                  }}
                  alreadyShipped={order.status === 'shipped'}
                  canEmail={emailConfigured()}
                />
              </Panel>
            )}
          </div>

          <Panel title="Private notes" className="no-print">
            <NotesForm action={saveOrderNotes.bind(null, order.id)} defaultValue={order.adminNotes} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Deliver to">
            <address className="not-italic leading-relaxed">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            {order.deliveryNote && (
              <p className="mt-3 border-l-2 border-plum pl-3 text-sm">
                <span className="font-semibold">Customer note:</span> {order.deliveryNote}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton text={addressLines.join('\n')} label="Copy address" />
            </div>
          </Panel>

          <Panel title="Customer">
            <p className="break-words">
              <a href={`mailto:${order.email}`}>{order.email}</a>
              <br />
              <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>{order.phone}</a>
            </p>
            {customerWhatsapp && (
              <a
                href={customerWhatsapp}
                className="btn btn-secondary btn-sm mt-4 no-print"
                target="_blank"
                rel="noopener"
              >
                WhatsApp customer
              </a>
            )}
          </Panel>

          <Panel title="Payment" className="no-print">
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="inline text-muted">Paystack reference: </dt>
                <dd className="inline break-all">{order.paymentReference ?? 'Not started'}</dd>
              </div>
              {order.paymentChannel && (
                <div>
                  <dt className="inline text-muted">Paid with: </dt>
                  <dd className="inline">{order.paymentChannel.replace(/_/g, ' ')}</dd>
                </div>
              )}
              {issues
                .filter((issue) => issue.resolvedAt)
                .map((issue) => (
                  <div key={issue.id} className="text-muted">
                    Resolved {formatDate(issue.resolvedAt)}: {issue.message}
                  </div>
                ))}
              {events.length > 0 && (
                <div>
                  <dt className="inline text-muted">Last Paystack event: </dt>
                  <dd className="inline">
                    {events[0].event}, {formatDate(events[0].createdAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title="Change status" className="no-print">
            <div className="flex flex-col gap-3">
              {(order.status === 'shipped' || order.status === 'paid') && (
                <ActionButton
                  action={setOrderStatus.bind(null, order.id, 'delivered')}
                  className="btn btn-quiet btn-sm"
                >
                  Mark as delivered
                </ActionButton>
              )}
              {order.status === 'delivered' && (
                <ActionButton action={setOrderStatus.bind(null, order.id, 'paid')}>Undo delivered</ActionButton>
              )}
              {(order.status === 'pending' || order.status === 'paid') && (
                <ActionButton
                  action={setOrderStatus.bind(null, order.id, 'cancelled')}
                  confirm={order.status === 'paid' ? 'Cancel and put items back in stock?' : 'Cancel this order?'}
                  className="btn btn-danger btn-sm"
                >
                  Cancel order
                </ActionButton>
              )}
              {order.status === 'cancelled' && <p className="text-sm text-muted">This order is cancelled.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
