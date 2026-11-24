/* eslint-disable @next/next/no-img-element -- product photos are already resized to two widths on upload */
import Link from 'next/link'
import type { CatalogProduct } from '@/lib/catalog'
import { Price } from './price'

export function ProductCard({ product, priority = false }: { product: CatalogProduct; priority?: boolean }) {
  const [first, second] = product.images
  return (
    <Link href={`/products/${product.slug}`} className="group block no-underline">
      <div className="relative aspect-[4/5] overflow-hidden bg-blush">
        <img
          src={first.thumbUrl}
          srcSet={`${first.thumbUrl} 640w, ${first.url} 1600w`}
          sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw"
          alt={first.alt || product.name}
          width={first.width}
          height={first.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {second && (
          // The second photo shows on hover, so shoppers see another angle before opening the product.
          <img
            src={second.thumbUrl}
            alt=""
            width={second.width}
            height={second.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:block"
          />
        )}
        {(!product.inStock || product.preLoved) && (
          <span className="absolute left-3 top-3 flex flex-col items-start gap-1">
            {!product.inStock && <span className="bg-white/95 px-2.5 py-1 text-xs font-bold text-ink">Sold out</span>}
            {product.preLoved && <span className="bg-white/95 px-2.5 py-1 text-xs font-bold text-plum">Pre-loved</span>}
          </span>
        )}
      </div>
      <div className="mt-3">
        <h3 className="font-sans text-[0.95rem] font-semibold leading-snug group-hover:text-plum">{product.name}</h3>
        <Price
          kobo={product.priceKobo}
          compareAt={product.compareAtKobo}
          className="mt-1 block text-[0.95rem] text-muted"
        />
      </div>
    </Link>
  )
}

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  )
}
