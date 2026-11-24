'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/delivery', label: 'Delivery fees' },
  { href: '/admin/settings', label: 'Settings' },
]

const linkClass =
  'whitespace-nowrap py-3 text-[0.95rem] font-semibold no-underline text-muted hover:text-plum aria-[current=page]:text-plum aria-[current=page]:underline aria-[current=page]:decoration-dashed aria-[current=page]:decoration-[1.5px] aria-[current=page]:underline-offset-[8px]'

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="snap-strip flex gap-6 overflow-x-auto">
      {ADMIN_LINKS.map((link) => {
        const current = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href)
        return (
          <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined} className={linkClass}>
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminNavFallback() {
  return (
    <nav aria-label="Admin" className="snap-strip flex gap-6 overflow-x-auto">
      {ADMIN_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
