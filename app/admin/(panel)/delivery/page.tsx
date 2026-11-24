import type { Metadata } from 'next'
import { DeliveryRatesForm } from '@/components/admin/settings-forms'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { koboToInput } from '@/lib/money'
import { readShippingRates } from '@/lib/shipping'

export const metadata: Metadata = { title: 'Delivery fees' }

export default async function DeliveryPage() {
  await requireAdmin()
  const rates = await readShippingRates()
  return (
    <>
      <PageHeader title="Delivery fees" />
      <p className="-mt-4 mb-6 max-w-2xl text-muted">
        Customers see the fee for their address at checkout, before they pay. You book the courier yourself, then add
        the tracking details on the order.
      </p>
      <Panel className="max-w-3xl">
        <DeliveryRatesForm
          initial={rates.map((r) => ({
            country: r.country,
            region: r.region,
            fee: koboToInput(r.feeKobo),
            eta: r.eta,
          }))}
        />
      </Panel>
    </>
  )
}
