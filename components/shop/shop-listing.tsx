import Link from 'next/link'
import type { CatalogProduct } from '@/lib/catalog'
import { ProductGrid } from './product-card'

export const SORTS = {
  new: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
} as const
export type SortKey = keyof typeof SORTS

export function sortProducts(products: CatalogProduct[], sort: string | string[] | undefined): CatalogProduct[] {
  const list = [...products]
  if (sort === 'price-asc') list.sort((a, b) => a.priceKobo - b.priceKobo)
  else if (sort === 'price-desc') list.sort((a, b) => b.priceKobo - a.priceKobo)
  // In-stock pieces first, keeping the chosen order within each group.
  return [...list.filter((p) => p.inStock), ...list.filter((p) => !p.inStock)]
}

export function SortLinks({ basePath, current }: { basePath: string; current: string | string[] | undefined }) {
  const active = typeof current === 'string' && current in SORTS ? current : 'new'
  return (
    <nav aria-label="Sort" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {(Object.keys(SORTS) as SortKey[]).map((key) => (
        <Link
          key={key}
          href={key === 'new' ? basePath : `${basePath}?sort=${key}`}
          aria-current={active === key ? 'true' : undefined}
          className="no-underline decoration-dashed decoration-plum underline-offset-[5px] hover:underline aria-[current=true]:font-semibold aria-[current=true]:text-plum aria-[current=true]:underline"
          scroll={false}
        >
          {SORTS[key]}
        </Link>
      ))}
    </nav>
  )
}

export function Listing({
  products,
  emptyText,
  emptyAction,
}: {
  products: CatalogProduct[]
  emptyText: string
  emptyAction?: { href: string; label: string } | null
}) {
  if (products.length === 0) {
    return (
      <div className="border border-dashed border-line px-6 py-14 text-center">
        <p className="text-muted">{emptyText}</p>
        {emptyAction && (
          <a href={emptyAction.href} className="btn btn-secondary mt-6">
            {emptyAction.label}
          </a>
        )}
      </div>
    )
  }
  return <ProductGrid products={products} />
}

export function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] animate-pulse bg-blush" />
          <div className="mt-3 h-4 w-3/4 bg-blush" />
          <div className="mt-2 h-4 w-1/3 bg-blush" />
        </li>
      ))}
    </ul>
  )
}
