import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { OrderTable } from '@/components/admin/order-table'
import { PageHeader, Panel } from '@/components/admin/ui'
import { ordersWithOpenIssues } from '@/lib/admin-queries'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/db/schema'

export const metadata: Metadata = { title: 'Orders' }

const TABS: { status: OrderStatus | 'all' | 'issues'; label: string }[] = [
  { status: 'paid', label: 'To ship' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'pending', label: 'Awaiting payment' },
  { status: 'cancelled', label: 'Cancelled' },
  { status: 'all', label: 'All' },
  { status: 'issues', label: 'Payment issues' },
]

export default async function OrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  await requireAdmin()
  const query = await searchParams
  const status =
    typeof query.status === 'string' && [...ORDER_STATUSES, 'all', 'issues'].includes(query.status)
      ? query.status
      : 'paid'
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : ''

  const flagged = await ordersWithOpenIssues()
  const conditions: SQL[] = []
  if (status === 'issues') conditions.push(inArray(schema.orders.id, flagged.length ? flagged : [-1]))
  else if (status !== 'all') conditions.push(eq(schema.orders.status, status as OrderStatus))
  if (q) {
    const term = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    conditions.push(
      or(
        ilike(schema.orders.number, term),
        ilike(schema.orders.email, term),
        ilike(schema.orders.customerName, term),
        ilike(schema.orders.phone, term),
      )!,
    )
  }
  const orders = await getDb()
    .select()
    .from(schema.orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(200)

  return (
    <>
      <PageHeader title="Orders" />
      <nav aria-label="Order status" className="snap-strip mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/orders?status=${tab.status}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            aria-current={status === tab.status ? 'page' : undefined}
            className="whitespace-nowrap border border-line bg-white px-3 py-2 text-sm font-semibold no-underline aria-[current=page]:border-plum aria-[current=page]:text-plum aria-[current=page]:stitched"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <form className="mb-6 flex max-w-md gap-2" action="/admin/orders">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="order-search" className="sr-only">
          Search orders
        </label>
        <input
          id="order-search"
          name="q"
          defaultValue={q}
          placeholder="Order number, name, email or phone"
          className="field"
        />
        <button type="submit" className="btn btn-quiet">
          Search
        </button>
      </form>
      <Panel>
        {orders.length === 0 ? (
          <p className="text-muted">{q ? `No orders match "${q}".` : 'No orders here yet.'}</p>
        ) : (
          <OrderTable orders={orders} flagged={flagged} />
        )}
      </Panel>
    </>
  )
}
