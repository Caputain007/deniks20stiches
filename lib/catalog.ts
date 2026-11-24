import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { getDb, schema } from './db'
import { MIN_PRODUCT_PHOTOS } from './db/schema'

export const CATALOG_TAG = 'catalog'

export type CatalogImage = { url: string; thumbUrl: string; width: number; height: number; alt: string }
export type CatalogSize = { id: number; label: string; stock: number }
export type CatalogCategory = { id: number; name: string; slug: string; description: string; productCount: number }

export type CatalogProduct = {
  id: number
  slug: string
  name: string
  description: string
  details: string[]
  priceKobo: number
  compareAtKobo: number | null
  featured: boolean
  category: { name: string; slug: string } | null
  images: CatalogImage[]
  sizes: CatalogSize[]
  inStock: boolean
  createdAt: string
}

export type Catalog = { categories: CatalogCategory[]; products: CatalogProduct[] }

/**
 * Everything the storefront shows, read once and cached until an admin change
 * or a sale invalidates the "catalog" tag. Keeps browsing off the database.
 */
export async function getCatalog(): Promise<Catalog> {
  'use cache'
  cacheTag(CATALOG_TAG)
  cacheLife('max')

  const db = getDb()
  const [categoryRows, productRows] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name)),
    db.query.products.findMany({
      where: eq(schema.products.status, 'active'),
      orderBy: [desc(schema.products.createdAt), desc(schema.products.id)],
      with: {
        category: true,
        images: { orderBy: [asc(schema.productImages.position), asc(schema.productImages.id)] },
        variants: { orderBy: [asc(schema.productVariants.position), asc(schema.productVariants.id)] },
      },
    }),
  ])

  const products: CatalogProduct[] = productRows
    // Publishing already requires the minimum; this keeps the rule even if photos are removed later.
    .filter((p) => p.images.length >= MIN_PRODUCT_PHOTOS && p.variants.length > 0 && p.priceKobo > 0)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      details: p.details
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      priceKobo: p.priceKobo,
      compareAtKobo: p.compareAtKobo && p.compareAtKobo > p.priceKobo ? p.compareAtKobo : null,
      featured: p.featured,
      category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
      images: p.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl, width: i.width, height: i.height, alt: i.alt })),
      sizes: p.variants.map((v) => ({ id: v.id, label: v.label, stock: Math.max(0, v.stock) })),
      inStock: p.variants.some((v) => v.stock > 0),
      createdAt: p.createdAt.toISOString(),
    }))

  const counts = new Map<string, number>()
  for (const p of products) if (p.category) counts.set(p.category.slug, (counts.get(p.category.slug) ?? 0) + 1)

  return {
    categories: categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productCount: counts.get(c.slug) ?? 0,
    })),
    products,
  }
}
