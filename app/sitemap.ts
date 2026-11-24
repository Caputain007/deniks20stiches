import type { MetadataRoute } from 'next'
import { getCatalog } from '@/lib/catalog'
import { siteUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  if (!base) return []
  const { categories, products } = await getCatalog()
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    ...categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({ url: `${base}/shop/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}
