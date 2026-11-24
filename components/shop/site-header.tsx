import Link from 'next/link'
import { Suspense } from 'react'
import { getLiveBanners, type LiveBanner } from '@/lib/banners'
import { getCatalog } from '@/lib/catalog'
import { BagLink } from './bag-link'
import { BannerLink } from './banner-link'
import { SiteNav, SiteNavFallback, type NavItem } from './nav-link'
import { Wordmark } from './wordmark'

function AnnouncementBar({ banner }: { banner: LiveBanner }) {
  return (
    <p className="bg-plum px-4 py-2 text-center text-sm text-white">
      {banner.title}
      {banner.linkUrl && (
        <>
          {' '}
          <BannerLink href={banner.linkUrl} className="whitespace-nowrap font-semibold text-white underline">
            {banner.linkLabel || 'See more'}
          </BannerLink>
        </>
      )}
    </p>
  )
}

export async function SiteHeader() {
  const [{ categories, products }, banners] = await Promise.all([getCatalog(), getLiveBanners()])
  const shop: NavItem[] = [
    { href: '/shop', label: 'Shop all' },
    ...categories.map((c) => ({ href: `/shop/${c.slug}`, label: c.name })),
    ...(products.some((p) => p.compareAtKobo) ? [{ href: '/sale', label: 'Sale' }] : []),
  ]
  const tailoring: NavItem[] = [
    { href: '/bespoke', label: 'Bespoke' },
    { href: '/measurements', label: 'Measurements' },
  ]
  const groups = [shop, tailoring]

  return (
    <header className="bg-mist">
      {banners.bar && <AnnouncementBar banner={banners.bar} />}
      <div className="wrap flex h-16 items-center justify-between gap-6 md:h-20">
        <Link href="/" className="no-underline" aria-label="Deniks20 Stitches home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/track" className="hidden text-[0.95rem] no-underline hover:underline sm:inline">
            Track order
          </Link>
          <BagLink />
        </div>
      </div>
      <div className="wrap">
        <Suspense fallback={<SiteNavFallback groups={groups} />}>
          <SiteNav groups={groups} />
        </Suspense>
      </div>
      <div className="seam" />
    </header>
  )
}
