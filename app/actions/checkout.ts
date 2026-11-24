'use server'

import { timingSafeEqual } from 'node:crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { describeCoupon, type CouponTerms } from '@/lib/coupon-rules'
import { applyCoupon, CouponError, termsOf } from '@/lib/coupons'
import { getDb, schema } from '@/lib/db'
import { FULFILLMENTS } from '@/lib/db/schema'
import { isCountryCode, NIGERIAN_STATES } from '@/lib/geo'
import {
  cancelPendingOrder,
  CheckoutError,
  createOrder,
  getOrderWithItems,
  OrderNotPayableError,
  pendingOrderProblem,
  startPayment,
} from '@/lib/orders'
import { getOrigin } from '@/lib/origin'
import { PaymentsNotConfiguredError, paymentsConfigured } from '@/lib/paystack'
import { getSettings, pickupEnabled } from '@/lib/settings'
import { readShippingRates } from '@/lib/shipping'
import { findRate } from '@/lib/shipping-rules'

const lineSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
})
const linesSchema = z.array(lineSchema).max(50)

export type BagItemDetails = {
  variantId: number
  slug: string
  name: string
  size: string
  priceKobo: number
  imageUrl: string
  stock: number
  available: boolean
}

/** Current names, prices and stock for the lines in a shopper's bag. */
export async function getBagItems(lines: unknown): Promise<BagItemDetails[]> {
  const parsed = linesSchema.safeParse(lines)
  if (!parsed.success || parsed.data.length === 0) return []
  const ids = parsed.data.map((l) => l.variantId)
  const db = getDb()
  const rows = await db
    .select({ variant: schema.productVariants, product: schema.products })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(inArray(schema.productVariants.id, ids))
  const productIds = [...new Set(rows.map((r) => r.product.id))]
  const images = productIds.length
    ? await db
        .select({ productId: schema.productImages.productId, thumbUrl: schema.productImages.thumbUrl })
        .from(schema.productImages)
        .where(inArray(schema.productImages.productId, productIds))
        .orderBy(asc(schema.productImages.position), asc(schema.productImages.id))
    : []
  const cover = new Map<number, string>()
  for (const i of images) if (!cover.has(i.productId)) cover.set(i.productId, i.thumbUrl)

  return rows.map(({ variant, product }) => {
    const live = product.status === 'active' && product.priceKobo > 0
    // Products that aren't live (drafts, archived) reveal nothing about themselves.
    if (!live) {
      return {
        variantId: variant.id,
        slug: '',
        name: '',
        size: '',
        priceKobo: 0,
        imageUrl: '',
        stock: 0,
        available: false,
      }
    }
    return {
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      size: variant.label,
      priceKobo: product.priceKobo,
      imageUrl: cover.get(product.id) ?? '',
      stock: Math.max(0, variant.stock),
      available: true,
    }
  })
}

const trimmed = (max: number) => z.string().trim().max(max)

const checkoutSchema = z
  .object({
    fulfillment: z.enum(FULFILLMENTS).default('delivery'),
    email: z.email('Enter a valid email address.').max(254),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a phone number we can call, e.g. 0803 123 4567.'),
    name: trimmed(100).min(2, 'Enter your full name.'),
    country: z.string(),
    region: trimmed(100),
    city: trimmed(100),
    address1: trimmed(200),
    address2: trimmed(200),
    postcode: trimmed(20),
    note: trimmed(500),
    couponCode: trimmed(40).default(''),
    lines: linesSchema.min(1, 'Your bag is empty.'),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === 'pickup') return // collected from the shop: no address needed
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (!isCountryCode(data.country)) issue('country', 'Choose a country.')
    if (data.country === 'NG' && !NIGERIAN_STATES.includes(data.region)) issue('region', 'Choose your state.')
    if (data.city.length < 2) issue('city', 'Enter your town or city.')
    if (data.address1.length < 3) issue('address1', 'Enter your street address.')
  })

export type PlaceOrderResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; orderLink?: string }

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, error: fieldErrors.lines ?? 'Check the highlighted details and try again.', fieldErrors }
  }
  if (!paymentsConfigured()) {
    return { ok: false, error: "Online payment isn't switched on yet. Message us on WhatsApp to place your order." }
  }

  let order
  try {
    order = await createOrder({ ...parsed.data, email: parsed.data.email.toLowerCase() })
  } catch (error) {
    if (error instanceof CheckoutError) {
      return {
        ok: false,
        error: error.message,
        ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}),
      }
    }
    console.error('createOrder failed', error)
    return { ok: false, error: 'We couldn’t save your order. Please try again in a moment.' }
  }

  const origin = await getOrigin()
  try {
    return { ok: true, redirectTo: await startPayment(order, origin) }
  } catch (error) {
    if (!(error instanceof PaymentsNotConfiguredError)) console.error('startPayment failed', error)
    return {
      ok: false,
      error: `Your order ${order.number} is saved, but we couldn’t open the payment page. Try again from your order page.`,
      orderLink: `/order/${order.number}?key=${order.accessKey}`,
    }
  }
}

export type CouponCheck =
  { ok: true; terms: CouponTerms; label: string; discountKobo: number } | { ok: false; error: string }

const couponCheckSchema = z.object({
  code: trimmed(40),
  lines: linesSchema,
  fulfillment: z.enum(FULFILLMENTS),
  country: z.string().max(2),
  region: trimmed(100),
  email: z.string().trim().max(254),
})

/** "Apply" on the checkout's coupon field. The order is checked again when it's placed. */
export async function checkCoupon(input: unknown): Promise<CouponCheck> {
  const parsed = couponCheckSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter a coupon code.' }
  const { code, lines, fulfillment, country, region, email } = parsed.data
  if (!code) return { ok: false, error: 'Enter a coupon code.' }

  const items = await getBagItems(lines)
  const subtotalKobo = lines.reduce((sum, line) => {
    const item = items.find((i) => i.variantId === line.variantId)
    return sum + (item?.available ? item.priceKobo * line.quantity : 0)
  }, 0)
  // Null while the delivery fee isn't known yet (no state chosen); pickup has no fee.
  let shippingKobo: number | null = 0
  if (fulfillment === 'delivery') {
    const rate = isCountryCode(country)
      ? findRate(await readShippingRates(), country, country === 'NG' ? region : '')
      : null
    shippingKobo = rate?.feeKobo ?? null
  } else if (!pickupEnabled(await getSettings())) {
    return { ok: false, error: 'Pickup at the shop isn’t available right now.' }
  }

  try {
    const { coupon, discountKobo } = await applyCoupon(getDb(), code, {
      subtotalKobo,
      shippingKobo,
      email: z.email().safeParse(email).success ? email : undefined,
    })
    const terms = termsOf(coupon)
    return { ok: true, terms, label: describeCoupon(terms), discountKobo }
  } catch (error) {
    if (error instanceof CouponError) return { ok: false, error: error.message }
    console.error('checkCoupon failed', error)
    return { ok: false, error: 'We couldn’t check that code. Please try again.' }
  }
}

function keyMatches(given: string, actual: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(actual)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** "Pay now" on an unpaid order: opens a fresh Paystack checkout. */
export async function payForOrder(number: string, key: string): Promise<PlaceOrderResult> {
  const order = await getOrderWithItems({ number: String(number) })
  if (!order || !keyMatches(String(key), order.accessKey)) return { ok: false, error: 'Order not found.' }
  if (order.status !== 'pending') return { ok: false, error: 'This order is no longer waiting for payment.' }

  // Prices, stock or delivery may have changed since the order was placed.
  const problem = await pendingOrderProblem(order)
  if (problem) {
    await cancelPendingOrder(order.id)
    return { ok: false, error: `${problem} Please place a new order from your bag.`, orderLink: '/bag' }
  }
  try {
    return { ok: true, redirectTo: await startPayment(order, await getOrigin()) }
  } catch (error) {
    if (error instanceof OrderNotPayableError)
      return { ok: false, error: 'This order has already been paid. Refresh the page.' }
    if (!(error instanceof PaymentsNotConfiguredError)) console.error('startPayment failed', error)
    return { ok: false, error: 'We couldn’t open the payment page. Please try again in a moment.' }
  }
}

export type TrackState = { error?: string } | null

export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const number = String(formData.get('number') ?? '')
    .trim()
    .toUpperCase()
    .replace(/^DS-?/, 'DS-')
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!number || !email) return { error: 'Enter your order number and the email you used at checkout.' }
  const order = await getDb().query.orders.findFirst({
    where: and(eq(schema.orders.number, number), eq(sql`lower(${schema.orders.email})`, email)),
  })
  if (!order) return { error: 'We couldn’t find an order with that number and email. Check both and try again.' }
  redirect(`/order/${order.number}?key=${order.accessKey}`)
}
