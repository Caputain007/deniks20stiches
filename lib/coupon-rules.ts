// Pure coupon maths, shared by the checkout form (live totals) and the server
// (which recalculates everything when the order is placed).
import type { CouponKind } from './db/schema'
import { formatNaira } from './money'

export type CouponTerms = { code: string; kind: CouponKind; value: number; minSubtotalKobo: number }

/**
 * What the coupon takes off the order. Percent and amount coupons apply to the
 * items (never below zero); a free-delivery coupon takes off the delivery fee.
 * Percentages round down to whole naira.
 */
export function couponDiscount(terms: CouponTerms, subtotalKobo: number, shippingKobo: number): number {
  if (subtotalKobo <= 0 || subtotalKobo < terms.minSubtotalKobo) return 0
  if (terms.kind === 'percent') {
    const percent = Math.min(100, Math.max(0, terms.value))
    return Math.min(subtotalKobo, Math.floor((subtotalKobo * percent) / 100 / 100) * 100)
  }
  if (terms.kind === 'amount') return Math.min(subtotalKobo, Math.max(0, terms.value))
  return Math.max(0, shippingKobo)
}

export function describeCoupon(terms: Pick<CouponTerms, 'kind' | 'value'>): string {
  if (terms.kind === 'percent') return `${terms.value}% off`
  if (terms.kind === 'amount') return `${formatNaira(terms.value)} off`
  return 'Free delivery'
}
