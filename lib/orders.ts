import 'server-only'
import { randomBytes } from 'node:crypto'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb, schema } from './db'
import { formatNaira } from './money'
import { initializeTransaction, verifyTransaction, type VerifiedTransaction } from './paystack'
import { readShippingRates } from './shipping'
import { findRate } from './shipping-rules'

// No 0/O or 1/I, so numbers are easy to read out on the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomCode(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length] // 256 is a multiple of 32: no bias
  return out
}

export type Order = typeof schema.orders.$inferSelect
export type OrderItem = typeof schema.orderItems.$inferSelect

export type BagLine = { variantId: number; quantity: number }

export type CheckoutInput = {
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
  lines: BagLine[]
}

/** A problem the customer can fix (shown on the checkout form). */
export class CheckoutError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause
  return (error as { code?: string })?.code === '23505' || cause?.code === '23505'
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
  const items: Omit<OrderItem, 'id' | 'orderId'>[] = []
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

  const rate = findRate(await readShippingRates(), input.country, input.country === 'NG' ? input.region : '')
  if (!rate) {
    throw new CheckoutError("We don't deliver to this address yet. Message us on WhatsApp and we'll arrange it.")
  }

  const subtotalKobo = items.reduce((sum, item) => sum + item.unitPriceKobo * item.quantity, 0)

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(schema.orders)
          .values({
            number: `DS-${randomCode(6)}`,
            accessKey: randomBytes(18).toString('base64url'),
            email: input.email,
            phone: input.phone,
            customerName: input.name,
            shipCountry: input.country,
            shipRegion: input.region,
            shipCity: input.city,
            shipAddress1: input.address1,
            shipAddress2: input.address2,
            shipPostcode: input.postcode,
            deliveryNote: input.note,
            subtotalKobo,
            shippingKobo: rate.feeKobo,
            totalKobo: subtotalKobo + rate.feeKobo,
            shippingEta: rate.eta,
          })
          .returning()
        await tx.insert(schema.orderItems).values(items.map((item) => ({ ...item, orderId: order.id })))
        return order
      })
    } catch (error) {
      if (attempt < 4 && isUniqueViolation(error)) continue // order number clash: try another
      throw error
    }
  }
}

/** Opens a Paystack checkout for a pending order and returns the URL to send the customer to. */
export async function startPayment(order: Order, origin: string): Promise<string> {
  const reference = `${order.number}-${randomCode(4)}`
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
  await getDb()
    .update(schema.orders)
    .set({ paymentReference: reference, paymentUrl: payment.authorizationUrl, updatedAt: new Date() })
    .where(eq(schema.orders.id, order.id))
  return payment.authorizationUrl
}

function withNote(existing: string, note: string): string {
  return existing ? `${existing}\n${note}` : note
}

export type FinalizeResult = { order: Order; newlyPaid: boolean }

/**
 * Marks an order paid once Paystack confirms it. Safe to call many times for the
 * same payment (redirect, webhook and retries all land here).
 */
export async function finalizePayment(
  reference: string,
  verified?: VerifiedTransaction,
): Promise<FinalizeResult | null> {
  const txn = verified ?? (await verifyTransaction(reference))
  const db = getDb()

  return db.transaction(async (tx) => {
    let [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.paymentReference, reference))
      .for('update')
    const metaNumber = typeof txn.metadata?.order_number === 'string' ? txn.metadata.order_number : null
    if (!order && metaNumber) {
      ;[order] = await tx.select().from(schema.orders).where(eq(schema.orders.number, metaNumber)).for('update')
    }
    if (!order) return null
    if (txn.status !== 'success') return { order, newlyPaid: false }

    const addNote = async (note: string) => {
      if (order.adminNotes.includes(reference)) return order
      const [updated] = await tx
        .update(schema.orders)
        .set({ adminNotes: withNote(order.adminNotes, note), updatedAt: new Date() })
        .where(eq(schema.orders.id, order.id))
        .returning()
      return updated
    }

    if (order.status === 'cancelled') {
      const updated = await addNote(
        `Payment ${reference} (${formatNaira(txn.amount)}) arrived after this order was cancelled. Refund it in Paystack or reopen the order.`,
      )
      return { order: updated, newlyPaid: false }
    }
    if (order.status !== 'pending') {
      if (order.paymentReference !== reference) {
        const updated = await addNote(
          `A second payment (${reference}, ${formatNaira(txn.amount)}) was made for this order. Refund one of them in Paystack.`,
        )
        return { order: updated, newlyPaid: false }
      }
      return { order, newlyPaid: false }
    }
    if (txn.currency !== order.currency || txn.amount !== order.totalKobo) {
      const updated = await addNote(
        `Payment ${reference} was ${formatNaira(txn.amount)} ${txn.currency}, but the order total is ${formatNaira(order.totalKobo)}. It was not marked as paid; check it in Paystack.`,
      )
      return { order: updated, newlyPaid: false }
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
      if (variant && variant.stock < 0) {
        stockIssue = true
        await tx.update(schema.productVariants).set({ stock: 0 }).where(eq(schema.productVariants.id, item.variantId))
      }
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
    return { order: updated, newlyPaid: true }
  })
}

export async function getOrderWithItems(where: { id: number } | { number: string }) {
  const db = getDb()
  const order = await db.query.orders.findFirst({
    where: 'id' in where ? eq(schema.orders.id, where.id) : eq(schema.orders.number, where.number),
    with: { items: { orderBy: [asc(schema.orderItems.id)] } },
  })
  return order ?? null
}
