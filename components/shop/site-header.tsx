import Link from 'next/link'
import { Suspense } from 'react'
import { getCatalog } from '@/lib/catalog'
import { getSettings } from '@/lib/settings'
import { BagLink } from './bag-link'
import { SiteNav, SiteNavFallback, type NavItem } from './nav-link'
import { Wordmark } from './wordmark'

export async function SiteHeader() {
  const [{ categories }, settings] = await Promise.all([getCatalog(), getSettings()])
  const items: NavItem[] = [
    { href: '/shop', label: 'Shop all' },
    ...categories.filter((c) => c.productCount > 0).map((c) => ({ href: `/shop/${c.slug}`, label: c.name })),
  ]
  const desktop = 'hidden items-center gap-7 text-[0.95rem] lg:flex'
  const mobile = 'snap-strip wrap flex gap-6 overflow-x-auto pb-3 text-[0.95rem] lg:hidden'

  return (
    <header className="bg-mist">
      {settings.announcement && (
        <p className="bg-plum px-4 py-2 text-center text-sm text-white">{settings.announcement}</p>
      )}
      <div className="wrap flex h-[4.5rem] items-center justify-between gap-6 md:h-20">
        <Link href="/" className="no-underline" aria-label="Deniks20 Stitches home">
          <Wordmark />
        </Link>
        <Suspense fallback={<SiteNavFallback items={items} className={desktop} />}>
          <SiteNav items={items} className={desktop} />
        </Suspense>
        <div className="flex items-center gap-5">
          <Link href="/track" className="hidden text-[0.95rem] no-underline hover:underline sm:inline">
            Track order
          </Link>
          <BagLink />
        </div>
      </div>
      {items.length > 1 && (
        <Suspense fallback={<SiteNavFallback items={items} className={mobile} />}>
          <SiteNav items={items} className={mobile} />
        </Suspense>
      )}
      <div className="seam" />
    </header>
  )
}
