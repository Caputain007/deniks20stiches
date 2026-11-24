import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AddToBag } from '@/components/shop/add-to-bag'
import { Price } from '@/components/shop/price'
import { ProductGrid } from '@/components/shop/product-card'
import { ProductGallery } from '@/components/shop/product-gallery'
import { getCatalog } from '@/lib/catalog'
import { getSettings, whatsappLink } from '@/lib/settings'

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const { products } = await getCatalog()
  const product = products.find((p) => p.slug === slug)
  if (!product) return { title: 'Not found' }
  return {
    title: product.name,
    description: product.description.slice(0, 160) || `${product.name} from Deniks20 Stitches.`,
    openGraph: {
      images: [{ url: product.images[0].url, width: product.images[0].width, height: product.images[0].height }],
    },
  }
}

export default function ProductPage(props: PageProps<'/products/[slug]'>) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetails params={props.params} />
    </Suspense>
  )
}

async function ProductDetails({ params }: Pick<PageProps<'/products/[slug]'>, 'params'>) {
  const [{ slug }, { products }, settings] = await Promise.all([params, getCatalog(), getSettings()])
  const product = products.find((p) => p.slug === slug)
  if (!product) notFound()

  const related = products
    .filter((p) => p.id !== product.id && p.inStock && p.category?.slug === product.category?.slug)
    .slice(0, 4)
  const ask = whatsappLink(settings.whatsapp, `Hello Deniks20 Stitches, I'm interested in "${product.name}".`)

  return (
    <div className="wrap pt-6 md:pt-10">
      <p className="text-sm text-muted">
        <Link href="/shop" className="hover:text-plum">
          Shop all
        </Link>
        {product.category && (
          <>
            {' / '}
            <Link href={`/shop/${product.category.slug}`} className="hover:text-plum">
              {product.category.name}
            </Link>
          </>
        )}
      </p>

      <div className="mt-4 grid gap-8 md:grid-cols-[7fr_5fr] lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div className="min-w-0 md:sticky md:top-6 md:self-start">
          <h1 className="text-[2.1rem] leading-tight sm:text-5xl">{product.name}</h1>
          <Price kobo={product.priceKobo} compareAt={product.compareAtKobo} className="mt-3 block text-xl" />

          <AddToBag sizes={product.sizes} productName={product.name} />

          {product.description && (
            <div className="prose-shop mt-10 max-w-[60ch] whitespace-pre-line text-ink/90">{product.description}</div>
          )}

          {product.details.length > 0 && (
            <ul className="mt-6 space-y-1.5 border-t border-line pt-6 text-[0.95rem]">
              {product.details.map((d) => (
                <li key={d} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-plum" />
                  {d}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 space-y-2 border-t border-line pt-6 text-[0.95rem] text-muted">
            <p>Delivery across Nigeria and abroad. Your delivery fee is shown at checkout.</p>
            {ask && (
              <p>
                Questions about fit or colour?{' '}
                <a href={ask} className="font-semibold text-plum">
                  Ask us on WhatsApp
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24" aria-labelledby="related-title">
          <h2 id="related-title" className="text-3xl">
            More {product.category?.name.toLowerCase() ?? 'pieces'}
          </h2>
          <div className="mt-8">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="wrap pt-10" aria-hidden="true">
      <div className="grid gap-8 md:grid-cols-[7fr_5fr] lg:gap-14">
        <div className="aspect-[4/5] animate-pulse bg-blush md:aspect-[8/5]" />
        <div>
          <div className="h-12 w-3/4 bg-blush" />
          <div className="mt-4 h-6 w-1/4 bg-blush" />
          <div className="mt-10 h-12 w-full bg-blush" />
        </div>
      </div>
    </div>
  )
}
