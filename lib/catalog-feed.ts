import 'server-only'
import type { CatalogProduct } from './catalog'

// Product feed in Meta's catalogue format (Commerce Manager → Data sources →
// Data feed). Meta reads it on a schedule, so prices and stock stay in step
// with the website in Facebook, Instagram and WhatsApp catalogues.

const COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'product_type',
] as const

const cell = (value: string) => `"${value.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`
const money = (kobo: number) => `${(kobo / 100).toFixed(2)} NGN`

export function metaCatalogCsv(products: CatalogProduct[], origin: string): string {
  const absolute = (url: string) => (url.startsWith('http') ? url : `${origin}${url}`)
  const rows = products.map((p) => {
    const description = [p.description, ...p.details].filter(Boolean).join('. ') || `${p.name} from Deniks20 Stitches.`
    const values: Record<(typeof COLUMNS)[number], string> = {
      id: `DS-${p.id}`,
      title: p.name.slice(0, 200),
      description: description.slice(0, 5000),
      availability: p.inStock ? 'in stock' : 'out of stock',
      condition: p.preLoved ? 'used' : 'new',
      // With a "was" price, Meta shows it crossed out next to the sale price.
      price: money(p.compareAtKobo ?? p.priceKobo),
      sale_price: p.compareAtKobo ? money(p.priceKobo) : '',
      link: `${origin}/products/${p.slug}`,
      image_link: absolute(p.images[0].url),
      additional_image_link: p.images
        .slice(1, 11)
        .map((i) => absolute(i.url))
        .join(','),
      brand: 'Deniks20 Stitches',
      product_type: p.category?.name ?? '',
    }
    return COLUMNS.map((c) => cell(values[c])).join(',')
  })
  return [COLUMNS.join(','), ...rows].join('\n') + '\n'
}
