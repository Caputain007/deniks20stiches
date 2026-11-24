import type { Metadata } from 'next'
import { BagView } from '@/components/shop/bag-view'

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } }

export default function BagPage() {
  return (
    <div className="wrap pt-10">
      <h1 className="text-4xl sm:text-5xl">Your bag</h1>
      <BagView />
    </div>
  )
}
