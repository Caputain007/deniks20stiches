import type { Metadata } from 'next'
import { DeliveryRatesForm, PickupForm } from '@/components/admin/settings-forms'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { koboToInput } from '@/lib/money'
import { getSettings, pickupEnabled } from '@/lib/settings'
import { readShippingRates } from '@/lib/shipping'

export const metadata: Metadata = { title: 'Delivery and pickup' }

export default async function DeliveryPage() {
  await requireAdmin()
  const [rates, settings] = await Promise.all([readShippingRates(), getSettings()])
  return (
    <>
      <PageHeader title="Delivery and pickup" />
      <p className="-mt-4 mb-6 max-w-2xl text-muted">
        Customers see the fee for their address at checkout, before they pay. You book the courier yourself, then add
        the tracking details on the order.
      </p>
      <div className="max-w-3xl space-y-6">
        <Panel title="Pickup from the shop">
          <PickupForm enabled={pickupEnabled(settings)} note={settings.pickupNote} address={settings.address} />
        </Panel>
        <Panel title="Delivery fees">
          <DeliveryRatesForm
            initial={rates.map((r) => ({
              country: r.country,
              region: r.region,
              fee: koboToInput(r.feeKobo),
              eta: r.eta,
            }))}
          />
        </Panel>
      </div>
    </>
  )
}
