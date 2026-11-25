'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useRef } from 'react'

export type NavItem = { href: string; label: string }

const linkClass =
  'whitespace-nowrap py-3 no-underline decoration-plum decoration-dashed decoration-[1.5px] underline-offset-[7px] hover:underline aria-[current=page]:text-plum aria-[current=page]:underline'

const navClass =
  'snap-strip relative flex items-center gap-x-6 overflow-x-auto pr-8 text-[1.0625rem] font-bold [mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)] md:gap-x-7 lg:pr-0 lg:[mask-image:none] xl:text-[1.125rem]'

function isCurrent(pathname: string, href: string) {
  return href === '/shop' ? pathname === '/shop' : pathname === href || pathname.startsWith(`${href}/`)
}

function Groups({ groups, pathname }: { groups: NavItem[][]; pathname: string | null }) {
  return groups.map((group, i) => (
    <Fragment key={i}>
      {i > 0 && <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line" />}
      {group.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname && isCurrent(pathname, item.href) ? 'page' : undefined}
          className={linkClass}
        >
          {item.label}
        </Link>
      ))}
    </Fragment>
  ))
}

/** The shop's tabs; the page you're on gets a stitched underline. Needs a Suspense boundary (see SiteNavFallback). */
export function SiteNav({ groups }: { groups: NavItem[][] }) {
  const pathname = usePathname()
  const nav = useRef<HTMLElement>(null)

  // On narrow screens the tabs scroll sideways: bring the current one into view.
  useEffect(() => {
    const strip = nav.current
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return
    strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2
  }, [pathname])

  return (
    <nav ref={nav} aria-label="Shop" className={navClass}>
      <Groups groups={groups} pathname={pathname} />
    </nav>
  )
}

/** Same tabs without the current-page mark, shown while the URL is not known yet. */
export function SiteNavFallback({ groups }: { groups: NavItem[][] }) {
  return (
    <nav aria-label="Shop" className={navClass}>
      <Groups groups={groups} pathname={null} />
    </nav>
  )
}
