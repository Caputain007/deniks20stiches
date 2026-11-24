import 'server-only'
import { and, asc, count, desc, eq, gt, gte, lt, ne } from 'drizzle-orm'
import { getDb, schema } from './db'
import { MIN_PRODUCT_PHOTOS } from './db/schema'

/** What still stops a product from going live. Empty means it can be published. */
export async function publishBlockers(productId: number): Promise<string[]> {
  const db = getDb()
  const [[product], [{ photos }], variants] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.id, productId)),
    db.select({ photos: count() }).from(schema.productImages).where(eq(schema.productImages.productId, productId)),
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, productId)),
  ])
  const blockers: string[] = []
  if (!product) return ['Product not found.']
  if (photos < MIN_PRODUCT_PHOTOS) {
    const missing = MIN_PRODUCT_PHOTOS - photos
    blockers.push(`Add ${missing} more photo${missing === 1 ? '' : 's'} (at least ${MIN_PRODUCT_PHOTOS} are needed).`)
  }
  if (product.priceKobo <= 0) blockers.push('Set a price.')
  if (variants.length === 0) blockers.push('Add at least one size.')
  return blockers
}

/** Neighbouring products for the editor's previous/next links. */
export async function productNeighbours(productId: number) {
  const db = getDb()
  const [prev] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(lt(schema.products.id, productId), ne(schema.products.status, 'archived')))
    .orderBy(desc(schema.products.id))
    .limit(1)
  const [next] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(gt(schema.products.id, productId), ne(schema.products.status, 'archived')))
    .orderBy(asc(schema.products.id))
    .limit(1)
  return { prev: prev?.id ?? null, next: next?.id ?? null }
}

/** Numbers for the admin dashboard. */
export async function getDashboardStats() {
  const db = getDb()
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const [[toShip], [awaiting], [live], [drafts], [rates], [paidWeek], recent] = await Promise.all([
    db.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, 'paid')),
    db
      .select({ n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.status, 'pending'), gte(schema.orders.createdAt, weekAgo))),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.status, 'active')),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.status, 'draft')),
    db.select({ n: count() }).from(schema.shippingRates),
    db.select({ n: count() }).from(schema.orders).where(gte(schema.orders.paidAt, weekAgo)),
    db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(8),
  ])
  return {
    toShip: toShip.n,
    awaiting: awaiting.n,
    live: live.n,
    drafts: drafts.n,
    rates: rates.n,
    paidWeek: paidWeek.n,
    recent,
  }
}
