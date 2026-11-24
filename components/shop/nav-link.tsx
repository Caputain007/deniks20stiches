'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = { href: string; label: string }

const linkClass =
  'whitespace-nowrap py-1 no-underline decoration-plum decoration-dashed decoration-[1.5px] underline-offset-[6px] hover:underline aria-[current=page]:text-plum aria-[current=page]:underline'

function isCurrent(pathname: string, href: string) {
  return href === '/shop' ? pathname === '/shop' : pathname === href || pathname.startsWith(`${href}/`)
}

/** Nav links; the page you're on gets a stitched underline. Needs a Suspense boundary (see SiteNavFallback). */
export function SiteNav({ items, className }: { items: NavItem[]; className: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Shop" className={className}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
          className={linkClass}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/** Same links without the current-page mark, shown while the URL is not known yet. */
export function SiteNavFallback({ items, className }: { items: NavItem[]; className: string }) {
  return (
    <nav aria-label="Shop" className={className}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
