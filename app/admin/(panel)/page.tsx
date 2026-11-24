import Link from 'next/link'
import { OrderTable } from '@/components/admin/order-table'
import { PageHeader, Panel } from '@/components/admin/ui'
import { getDashboardStats } from '@/lib/admin-queries'
import { requireAdmin } from '@/lib/auth'
import { emailConfigured } from '@/lib/email'
import { paymentsConfigured } from '@/lib/paystack'
import { storageMode } from '@/lib/storage'

export default async function DashboardPage() {
  const admin = await requireAdmin()
  const { toShip, awaiting, live, drafts, rates, paidWeek, recent } = await getDashboardStats()

  const setup = [
    {
      done: paymentsConfigured(),
      label: 'Online payments (Paystack)',
      todo: 'Add PAYSTACK_SECRET_KEY in Vercel → Settings → Environment Variables, then redeploy.',
    },
    {
      done: storageMode() !== 'none',
      label: 'Photo storage',
      todo: 'In Vercel → Storage, create a public Blob store and connect it to this project with a read-write token, then redeploy.',
    },
    {
      done: rates > 0,
      label: 'Delivery fees',
      todo: 'Set your delivery fees so customers can check out.',
      href: '/admin/delivery',
    },
    {
      done: live > 0,
      label: 'First product live',
      todo: 'Add a product with at least 4 photos and publish it.',
      href: '/admin/products/new',
    },
    {
      done: emailConfigured(),
      label: 'Order emails (optional)',
      todo: 'Add RESEND_API_KEY and EMAIL_FROM to email customers when they pay and when you ship.',
    },
  ]
  const pendingSetup = setup.filter((s) => !s.done)

  return (
    <>
      <PageHeader title={`Hello${admin.name ? `, ${admin.name}` : ''}`}>
        <Link href="/admin/products/new" className="btn btn-primary">
          Add product
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat href="/admin/orders?status=paid" value={toShip} label="Orders to ship" strong={toShip > 0} />
        <Stat href="/admin/orders?status=all" value={paidWeek} label="Paid in the last 7 days" />
        <Stat href="/admin/orders?status=pending" value={awaiting} label="Awaiting payment (7 days)" />
        <Stat href="/admin/products" value={live} label={`Live products${drafts ? `, ${drafts} in drafts` : ''}`} />
      </div>

      {pendingSetup.length > 0 && (
        <Panel title="Finish setting up" className="mt-8">
          <ul className="space-y-3">
            {setup.map((item) => (
              <li key={item.label} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 border ${item.done ? 'border-leaf bg-leaf' : 'border-dashed border-plum'}`}
                />
                <div>
                  <p className="font-semibold">
                    {item.label}
                    <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
                  </p>
                  {!item.done &&
                    (item.href ? (
                      <Link href={item.href} className="text-sm text-plum">
                        {item.todo}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted">{item.todo}</p>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Latest orders" className="mt-8">
        {recent.length === 0 ? (
          <p className="text-muted">No orders yet. They’ll appear here as soon as someone checks out.</p>
        ) : (
          <OrderTable orders={recent} />
        )}
        <Link href="/admin/orders?status=all" className="mt-4 inline-block text-sm font-semibold text-plum">
          All orders
        </Link>
      </Panel>
    </>
  )
}

function Stat({ href, value, label, strong }: { href: string; value: number; label: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={`block p-5 no-underline ring-1 ${strong ? 'bg-plum text-white ring-plum' : 'bg-white ring-line hover:ring-plum'}`}
    >
      <p className="font-display text-4xl">{value}</p>
      <p className={`mt-1 text-sm ${strong ? 'text-white/85' : 'text-muted'}`}>{label}</p>
    </Link>
  )
}
