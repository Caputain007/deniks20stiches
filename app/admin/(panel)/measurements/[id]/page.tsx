import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { setMeasurementStatus } from '@/app/actions/admin-measurements'
import { CopyButton, PrintButton } from '@/components/admin/order-forms'
import { StatusSwitch } from '@/components/admin/status-switch'
import { formatDate, PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { MEASUREMENT_STATUSES } from '@/lib/db/schema'
import { MEASUREMENT_PURPOSE_LABELS, MEASUREMENT_STATUS_LABELS } from '@/lib/measurement-labels'
import { formatMeasure, fromInches, MEASUREMENTS, toInches } from '@/lib/measurements'
import { getSettings, sizeChart, whatsappLink } from '@/lib/settings'
import { suggestSize } from '@/lib/size-chart'

export const metadata: Metadata = { title: 'Measurements' }

export default async function MeasurementDetailPage({ params }: PageProps<'/admin/measurements/[id]'>) {
  await requireAdmin()
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const db = getDb()
  const [request] = await db.select().from(schema.measurementRequests).where(eq(schema.measurementRequests.id, id))
  if (!request) notFound()
  const [settings, [order]] = await Promise.all([
    getSettings(),
    request.orderNumber
      ? db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.number, request.orderNumber))
      : Promise.resolve([]),
  ])

  const other = request.unit === 'in' ? 'cm' : 'in'
  const taken = MEASUREMENTS.filter((m) => request.values[m.key] !== undefined)
  const asText = [
    `${request.name} (${request.reference})`,
    ...taken.map((m) => `${m.label}: ${formatMeasure(request.values[m.key], request.unit)}`),
  ].join('\n')
  const fit = suggestSize(sizeChart(settings), {
    bust: request.values.bust && toInches(request.values.bust, request.unit),
    waist: request.values.waist && toInches(request.values.waist, request.unit),
    hips: request.values.hips && toInches(request.values.hips, request.unit),
  })
  const wa = whatsappLink(
    request.phone,
    `Hello ${request.name.split(' ')[0]}, this is Deniks20 Stitches about the measurements you sent (${request.reference}).`,
  )

  return (
    <>
      <PageHeader
        title={`${request.name}’s measurements`}
        back={{ href: '/admin/measurements', label: 'Measurements' }}
      >
        <PrintButton label="Print" />
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <StatusPill tone={request.status === 'new' ? 'waiting' : request.status === 'contacted' ? 'live' : 'off'}>
          {MEASUREMENT_STATUS_LABELS[request.status]}
        </StatusPill>
        <span className="text-muted">
          {request.reference}, sent {formatDate(request.createdAt)}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Measurements">
            <table className="w-full text-left">
              <thead className="text-sm text-muted">
                <tr>
                  <th className="py-2 font-semibold">Measurement</th>
                  <th className="py-2 text-right font-semibold">As sent</th>
                  <th className="py-2 text-right font-semibold">In {other === 'in' ? 'inches' : 'cm'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                {MEASUREMENTS.map((m) => {
                  const value = request.values[m.key]
                  return (
                    <tr key={m.key}>
                      <th scope="row" className="py-2 font-normal">
                        {m.label}
                      </th>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {value !== undefined ? (
                          formatMeasure(value, request.unit)
                        ) : (
                          <span className="font-normal text-muted">Not given</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">
                        {value !== undefined
                          ? formatMeasure(fromInches(toInches(value, request.unit), other), other)
                          : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {fit.kind === 'size' && (
              <p className="mt-4 text-sm">
                Closest ready-to-wear size on your chart: <strong>{fit.size}</strong>
              </p>
            )}
            {fit.kind === 'too-big' && <p className="mt-4 text-sm">Bigger than your largest ready-to-wear size.</p>}
            <div className="mt-4 no-print">
              <CopyButton text={asText} label="Copy measurements" />
            </div>
          </Panel>
          {request.notes && (
            <Panel title="Customer’s notes">
              <p className="whitespace-pre-line">{request.notes}</p>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-semibold">{request.name}</p>
            <p className="break-words">
              <a href={`tel:${request.phone.replace(/[^\d+]/g, '')}`}>{request.phone}</a>
              {request.email && (
                <>
                  <br />
                  <a href={`mailto:${request.email}`}>{request.email}</a>
                </>
              )}
            </p>
            <p className="mt-3 text-sm">
              <span className="text-muted">For: </span>
              {MEASUREMENT_PURPOSE_LABELS[request.purpose]}
            </p>
            {request.orderNumber && (
              <p className="text-sm">
                <span className="text-muted">Order: </span>
                {order ? (
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold">
                    {request.orderNumber}
                  </Link>
                ) : (
                  `${request.orderNumber} (not found)`
                )}
              </p>
            )}
            {wa && (
              <a href={wa} className="btn btn-secondary btn-sm mt-4 no-print" target="_blank" rel="noopener">
                WhatsApp customer
              </a>
            )}
          </Panel>
          <Panel title="Status" className="no-print">
            <StatusSwitch
              label="Status"
              value={request.status}
              options={MEASUREMENT_STATUSES.map((status) => ({
                value: status,
                label: MEASUREMENT_STATUS_LABELS[status],
              }))}
              action={setMeasurementStatus.bind(null, request.id)}
            />
          </Panel>
        </div>
      </div>
    </>
  )
}
