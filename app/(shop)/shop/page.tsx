import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GridSkeleton, Listing, SortLinks, sortProducts } from '@/components/shop/shop-listing'
import { getCatalog } from '@/lib/catalog'

export const metadata: Metadata = {
  title: 'Shop all',
  description: 'Browse every hijab, modest dress, abaya and accessory from Deniks20 Stitches.',
}

export default function ShopPage({ searchParams }: PageProps<'/shop'>) {
  return (
    <div className="wrap pt-10">
      <h1 className="text-4xl sm:text-5xl">Shop all</h1>
      <Suspense fallback={<GridSkeleton />}>
        <AllProducts searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AllProducts({ searchParams }: Pick<PageProps<'/shop'>, 'searchParams'>) {
  const [{ sort }, { products }] = await Promise.all([searchParams, getCatalog()])
  return (
    <>
      <div className="mb-8 mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-muted">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'}
        </p>
        <SortLinks basePath="/shop" current={sort} />
      </div>
      <Listing products={sortProducts(products, sort)} emptyText="Nothing here yet. New pieces are on the way." />
    </>
  )
}
