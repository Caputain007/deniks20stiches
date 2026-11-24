import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { isUniqueViolation, randomCode } from './codes'
import { applyCoupon, CouponError, orderCouponProblem, type AppliedCoupon } from './coupons'
import { getDb, schema } from './db'
import type { Fulfillment, PaymentIssueKind } from './db/schema'
import { formatNaira } from './money'
import { PENDING_ORDER_DAYS } from './order-rules'
import { initializeTransaction, verifyTransaction, type VerifiedTransaction } from './paystack'
import { getSettings, pickupEnabled } from './settings'
import { readShippingRates } from './shipping'
import { findRate } from './shipping-rules'

export type Order = typeof schema.orders.$inferSelect
export type OrderItem = typeof schema.orderItems.$inferSelect

export type BagLine = { variantId: number; quantity: number }

export type CheckoutInput = {
  fulfillment: Fulfillment
  email: string
  phone: string
  name: string
  country: string
  region: string
  city: string
  address1: string
  address2: string
  postcode: string
  note: string
  couponCode: string
  lines: BagLine[]
}

/** A problem the customer can fix (shown on the checkout form, next to `field` if given). */
export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
  }
}

/** Re-prices the bag from the database, checks stock and delivery, and saves a pending order. */
export async function createOrder(input: CheckoutInput): Promise<Order> {
  const db = getDb()

  const wanted = new Map<number, number>()
  for (const line of input.lines) wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity)
  if (wanted.size === 0) throw new CheckoutError('Your bag is empty.')

  const rows = await db
    .select({ variant: schema.productVariants, product: schema.products })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(inArray(schema.productVariants.id, [...wanted.keys()]))

  const productIds = [...new Set(rows.map((r) => r.product.id))]
  const images = productIds.length
    ? await db
        .select({ productId: schema.productImages.productId, thumbUrl: schema.productImages.thumbUrl })
        .from(schema.productImages)
        .where(inArray(schema.productImages.productId, productIds))
        .orderBy(asc(schema.productImages.position), asc(schema.productImages.id))
    : []
  const cover = new Map<number, string>()
  for (const image of images) if (!cover.has(image.productId)) cover.set(image.productId, image.thumbUrl)

  const problems: string[] = []
  const items: Omit<OrderItem, 'id' | 'orderId' | 'stockTaken'>[] = []
  for (const [variantId, quantity] of wanted) {
    const row = rows.find((r) => r.variant.id === variantId)
    if (!row || row.product.status !== 'active' || row.product.priceKobo <= 0) {
      problems.push('One of the items in your bag is no longer available. Remove it to continue.')
      continue
    }
    const label = `${row.product.name} (${row.variant.label})`
    if (row.variant.stock <= 0) {
      problems.push(`${label} has sold out.`)
      continue
    }
    if (row.variant.stock < quantity) {
      problems.push(`Only ${row.variant.stock} left of ${label}.`)
      continue
    }
    items.push({
      productId: row.product.id,
      variantId,
      productName: row.product.name,
      variantLabel: row.variant.label,
      imageUrl: cover.get(row.product.id) ?? '',
      unitPriceKobo: row.product.priceKobo,
      quantity,
    })
  }
  if (problems.length) throw new CheckoutError(problems.join(' '))

  const pickup = input.fulfillment === 'pickup'
  let shippingKobo = 0
  let shippingEta = ''
  if (pickup) {
    if (!pickupEnabled(await getSettings())) {
      throw new CheckoutError('Pickup at the shop isn’t available right now. Choose delivery instead.')
    }
  } else {
    const rate = findRate(await readShippingRates(), input.country, input.country === 'NG' ? input.region : '')
    if (!rate) {
      throw new CheckoutError("We don't deliver to this address yet. Message us on WhatsApp and we'll arrange it.")
    }
    shippingKobo = rate.feeKobo
    shippingEta = rate.eta
  }

  const subtotalKobo = items.reduce((sum, item) => sum + item.unitPriceKobo * item.quantity, 0)

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // The coupon row stays locked until this order is saved, so its last use can't be taken twice.
        let applied: AppliedCoupon | null = null
        if (input.couponCode) {
          applied = await applyCoupon(tx, input.couponCode, {
            subtotalKobo,
            shippingKobo,
            email: input.email,
            lock: true,
          })
        }
        const discountKobo = applied?.discountKobo ?? 0
        const [order] = await tx
          .insert(schema.orders)
          .values({
            number: `DS-${randomCode(6)}`,
            accessKey: randomBytes(18).toString('base64url'),
            fulfillment: input.fulfillment,
            email: input.email,
            phone: input.phone,
            customerName: input.name,
            shipCountry: pickup ? 'NG' : input.country,
            shipRegion: pickup ? '' : input.region,
            shipCity: pickup ? '' : input.city,
            shipAddress1: pickup ? '' : input.address1,
            shipAddress2: pickup ? '' : input.address2,
            shipPostcode: pickup ? '' : input.postcode,
            deliveryNote: input.note,
            subtotalKobo,
            shippingKobo,
            discountKobo,
            couponId: applied?.coupon.id ?? null,
            couponCode: applied?.coupon.code ?? '',
            totalKobo: subtotalKobo + shippingKobo - discountKobo,
            shippingEta,
          })
          .returning()
        await tx.insert(schema.orderItems).values(items.map((item) => ({ ...item, orderId: order.id })))
        return order
      })
    } catch (error) {
      if (error instanceof CouponError) throw new CheckoutError(error.message, 'couponCode')
      if (attempt < 4 && isUniqueViolation(error)) continue // order number clash: try another
      throw error
    }
  }
}

/** The order is no longer waiting for payment (already paid or cancelled). */
export class OrderNotPayableError extends Error {}

/** Opens a Paystack checkout for a pending order and returns the URL to send the customer to. */
export async function startPayment(order: Order, origin: string): Promise<string> {
  const db = getDb()
  // Long and random, so a reference can't be guessed. Recorded before Paystack
  // sees it: payments are only ever matched to orders through this table.
  const reference = `${order.number}-${randomCode(12)}`
  await db.insert(schema.paymentAttempts).values({ reference, orderId: order.id, amountKobo: order.totalKobo })

  const orderLink = `${origin}/order/${order.number}?key=${order.accessKey}`
  const payment = await initializeTransaction({
    email: order.email,
    amountKobo: order.totalKobo,
    reference,
    callbackUrl: `${origin}/api/paystack/callback`,
    metadata: {
      order_number: order.number,
      cancel_action: orderLink,
      custom_fields: [{ display_name: 'Order', variable_name: 'order_number', value: order.number }],
    },
  })

  // If a payment landed while Paystack was answering, don't send the customer to pay twice.
  const [stillPending] = await db
    .update(schema.orders)
    .set({ paymentReference: reference, paymentUrl: payment.authorizationUrl, updatedAt: new Date() })
    .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'pending')))
    .returning({ id: schema.orders.id })
  if (!stillPending) throw new OrderNotPayableError('This order has already been paid.')
  return payment.authorizationUrl
}

/** The order a reference was created for, if this shop created it. */
export async function findPaymentAttempt(reference: string) {
  const [attempt] = await getDb()
    .select()
    .from(schema.paymentAttempts)
    .where(eq(schema.paymentAttempts.reference, reference))
  return attempt ?? null
}

/** Whether a Paystack reference was created by this shop. */
export async function isOurPayment(reference: string): Promise<boolean> {
  return Boolean(await findPaymentAttempt(reference))
}

export type PaymentIssue = { kind: PaymentIssueKind; message: string }
export type FinalizeResult = { order: Order; newlyPaid: boolean; newIssue: PaymentIssue | null }

/**
 * Marks an order paid once Paystack confirms it. Safe to call many times for the
 * same payment (redirect, webhook and retries all land here). Payments that need
 * a refund or a check are recorded as payment issues for the admin.
 */
export async function finalizePayment(
  reference: string,
  verified?: VerifiedTransaction,
): Promise<FinalizeResult | null> {
  const attempt = await findPaymentAttempt(reference)
  if (!attempt) return null // not a reference this shop created: ignore it
  const txn = verified ?? (await verifyTransaction(reference))
  const db = getDb()

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, attempt.orderId)).for('update')
    if (!order) return null
    if (txn.status !== 'success' || txn.reference !== reference) return { order, newlyPaid: false, newIssue: null }

    const raise = async (kind: PaymentIssueKind, message: string): Promise<FinalizeResult> => {
      const [created] = await tx
        .insert(schema.paymentIssues)
        .values({ orderId: order.id, reference, kind, message })
        .onConflictDoNothing()
        .returning({ id: schema.paymentIssues.id })
      return { order, newlyPaid: false, newIssue: created ? { kind, message } : null }
    }

    // With "pass fees to customer" on, Paystack charges more than the shop asked for.
    const paidFor = txn.requestedAmount ?? txn.amount

    if (order.status === 'cancelled') {
      return raise(
        'after_cancel',
        `A payment of ${formatNaira(txn.amount)} (Paystack reference ${reference}) arrived after this order was cancelled. Refund it in your Paystack dashboard.`,
      )
    }
    if (order.status !== 'pending') {
      if (order.paymentReference === reference) return { order, newlyPaid: false, newIssue: null } // already handled
      return raise(
        'duplicate',
        `The customer paid twice. A second payment of ${formatNaira(txn.amount)} (Paystack reference ${reference}) came in after the order was paid. Refund it in your Paystack dashboard.`,
      )
    }
    if (txn.currency !== order.currency || paidFor !== order.totalKobo) {
      return raise(
        'amount_mismatch',
        `A payment of ${formatNaira(paidFor)} ${txn.currency} (Paystack reference ${reference}) doesn't match the order total of ${formatNaira(order.totalKobo)}, so the order wasn't marked as paid. Check it in your Paystack dashboard.`,
      )
    }

    const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id))
    let stockIssue = false
    for (const item of items) {
      if (!item.variantId) continue
      const [variant] = await tx
        .update(schema.productVariants)
        .set({ stock: sql`${schema.productVariants.stock} - ${item.quantity}` })
        .where(eq(schema.productVariants.id, item.variantId))
        .returning({ stock: schema.productVariants.stock })
      if (!variant) continue
      // Units that really came out of stock: fewer than ordered if it oversold.
      let taken = item.quantity
      if (variant.stock < 0) {
        stockIssue = true
        taken = Math.max(0, item.quantity + variant.stock)
        await tx.update(schema.productVariants).set({ stock: 0 }).where(eq(schema.productVariants.id, item.variantId))
      }
      await tx.update(schema.orderItems).set({ stockTaken: taken }).where(eq(schema.orderItems.id, item.id))
    }

    const [updated] = await tx
      .update(schema.orders)
      .set({
        status: 'paid',
        paidAt: txn.paidAt ? new Date(txn.paidAt) : new Date(),
        paymentReference: reference,
        paymentChannel: txn.channel,
        stockIssue,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id))
      .returning()
    return { order: updated, newlyPaid: true, newIssue: null }
  })
}

/**
 * Before a pending order is paid later (from its order page), check it still
 * matches the shop: not too old, items available at the same price, the same
 * delivery fee (or pickup still offered) and the same coupon saving. Returns
 * what changed, or null if it can still be paid.
 */
export async function pendingOrderProblem(order: Order & { items: OrderItem[] }): Promise<string | null> {
  if (Date.now() - order.createdAt.getTime() > PENDING_ORDER_DAYS * 86_400_000) {
    return 'This order has expired.'
  }
  const db = getDb()
  const variantIds = order.items.map((i) => i.variantId).filter((id): id is number => id !== null)
  if (variantIds.length !== order.items.length) return 'An item in this order is no longer available.'
  const rows = await db
    .select({ variant: schema.productVariants, product: schema.products })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(inArray(schema.productVariants.id, variantIds))
  for (const item of order.items) {
    const row = rows.find((r) => r.variant.id === item.variantId)
    if (!row || row.product.status !== 'active') return `${item.productName} is no longer available.`
    if (row.product.priceKobo !== item.unitPriceKobo) return `The price of ${item.productName} has changed.`
    if (row.variant.stock < item.quantity)
      return `${item.productName} (${item.variantLabel}) no longer has enough stock.`
  }
  if (order.fulfillment === 'pickup') {
    if (!pickupEnabled(await getSettings())) return 'Pickup at the shop isn’t available any more.'
  } else {
    const rate = findRate(
      await readShippingRates(),
      order.shipCountry,
      order.shipCountry === 'NG' ? order.shipRegion : '',
    )
    if (!rate || rate.feeKobo !== order.shippingKobo) return 'The delivery fee for this address has changed.'
  }
  return orderCouponProblem(order)
}

/** Cancels a pending order that can no longer be paid as it stands. */
export async function cancelPendingOrder(orderId: number): Promise<void> {
  await getDb()
    .update(schema.orders)
    .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))
}

export async function getOrderWithItems(where: { id: number } | { number: string }) {
  const db = getDb()
  const order = await db.query.orders.findFirst({
    where: 'id' in where ? eq(schema.orders.id, where.id) : eq(schema.orders.number, where.number),
    with: { items: { orderBy: [asc(schema.orderItems.id)] } },
  })
  return order ?? null
}
