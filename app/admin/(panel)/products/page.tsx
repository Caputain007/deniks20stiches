/* eslint-disable @next/next/no-img-element -- thumbnails are already small */
import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, desc, eq } from 'drizzle-orm'
import { Notice, PageHeader, Panel, ProductBadge } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { MIN_PRODUCT_PHOTOS, PRODUCT_STATUSES, type ProductStatus } from '@/lib/db/schema'
import { formatNaira } from '@/lib/money'

export const metadata: Metadata = { title: 'Products' }

const TABS: { status: ProductStatus | 'all'; label: string }[] = [
  { status: 'all', label: 'All' },
  { status: 'active', label: 'Live' },
  { status: 'draft', label: 'Drafts' },
  { status: 'archived', label: 'Archived' },
]

export default async function ProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  await requireAdmin()
  const query = await searchParams
  const status =
    typeof query.status === 'string' && (PRODUCT_STATUSES as readonly string[]).includes(query.status)
      ? (query.status as ProductStatus)
      : 'all'

  const products = await getDb().query.products.findMany({
    where: status === 'all' ? undefined : eq(schema.products.status, status),
    orderBy: [desc(schema.products.updatedAt)],
    with: {
      category: true,
      images: { orderBy: [asc(schema.productImages.position), asc(schema.productImages.id)] },
      variants: true,
    },
  })

  return (
    <>
      <PageHeader title="Products">
        <Link href="/admin/products/new" className="btn btn-primary">
          Add product
        </Link>
      </PageHeader>

      {query.deleted === '1' && (
        <div className="mb-6">
          <Notice tone="success">Product deleted.</Notice>
        </div>
      )}

      <nav aria-label="Product status" className="snap-strip mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={tab.status === 'all' ? '/admin/products' : `/admin/products?status=${tab.status}`}
            aria-current={status === tab.status ? 'page' : undefined}
            className="whitespace-nowrap border border-line bg-white px-3 py-2 text-sm font-semibold no-underline aria-[current=page]:border-plum aria-[current=page]:text-plum aria-[current=page]:stitched"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Panel>
        {products.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-muted">No products here yet.</p>
            <Link href="/admin/products/new" className="btn btn-primary mt-4">
              Add your first product
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + Math.max(0, v.stock), 0)
              const cover = p.images[0]
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex items-center gap-4 py-3 text-ink no-underline hover:bg-mist"
                  >
                    <div className="h-20 w-16 shrink-0 bg-blush">
                      {cover && <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">
                        {p.category?.name ?? 'No category'}, {formatNaira(p.priceKobo)}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                        <span className={stock === 0 ? 'font-semibold text-rose' : 'text-muted'}>
                          {stock === 0 ? 'Out of stock' : `${stock} in stock`}
                        </span>
                        <span
                          className={p.images.length < MIN_PRODUCT_PHOTOS ? 'font-semibold text-amber' : 'text-muted'}
                        >
                          {p.images.length} photo{p.images.length === 1 ? '' : 's'}
                          {p.images.length < MIN_PRODUCT_PHOTOS && ` (needs ${MIN_PRODUCT_PHOTOS})`}
                        </span>
                      </p>
                    </div>
                    <ProductBadge status={p.status} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
