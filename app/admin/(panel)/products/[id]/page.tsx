import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { deleteProduct, saveProductDetails, setProductStatus } from '@/app/actions/admin-products'
import { ActionButton } from '@/components/admin/action-button'
import { ImageManager } from '@/components/admin/image-manager'
import { ProductDetailsForm, SizesEditor } from '@/components/admin/product-forms'
import { Notice, PageHeader, Panel, ProductBadge } from '@/components/admin/ui'
import { productNeighbours, publishBlockers } from '@/lib/admin-queries'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { MIN_PRODUCT_PHOTOS } from '@/lib/db/schema'
import { koboToInput } from '@/lib/money'
import { storageMode } from '@/lib/storage'

export const metadata: Metadata = { title: 'Edit product' }

export default async function EditProductPage({ params, searchParams }: PageProps<'/admin/products/[id]'>) {
  await requireAdmin()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const productId = Number(id)
  if (!Number.isInteger(productId)) notFound()

  const db = getDb()
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
    with: {
      images: { orderBy: [asc(schema.productImages.position), asc(schema.productImages.id)] },
      variants: { orderBy: [asc(schema.productVariants.position), asc(schema.productVariants.id)] },
    },
  })
  if (!product) notFound()
  const [categories, blockers, neighbours] = await Promise.all([
    db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .orderBy(asc(schema.categories.position), asc(schema.categories.name)),
    publishBlockers(productId),
    productNeighbours(productId),
  ])
  const totalStock = product.variants.reduce((n, v) => n + Math.max(0, v.stock), 0)
  const mode = storageMode()

  return (
    <>
      <PageHeader title={product.name} back={{ href: '/admin/products', label: 'Products' }}>
        {product.status === 'active' && (
          <Link href={`/products/${product.slug}`} className="btn btn-quiet" target="_blank">
            View in shop
          </Link>
        )}
      </PageHeader>

      {query.created === '1' && (
        <div className="mb-6">
          <Notice tone="success">Product created as a draft. Add photos, sizes and stock, then publish it.</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Panel title="Photos">
            <ImageManager
              productId={product.id}
              photos={product.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, alt: i.alt }))}
              mode={mode}
              minPhotos={MIN_PRODUCT_PHOTOS}
            />
          </Panel>

          <Panel title="Sizes and stock">
            <SizesEditor
              productId={product.id}
              sizes={product.variants.map((v) => ({ id: v.id, label: v.label, stock: v.stock }))}
            />
          </Panel>

          <Panel title="Details">
            <ProductDetailsForm
              action={saveProductDetails.bind(null, product.id)}
              categories={categories}
              product={{
                name: product.name,
                slug: product.slug,
                categoryId: product.categoryId,
                price: koboToInput(product.priceKobo),
                compareAt: koboToInput(product.compareAtKobo),
                description: product.description,
                details: product.details,
                featured: product.featured,
                preLoved: product.condition === 'pre_loved',
              }}
            />
          </Panel>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Visibility">
            <div className="mb-4 flex items-center gap-2">
              <ProductBadge status={product.status} />
              <span className="text-sm text-muted">
                {product.status === 'active' ? 'Customers can see and buy it.' : 'Hidden from the shop.'}
              </span>
            </div>
            {product.status !== 'active' &&
              (blockers.length > 0 ? (
                <div className="mb-4 text-sm">
                  <p className="font-semibold">Before you can publish:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-amber">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mb-4 text-sm text-leaf">Ready to publish.</p>
              ))}
            {totalStock === 0 && (
              <p className="mb-4 text-sm text-amber">Every size has 0 in stock, so it shows as sold out.</p>
            )}
            <div className="flex flex-col items-start gap-3">
              {product.status !== 'active' && (
                <ActionButton
                  action={setProductStatus.bind(null, product.id, 'active')}
                  className="btn btn-primary"
                  pendingLabel="Publishing…"
                >
                  Publish
                </ActionButton>
              )}
              {product.status === 'active' && (
                <ActionButton action={setProductStatus.bind(null, product.id, 'draft')}>Move to drafts</ActionButton>
              )}
              {product.status !== 'archived' && (
                <ActionButton action={setProductStatus.bind(null, product.id, 'archived')}>Archive</ActionButton>
              )}
            </div>
          </Panel>

          <Panel title="Delete product">
            <p className="mb-3 text-sm text-muted">
              Deletes the product and its photos for good. Past orders keep their details. To hide it without losing it,
              archive it instead.
            </p>
            <ActionButton
              action={deleteProduct.bind(null, product.id)}
              confirm="Delete for good?"
              className="btn btn-danger btn-sm"
              pendingLabel="Deleting…"
            >
              Delete product
            </ActionButton>
          </Panel>

          <div className="flex justify-between text-sm">
            {neighbours.prev ? (
              <Link href={`/admin/products/${neighbours.prev}`} className="font-semibold text-plum">
                ← Previous product
              </Link>
            ) : (
              <span />
            )}
            {neighbours.next && (
              <Link href={`/admin/products/${neighbours.next}`} className="font-semibold text-plum">
                Next product →
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
