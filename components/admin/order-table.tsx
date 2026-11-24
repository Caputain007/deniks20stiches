import Link from 'next/link'
import type { schema } from '@/lib/db'
import { formatNaira } from '@/lib/money'
import { formatDate, OrderBadge } from './ui'

export function OrderTable({
  orders,
  flagged = [],
}: {
  orders: (typeof schema.orders.$inferSelect)[]
  /** Orders with a payment that needs attention. */
  flagged?: number[]
}) {
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="px-5 py-2 font-semibold sm:pl-0">Order</th>
            <th className="py-2 font-semibold">Customer</th>
            <th className="py-2 font-semibold">Placed</th>
            <th className="py-2 font-semibold">Status</th>
            <th className="py-2 pr-5 text-right font-semibold sm:pr-0">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-5 py-3 sm:pl-0">
                <Link href={`/admin/orders/${o.id}`} className="font-semibold text-plum">
                  {o.number}
                </Link>
              </td>
              <td className="py-3">
                {o.customerName}
                <span className="block text-muted">
                  {o.fulfillment === 'pickup'
                    ? 'Pickup at the shop'
                    : [o.shipCity, o.shipRegion].filter(Boolean).join(', ')}
                </span>
              </td>
              <td className="py-3 text-muted">{formatDate(o.createdAt)}</td>
              <td className="py-3">
                <OrderBadge status={o.status} fulfillment={o.fulfillment} />
                {flagged.includes(o.id) && (
                  <span className="mt-1 block text-xs font-bold text-rose">Payment needs attention</span>
                )}
              </td>
              <td className="py-3 pr-5 text-right font-semibold sm:pr-0">{formatNaira(o.totalKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
