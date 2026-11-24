import 'server-only'
import { and, asc, count, desc, eq, gt, gte, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
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
  const [[toShip], [awaiting], [live], [drafts], [rates], [paidWeek], recent, [measurements]] = await Promise.all([
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
    db.select({ n: count() }).from(schema.measurementRequests).where(eq(schema.measurementRequests.status, 'new')),
  ])
  return {
    toShip: toShip.n,
    awaiting: awaiting.n,
    live: live.n,
    drafts: drafts.n,
    rates: rates.n,
    paidWeek: paidWeek.n,
    recent,
    newMeasurements: measurements.n,
  }
}

/** IDs of orders with a payment that still needs an admin's attention. */
export async function ordersWithOpenIssues(): Promise<number[]> {
  const rows = await getDb()
    .selectDistinct({ orderId: schema.paymentIssues.orderId })
    .from(schema.paymentIssues)
    .where(isNull(schema.paymentIssues.resolvedAt))
  return rows.map((r) => r.orderId)
}

/* ---------- Banners and coupons ---------- */

export type BannerStatus = { label: string; tone: 'live' | 'waiting' | 'off' }

/** What each banner is doing right now. Only the newest live banner of each kind is shown. */
export function bannerStatuses(banners: (typeof schema.banners.$inferSelect)[]): Map<number, BannerStatus> {
  const now = Date.now()
  const showing = new Set<string>()
  const out = new Map<number, BannerStatus>()
  const sorted = [...banners].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id)
  for (const b of sorted) {
    let status: BannerStatus
    if (!b.active) status = { label: 'Off', tone: 'off' }
    else if (b.startsAt && b.startsAt.getTime() > now)
      status = { label: `Starts ${formatShort(b.startsAt)}`, tone: 'waiting' }
    else if (b.endsAt && b.endsAt.getTime() <= now) status = { label: `Ended ${formatShort(b.endsAt)}`, tone: 'off' }
    else if (showing.has(b.placement)) status = { label: 'Hidden behind a newer banner', tone: 'waiting' }
    else {
      showing.add(b.placement)
      status = { label: b.endsAt ? `Showing until ${formatShort(b.endsAt)}` : 'Showing now', tone: 'live' }
    }
    out.set(b.id, status)
  }
  return out
}

function formatShort(date: Date) {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Africa/Lagos',
  }).format(date)
}

export type CouponRow = typeof schema.coupons.$inferSelect & {
  paid: number
  waiting: number
  discountGivenKobo: number
  status: BannerStatus
}

/** Every coupon with how often it's been used and whether it works right now. */
export async function couponRows(): Promise<CouponRow[]> {
  const db = getDb()
  const since = new Date(Date.now() - 3 * 86_400_000)
  const [coupons, usage] = await Promise.all([
    db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt)),
    db
      .select({
        couponId: schema.orders.couponId,
        paid: sql<number>`count(*) filter (where ${schema.orders.status} in ('paid', 'shipped', 'delivered'))`.mapWith(
          Number,
        ),
        waiting:
          sql<number>`count(*) filter (where ${schema.orders.status} = 'pending' and ${schema.orders.createdAt} > ${since})`.mapWith(
            Number,
          ),
        given:
          sql<number>`coalesce(sum(${schema.orders.discountKobo}) filter (where ${schema.orders.status} in ('paid', 'shipped', 'delivered')), 0)`.mapWith(
            Number,
          ),
      })
      .from(schema.orders)
      .where(isNotNull(schema.orders.couponId))
      .groupBy(schema.orders.couponId),
  ])
  const now = Date.now()
  return coupons.map((c) => {
    const u = usage.find((x) => x.couponId === c.id)
    const paid = u?.paid ?? 0
    const waiting = u?.waiting ?? 0
    let status: BannerStatus = { label: 'Live', tone: 'live' }
    if (!c.active) status = { label: 'Off', tone: 'off' }
    else if (c.startsAt && c.startsAt.getTime() > now)
      status = { label: `Starts ${formatShort(c.startsAt)}`, tone: 'waiting' }
    else if (c.endsAt && c.endsAt.getTime() <= now) status = { label: 'Expired', tone: 'off' }
    else if (c.maxUses !== null && paid >= c.maxUses) status = { label: 'Used up', tone: 'off' }
    else if (c.maxUses !== null && paid + waiting >= c.maxUses) {
      status = { label: 'Held by unpaid orders', tone: 'waiting' }
    }
    return { ...c, paid, waiting, discountGivenKobo: u?.given ?? 0, status }
  })
}
