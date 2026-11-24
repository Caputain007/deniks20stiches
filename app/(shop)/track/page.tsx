import type { Metadata } from 'next'
import { TrackForm } from '@/components/shop/track-form'

export const metadata: Metadata = { title: 'Track an order' }

export default function TrackPage() {
  return (
    <div className="wrap max-w-xl pt-10">
      <h1 className="text-4xl sm:text-5xl">Track an order</h1>
      <p className="mt-3 text-muted">
        Enter the order number from your confirmation (it starts with DS) and the email you used at checkout.
      </p>
      <TrackForm />
    </div>
  )
}
