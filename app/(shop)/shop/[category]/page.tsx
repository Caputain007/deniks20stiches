import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { GridSkeleton, Listing, SortLinks, sortProducts } from '@/components/shop/shop-listing'
import { getCatalog } from '@/lib/catalog'
import { getSettings, whatsappLink } from '@/lib/settings'

export async function generateMetadata({ params }: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const { category } = await params
  const { categories } = await getCatalog()
  const found = categories.find((c) => c.slug === category)
  return found
    ? { title: found.name, description: found.description || `Shop ${found.name} from Deniks20 Stitches.` }
    : { title: 'Not found' }
}

export default function CategoryPage(props: PageProps<'/shop/[category]'>) {
  return (
    <div className="wrap pt-10">
      <Suspense
        fallback={
          <>
            <div className="h-12 w-64 bg-blush" />
            <div className="mt-12">
              <GridSkeleton />
            </div>
          </>
        }
      >
        <CategoryListing {...props} />
      </Suspense>
    </div>
  )
}

async function CategoryListing({ params, searchParams }: PageProps<'/shop/[category]'>) {
  const [{ category }, { sort }, { categories, products }, settings] = await Promise.all([
    params,
    searchParams,
    getCatalog(),
    getSettings(),
  ])
  const current = categories.find((c) => c.slug === category)
  if (!current) notFound()
  const inCategory = products.filter((p) => p.category?.slug === current.slug)

  return (
    <>
      <p className="text-sm text-muted">
        <Link href="/shop" className="hover:text-plum">
          Shop all
        </Link>{' '}
        / {current.name}
      </p>
      <h1 className="mt-2 text-4xl sm:text-5xl">{current.name}</h1>
      {current.description && <p className="mt-3 max-w-[60ch] text-muted">{current.description}</p>}
      {inCategory.length > 0 ? (
        <div className="mb-8 mt-4 flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-muted">
            {inCategory.length} {inCategory.length === 1 ? 'piece' : 'pieces'}
          </p>
          <SortLinks basePath={`/shop/${current.slug}`} current={sort} />
        </div>
      ) : (
        <div className="mt-8" />
      )}
      <Listing
        products={sortProducts(inCategory, sort)}
        emptyText={`New ${current.name.toLowerCase()} are on the way. Ask us on WhatsApp what’s in the shop today.`}
        emptyAction={(() => {
          const href = whatsappLink(
            settings.whatsapp,
            `Hello Deniks20 Stitches, which ${current.name.toLowerCase()} do you have at the moment?`,
          )
          return href ? { href, label: 'Ask on WhatsApp' } : null
        })()}
      />
    </>
  )
}
