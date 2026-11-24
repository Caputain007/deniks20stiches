'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/measurements', label: 'Know your measurements' },
  { href: '/measurements/send', label: 'Send us your measurements' },
]

const tabClass =
  'whitespace-nowrap border border-line bg-white px-4 py-2.5 text-[0.95rem] font-semibold no-underline hover:border-plum aria-[current=page]:border-plum aria-[current=page]:text-plum aria-[current=page]:stitched'

export function MeasurementTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Measurements" className="snap-strip -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? 'page' : undefined}
          className={tabClass}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export function MeasurementTabsFallback() {
  return (
    <nav aria-label="Measurements" className="snap-strip -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={tabClass}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
