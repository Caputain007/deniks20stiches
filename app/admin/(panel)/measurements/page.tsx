import type { Metadata } from 'next'
import Link from 'next/link'
import { count, desc, eq } from 'drizzle-orm'
import { SizeChartForm } from '@/components/admin/size-chart-form'
import { formatDate, PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { MEASUREMENT_STATUSES, type MeasurementStatus } from '@/lib/db/schema'
import { MEASUREMENT_PURPOSE_LABELS, MEASUREMENT_STATUS_LABELS } from '@/lib/measurement-labels'
import { getSettings, sizeChart } from '@/lib/settings'

export const metadata: Metadata = { title: 'Measurements' }

const TABS: { status: MeasurementStatus | 'all'; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'done', label: 'Done' },
  { status: 'all', label: 'All' },
]

export default async function MeasurementsAdminPage({ searchParams }: PageProps<'/admin/measurements'>) {
  await requireAdmin()
  const query = await searchParams
  const status =
    typeof query.status === 'string' && [...MEASUREMENT_STATUSES, 'all'].includes(query.status) ? query.status : 'new'
  const db = getDb()
  const [requests, [{ waiting }], settings] = await Promise.all([
    db
      .select()
      .from(schema.measurementRequests)
      .where(status === 'all' ? undefined : eq(schema.measurementRequests.status, status as MeasurementStatus))
      .orderBy(desc(schema.measurementRequests.createdAt))
      .limit(200),
    db
      .select({ waiting: count() })
      .from(schema.measurementRequests)
      .where(eq(schema.measurementRequests.status, 'new')),
    getSettings(),
  ])

  return (
    <>
      <PageHeader title="Measurements" />
      <p className="-mt-4 mb-6 max-w-2xl text-muted">
        Measurements customers send from the website. Message them on WhatsApp to agree the style and price, then mark
        each one as contacted or done.
      </p>
      <nav aria-label="Measurement status" className="snap-strip mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/measurements?status=${tab.status}`}
            aria-current={status === tab.status ? 'page' : undefined}
            className="whitespace-nowrap border border-line bg-white px-3 py-2 text-sm font-semibold no-underline aria-[current=page]:border-plum aria-[current=page]:text-plum aria-[current=page]:stitched"
          >
            {tab.label}
            {tab.status === 'new' && waiting > 0 ? ` (${waiting})` : ''}
          </Link>
        ))}
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_28rem]">
        <Panel>
          {requests.length === 0 ? (
            <p className="text-muted">
              {status === 'new' ? 'Nothing new. Measurements sent from the website appear here.' : 'Nothing here yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/admin/measurements/${r.id}`} className="font-semibold text-plum">
                      {r.name}
                    </Link>{' '}
                    <span className="text-sm text-muted">{r.reference}</span>
                    <p className="text-sm text-muted">
                      {MEASUREMENT_PURPOSE_LABELS[r.purpose]}, sent {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <StatusPill tone={r.status === 'new' ? 'waiting' : r.status === 'contacted' ? 'live' : 'off'}>
                    {MEASUREMENT_STATUS_LABELS[r.status]}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Size chart">
          <SizeChartForm initial={sizeChart(settings)} />
        </Panel>
      </div>
    </>
  )
}
