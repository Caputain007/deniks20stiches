import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/shop/checkout-form'
import { paymentsConfigured } from '@/lib/paystack'
import { getSettings, mapsLink, pickupEnabled, whatsappLink } from '@/lib/settings'
import { getShippingRates } from '@/lib/shipping'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }

export default async function CheckoutPage() {
  const [rates, settings] = await Promise.all([getShippingRates(), getSettings()])
  return (
    <div className="wrap pt-10">
      <h1 className="text-4xl sm:text-5xl">Checkout</h1>
      <CheckoutForm
        rates={rates}
        checkoutNote={settings.checkoutNote}
        whatsapp={whatsappLink(settings.whatsapp, "Hello Deniks20 Stitches, I'd like to place an order.")}
        paymentsReady={paymentsConfigured()}
        pickup={
          pickupEnabled(settings)
            ? { address: settings.address, note: settings.pickupNote, mapsUrl: mapsLink(settings.address) }
            : null
        }
      />
    </div>
  )
}
