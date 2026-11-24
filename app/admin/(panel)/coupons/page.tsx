import type { Metadata } from 'next'
import { deleteCoupon, setCouponActive } from '@/app/actions/admin-promos'
import { ActionButton } from '@/components/admin/action-button'
import { CopyButton } from '@/components/admin/order-forms'
import { CouponForm } from '@/components/admin/promo-forms'
import { formatDate, PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { couponRows } from '@/lib/admin-queries'
import { requireAdmin } from '@/lib/auth'
import { describeCoupon } from '@/lib/coupon-rules'
import { formatNaira } from '@/lib/money'

export const metadata: Metadata = { title: 'Coupons' }

export default async function CouponsPage() {
  await requireAdmin()
  const coupons = await couponRows()

  return (
    <>
      <PageHeader title="Coupons" />
      <p className="-mt-4 mb-8 max-w-2xl text-muted">
        Customers type a code at checkout to get money off. The shop checks every code again when the order is placed,
        so a code that has expired or run out can’t be used.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[24rem_1fr]">
        <Panel title="New coupon">
          <CouponForm />
        </Panel>
        <Panel title={`Your coupons${coupons.length ? ` (${coupons.length})` : ''}`}>
          {coupons.length === 0 ? (
            <p className="text-muted">No coupons yet. Create one to share with your customers.</p>
          ) : (
            <ul className="divide-y divide-line">
              {coupons.map((c) => {
                const conditions = [
                  c.minSubtotalKobo > 0 && `Orders of ${formatNaira(c.minSubtotalKobo)} or more`,
                  c.oncePerCustomer && 'Once per customer',
                  c.maxUses !== null && `${c.maxUses} use${c.maxUses === 1 ? '' : 's'} in total`,
                  c.startsAt && `Starts ${formatDate(c.startsAt)}`,
                  c.endsAt && `Ends ${formatDate(c.endsAt)}`,
                ].filter(Boolean)
                const awaiting = `${c.waiting} order${c.waiting === 1 ? '' : 's'} awaiting payment`
                const usage =
                  c.paid > 0
                    ? `Used on ${c.paid} paid order${c.paid === 1 ? '' : 's'}${c.waiting > 0 ? `, plus ${awaiting}` : ''}${c.discountGivenKobo > 0 ? `. ${formatNaira(c.discountGivenKobo)} given off in total` : ''}.`
                    : c.waiting > 0
                      ? `${awaiting[0].toUpperCase()}${awaiting.slice(1)}.`
                      : 'Not used yet.'
                return (
                  <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-2xl tracking-wide">{c.code}</p>
                      <StatusPill tone={c.status.tone}>{c.status.label}</StatusPill>
                      <CopyButton text={c.code} label="Copy code" />
                    </div>
                    <p className="mt-1 font-semibold">{describeCoupon(c)}</p>
                    {conditions.length > 0 && <p className="text-sm text-muted">{conditions.join('. ')}.</p>}
                    <p className="mt-1 text-sm">{usage}</p>
                    {c.note && <p className="mt-1 text-sm text-muted">Note: {c.note}</p>}
                    <div className="mt-3 flex flex-wrap gap-3">
                      <ActionButton action={setCouponActive.bind(null, c.id, !c.active)}>
                        {c.active ? 'Turn off' : 'Turn on'}
                      </ActionButton>
                      {c.paid + c.waiting === 0 && (
                        <ActionButton
                          action={deleteCoupon.bind(null, c.id)}
                          confirm={`Delete ${c.code}?`}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </ActionButton>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
            To change what a code gives, turn it off and create a new one, so orders already placed keep their saving.
            An unpaid order holds its use of a code for 3 days, then lets it go.
          </p>
        </Panel>
      </div>
    </>
  )
}
