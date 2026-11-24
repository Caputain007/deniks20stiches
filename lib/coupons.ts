import 'server-only'
import { and, eq, gt, inArray, ne, or, sql } from 'drizzle-orm'
import { getDb, schema } from './db'
import { couponDiscount, type CouponTerms } from './coupon-rules'
import { formatNaira } from './money'
import { PAID_STATUSES, PENDING_ORDER_DAYS } from './order-rules'

export type Coupon = typeof schema.coupons.$inferSelect
type Db = ReturnType<typeof getDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx

/** A coupon problem the customer can fix (shown next to the coupon field). */
export class CouponError extends Error {}

export function normalizeCode(input: string): string {
  return String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 40)
}

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/

export function termsOf(coupon: Coupon): CouponTerms {
  return { code: coupon.code, kind: coupon.kind, value: coupon.value, minSubtotalKobo: coupon.minSubtotalKobo }
}

/** Orders that count as a use: paid ones, and unpaid ones still young enough to be paid. */
function usedBy(couponId: number, exceptOrderId?: number) {
  const since = new Date(Date.now() - PENDING_ORDER_DAYS * 86_400_000)
  return and(
    eq(schema.orders.couponId, couponId),
    or(
      inArray(schema.orders.status, [...PAID_STATUSES]),
      and(eq(schema.orders.status, 'pending'), gt(schema.orders.createdAt, since)),
    ),
    exceptOrderId ? ne(schema.orders.id, exceptOrderId) : undefined,
  )
}

export async function countUses(db: Executor, couponId: number, exceptOrderId?: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.orders)
    .where(usedBy(couponId, exceptOrderId))
  return row?.n ?? 0
}

/** Whether this email already has a paid order with the coupon. */
async function usedByEmail(db: Executor, couponId: number, email: string, exceptOrderId?: number): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.couponId, couponId),
        inArray(schema.orders.status, [...PAID_STATUSES]),
        eq(sql`lower(${schema.orders.email})`, email.toLowerCase()),
        exceptOrderId ? ne(schema.orders.id, exceptOrderId) : undefined,
      ),
    )
  return (row?.n ?? 0) > 0
}

/** Why a coupon can't be used right now, judging only its own settings. */
export function couponTimeProblem(coupon: Coupon, now = new Date()): string | null {
  if (!coupon.active) return 'That code isn’t valid. Check the spelling.'
  if (coupon.startsAt && coupon.startsAt > now) return 'This code isn’t active yet.'
  if (coupon.endsAt && coupon.endsAt <= now) return 'This code has expired.'
  return null
}

export type AppliedCoupon = { coupon: Coupon; discountKobo: number }

/**
 * Checks a code against an order and returns the saving. With `lock`, the coupon
 * row is locked (inside a transaction) so two orders can't both take the last use.
 */
export async function applyCoupon(
  db: Executor,
  rawCode: string,
  /** shippingKobo is null while the delivery fee isn't known yet (checkout preview only). */
  order: { subtotalKobo: number; shippingKobo: number | null; email?: string; lock?: boolean },
): Promise<AppliedCoupon> {
  const code = normalizeCode(rawCode)
  if (!COUPON_CODE_PATTERN.test(code)) throw new CouponError('That code isn’t valid. Check the spelling.')

  const query = db.select().from(schema.coupons).where(eq(schema.coupons.code, code))
  const [coupon] = order.lock ? await query.for('update') : await query
  if (!coupon) throw new CouponError('That code isn’t valid. Check the spelling.')

  const timeProblem = couponTimeProblem(coupon)
  if (timeProblem) throw new CouponError(timeProblem)

  if (order.subtotalKobo < coupon.minSubtotalKobo) {
    throw new CouponError(
      `This code needs an order of ${formatNaira(coupon.minSubtotalKobo)} or more, before delivery.`,
    )
  }
  if (coupon.maxUses !== null && (await countUses(db, coupon.id)) >= coupon.maxUses) {
    throw new CouponError('This code has been used up.')
  }
  if (coupon.oncePerCustomer && order.email && (await usedByEmail(db, coupon.id, order.email))) {
    throw new CouponError('You’ve already used this code.')
  }

  const discountKobo = couponDiscount(termsOf(coupon), order.subtotalKobo, order.shippingKobo ?? 0)
  // A free-delivery code is fine before the fee is known; the saving shows once it is.
  if (discountKobo <= 0 && !(coupon.kind === 'free_delivery' && order.shippingKobo === null)) {
    throw new CouponError(
      coupon.kind === 'free_delivery'
        ? 'This code gives free delivery, and this order has no delivery fee.'
        : 'This code doesn’t take anything off this order.',
    )
  }
  return { coupon, discountKobo }
}

/** Before an unpaid order is paid later: is its coupon still good, for the same saving? */
export async function orderCouponProblem(order: {
  id: number
  email: string
  couponId: number | null
  couponCode: string
  discountKobo: number
  subtotalKobo: number
  shippingKobo: number
}): Promise<string | null> {
  if (!order.couponCode) return null
  const db = getDb()
  const [coupon] = order.couponId
    ? await db.select().from(schema.coupons).where(eq(schema.coupons.id, order.couponId))
    : []
  if (!coupon || couponTimeProblem(coupon)) return `The code ${order.couponCode} on this order is no longer valid.`
  if (couponDiscount(termsOf(coupon), order.subtotalKobo, order.shippingKobo) !== order.discountKobo) {
    return `The code ${order.couponCode} has changed since you placed this order.`
  }
  if (coupon.oncePerCustomer && (await usedByEmail(db, coupon.id, order.email, order.id))) {
    return `You’ve already used the code ${order.couponCode} on another order.`
  }
  return null
}
