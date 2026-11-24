import { getCatalog } from '@/lib/catalog'
import { metaCatalogCsv } from '@/lib/catalog-feed'
import { originFromRequest } from '@/lib/origin'

/** Every live product, for Meta Commerce Manager's scheduled data feed. */
export async function GET(request: Request) {
  const { products } = await getCatalog()
  return new Response(metaCatalogCsv(products, originFromRequest(request)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  })
}
