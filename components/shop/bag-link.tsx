'use client'

import Link from 'next/link'
import { useBag } from './bag-store'

export function BagLink() {
  const { count } = useBag()
  return (
    <Link
      href="/bag"
      className="relative inline-flex items-center gap-2 py-2 text-[0.95rem] font-semibold no-underline hover:text-plum"
      aria-label={count ? `Bag, ${count} item${count === 1 ? '' : 's'}` : 'Bag, empty'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" />
        <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
      </svg>
      <span>Bag</span>
      {count > 0 && (
        <span className="min-w-6 rounded-full bg-plum px-1.5 text-center text-xs leading-6 text-white">{count}</span>
      )}
    </Link>
  )
}
