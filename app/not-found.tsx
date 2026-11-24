import Link from 'next/link'
import { SiteFooter } from '@/components/shop/site-footer'
import { SiteHeader } from '@/components/shop/site-header'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap py-20">
        <h1 className="text-4xl sm:text-5xl">We can’t find that page</h1>
        <p className="mt-4 max-w-lg text-muted">
          The piece may have sold out or moved. Have a look through the shop, or message us on WhatsApp and we’ll help.
        </p>
        <Link href="/shop" className="btn btn-primary mt-8">
          Browse the shop
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
