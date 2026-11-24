import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GridSkeleton, Listing, SortLinks, sortProducts } from '@/components/shop/shop-listing'
import { getCatalog } from '@/lib/catalog'

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Hijabs, modest dresses, abayas and accessories with a reduced price at Deniks20 Stitches.',
}

export default function SalePage({ searchParams }: PageProps<'/sale'>) {
  return (
    <div className="wrap pt-10">
      <h1 className="text-4xl sm:text-5xl">Sale</h1>
      <Suspense fallback={<GridSkeleton />}>
        <SaleProducts searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SaleProducts({ searchParams }: Pick<PageProps<'/sale'>, 'searchParams'>) {
  const [{ sort }, { products }] = await Promise.all([searchParams, getCatalog()])
  const reduced = products.filter((p) => p.compareAtKobo)
  return (
    <>
      <div className="mb-8 mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-muted">
          {reduced.length} {reduced.length === 1 ? 'piece' : 'pieces'} with a reduced price
        </p>
        <SortLinks basePath="/sale" current={sort} />
      </div>
      <Listing products={sortProducts(reduced, sort)} emptyText="Nothing is reduced right now. Check back soon." />
    </>
  )
}
