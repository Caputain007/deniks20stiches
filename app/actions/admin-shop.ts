'use server'

import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { CATALOG_TAG } from '@/lib/catalog'
import { getDb, schema } from '@/lib/db'
import { sendOrderShippedEmail } from '@/lib/email'
import { isCountryCode, NIGERIAN_STATES, REST_OF_WORLD } from '@/lib/geo'
import { parseNairaToKobo } from '@/lib/money'
import { getOrigin } from '@/lib/origin'
import { getSettings, SETTINGS_TAG, SHOP_DETAIL_FIELDS, type SettingKey, type ShopDetailKey } from '@/lib/settings'
import { SHIPPING_TAG } from '@/lib/shipping'
import { slugify } from '@/lib/slug'

export type ActionState = { ok?: boolean; message?: string; error?: string } | null

/* ---------- Categories ---------- */

async function uniqueCategorySlug(base: string, exceptId?: number) {
  const rows = await getDb().select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories)
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const name = String(formData.get('name') ?? '')
    .trim()
    .slice(0, 60)
  if (name.length < 2) return { error: 'Give the category a name.' }
  const db = getDb()
  const [{ total }] = await db.select({ total: count() }).from(schema.categories)
  await db
    .insert(schema.categories)
    .values({ name, slug: await uniqueCategorySlug(slugify(name)), position: total + 1 })
  updateTag(CATALOG_TAG)
  refresh()
  return { ok: true, message: `${name} added.` }
}

export async function saveCategory(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const name = String(formData.get('name') ?? '')
    .trim()
    .slice(0, 60)
  const description = String(formData.get('description') ?? '')
    .trim()
    .slice(0, 500)
  const slugInput = String(formData.get('slug') ?? '').trim()
  if (name.length < 2) return { error: 'Give the category a name.' }
  await getDb()
    .update(schema.categories)
    .set({ name, description, slug: await uniqueCategorySlug(slugify(slugInput || name), id) })
    .where(eq(schema.categories.id, id))
  updateTag(CATALOG_TAG)
  refresh()
  return { ok: true, message: 'Saved.' }
}

export async function moveCategory(id: number, direction: -1 | 1): Promise<ActionState> {
  await requireAdmin()
  if (direction !== -1 && direction !== 1) return { error: 'Unknown move.' }
  const db = getDb()
  const all = await db
    .select()
    .from(schema.categories)
    .orderBy(asc(schema.categories.position), asc(schema.categories.name))
  const index = all.findIndex((c) => c.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= all.length) return { ok: true }
  ;[all[index], all[target]] = [all[target], all[index]]
  await db.transaction(async (tx) => {
    for (const [position, c] of all.entries()) {
      await tx
        .update(schema.categories)
        .set({ position: position + 1 })
        .where(eq(schema.categories.id, c.id))
    }
  })
  updateTag(CATALOG_TAG)
  refresh()
  return { ok: true }
}

export async function deleteCategory(id: number): Promise<ActionState> {
  await requireAdmin()
  const db = getDb()
  const [{ products }] = await db
    .select({ products: count() })
    .from(schema.products)
    .where(eq(schema.products.categoryId, id))
  if (products > 0) {
    return { error: `Move its ${products} product${products === 1 ? '' : 's'} to another category first.` }
  }
  await db.delete(schema.categories).where(eq(schema.categories.id, id))
  updateTag(CATALOG_TAG)
  refresh()
  return { ok: true, message: 'Category deleted.' }
}

/* ---------- Orders ---------- */

const shipSchema = z.object({
  courier: z.string().trim().max(80),
  trackingNumber: z.string().trim().max(120),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'The tracking link must start with https://'),
})

export async function markShipped(orderId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = shipSchema.safeParse({
    courier: formData.get('courier') ?? '',
    trackingNumber: formData.get('trackingNumber') ?? '',
    trackingUrl: formData.get('trackingUrl') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Lock the order so a payment, a cancel or a double click can't interleave with this change.
  const result = await getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update')
    if (!order) return { error: 'Order not found.' } as const
    if (order.fulfillment === 'pickup') {
      return { error: 'This order is collected from the shop. Mark it ready to collect instead.' } as const
    }
    if (order.status !== 'paid' && order.status !== 'shipped') {
      return { error: 'Only paid orders can be marked as shipped.' } as const
    }
    const [updated] = await tx
      .update(schema.orders)
      .set({ ...parsed.data, status: 'shipped', shippedAt: order.shippedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .returning()
    return { updated, wasShipped: order.status === 'shipped' } as const
  })
  if ('error' in result) return { error: result.error }

  if (formData.get('notify') === 'on') {
    const origin = await getOrigin()
    const settings = await getSettings()
    after(() => sendOrderShippedEmail(result.updated, origin, settings))
  }
  refresh()
  return { ok: true, message: result.wasShipped ? 'Tracking details updated.' : 'Marked as shipped.' }
}

/** Pickup orders: the order is packed and waiting at the shop ("shipped" in the order's status). */
export async function markReadyForPickup(
  orderId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const result = await getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update')
    if (!order) return { error: 'Order not found.' } as const
    if (order.fulfillment !== 'pickup') return { error: 'This order is being delivered, not collected.' } as const
    if (order.status === 'shipped') return { already: true } as const
    if (order.status !== 'paid') return { error: 'Only paid orders can be made ready to collect.' } as const
    const [updated] = await tx
      .update(schema.orders)
      .set({ status: 'shipped', shippedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .returning()
    return { updated } as const
  })
  if ('error' in result) return { error: result.error }
  if ('already' in result) return { ok: true, message: 'Already marked ready to collect.' }

  if (formData.get('notify') === 'on') {
    const origin = await getOrigin()
    const settings = await getSettings()
    after(() => sendOrderShippedEmail(result.updated, origin, settings))
  }
  refresh()
  return { ok: true, message: 'Marked ready to collect.' }
}

export async function setOrderStatus(
  orderId: number,
  status: 'delivered' | 'cancelled' | 'paid',
): Promise<ActionState> {
  await requireAdmin()
  if (!['delivered', 'cancelled', 'paid'].includes(status)) return { error: 'Unknown status.' }

  const outcome = await getDb().transaction(async (tx): Promise<ActionState & { restocked?: boolean }> => {
    // Lock the order: a webhook marking it paid, or a second click, waits for this change.
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update')
    if (!order) return { error: 'Order not found.' }

    if (status === 'delivered') {
      if (order.status !== 'shipped' && order.status !== 'paid') {
        return { error: 'Only paid or shipped orders can be marked as delivered.' }
      }
      await tx
        .update(schema.orders)
        .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
      return { ok: true, message: order.fulfillment === 'pickup' ? 'Marked as collected.' : 'Marked as delivered.' }
    }

    if (status === 'cancelled') {
      if (order.status === 'cancelled') return { ok: true, message: 'Order cancelled.' }
      if (order.status !== 'pending' && order.status !== 'paid') {
        return { error: 'Shipped orders can’t be cancelled here. Handle the return with the customer.' }
      }
      if (order.status === 'paid') {
        // Put back exactly what this order took from stock (less than ordered if it oversold).
        const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId))
        for (const item of items) {
          if (item.variantId && item.stockTaken > 0) {
            await tx
              .update(schema.productVariants)
              .set({ stock: sql`${schema.productVariants.stock} + ${item.stockTaken}` })
              .where(eq(schema.productVariants.id, item.variantId))
          }
          await tx.update(schema.orderItems).set({ stockTaken: 0 }).where(eq(schema.orderItems.id, item.id))
        }
      }
      await tx
        .update(schema.orders)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
      return order.status === 'paid'
        ? {
            ok: true,
            restocked: true,
            message:
              'Order cancelled and its items put back in stock. Refund the customer from your Paystack dashboard.',
          }
        : { ok: true, message: 'Order cancelled.' }
    }

    // Undo a mistaken "delivered": back to shipped (or paid if it never shipped).
    if (order.status === 'delivered') {
      await tx
        .update(schema.orders)
        .set({ status: order.shippedAt ? 'shipped' : 'paid', deliveredAt: null, updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
      return { ok: true, message: order.fulfillment === 'pickup' ? 'Collection undone.' : 'Delivery undone.' }
    }
    return { error: 'That change isn’t possible for this order.' }
  })

  if (outcome?.restocked) updateTag(CATALOG_TAG)
  if (outcome?.ok) refresh()
  return outcome ? { ok: outcome.ok, message: outcome.message, error: outcome.error } : null
}

/** Marks a payment issue (refund, duplicate, wrong amount) as dealt with. */
export async function resolvePaymentIssue(issueId: number): Promise<ActionState> {
  await requireAdmin()
  await getDb()
    .update(schema.paymentIssues)
    .set({ resolvedAt: new Date() })
    .where(and(eq(schema.paymentIssues.id, issueId), isNull(schema.paymentIssues.resolvedAt)))
  refresh()
  return { ok: true, message: 'Marked as resolved.' }
}

export async function saveOrderNotes(orderId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  await getDb()
    .update(schema.orders)
    .set({ adminNotes: String(formData.get('adminNotes') ?? '').slice(0, 4000), updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId))
  refresh()
  return { ok: true, message: 'Notes saved.' }
}

/* ---------- Delivery fees ---------- */

const rateSchema = z.object({
  country: z.string().refine((c) => c === REST_OF_WORLD || isCountryCode(c), 'Unknown country.'),
  region: z.string(),
  fee: z.string().trim(),
  eta: z.string().trim().max(60),
})

/** Replaces every delivery fee with the ones submitted from the delivery page. */
export async function saveShippingRates(rates: unknown): Promise<ActionState> {
  await requireAdmin()
  const parsed = z.array(rateSchema).max(400).safeParse(rates)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const rows: { country: string; region: string; feeKobo: number; eta: string }[] = []
  const seen = new Set<string>()
  for (const r of parsed.data) {
    if (r.fee === '') continue // empty fee = no delivery there
    const feeKobo = parseNairaToKobo(r.fee)
    if (feeKobo === null)
      return { error: `"${r.fee}" isn’t an amount in naira. Use numbers only, e.g. 3500 (0 for free delivery).` }
    if (r.region && (r.country !== 'NG' || !NIGERIAN_STATES.includes(r.region))) return { error: 'Unknown state.' }
    const key = `${r.country}|${r.region}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ country: r.country, region: r.region, feeKobo, eta: r.eta })
  }

  await getDb().transaction(async (tx) => {
    await tx.delete(schema.shippingRates)
    if (rows.length) await tx.insert(schema.shippingRates).values(rows)
  })
  updateTag(SHIPPING_TAG)
  refresh()
  return { ok: true, message: 'Delivery fees saved. Checkout uses them straight away.' }
}

/* ---------- Shop settings ---------- */

const LIMITS: Partial<Record<ShopDetailKey, number>> = { checkoutNote: 400, address: 200, facebook: 200 }

/** "facebook.com/deniks20" or a full link becomes https://facebook.com/deniks20. */
function facebookUrl(value: string): string | null {
  if (!value) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (!/(^|\.)(facebook|fb)\.com$/i.test(url.hostname)) return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

async function writeSettings(values: { key: SettingKey; value: string }[]) {
  await getDb().transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(schema.settings)
        .values({ key: v.key, value: v.value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: v.value, updatedAt: new Date() } })
    }
  })
  updateTag(SETTINGS_TAG)
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const values = (Object.keys(SHOP_DETAIL_FIELDS) as ShopDetailKey[]).map((key) => ({
    key,
    value: String(formData.get(key) ?? '')
      .trim()
      .slice(0, LIMITS[key] ?? 120),
  }))
  const get = (key: ShopDetailKey) => values.find((v) => v.key === key)!
  const email = get('email').value
  if (email && !z.email().safeParse(email).success) return { error: 'The contact email doesn’t look right.' }
  const whatsapp = get('whatsapp').value
  if (whatsapp && whatsapp.replace(/\D/g, '').length < 8)
    return { error: 'Enter the WhatsApp number with its country code, e.g. 2349017181181.' }
  const facebook = facebookUrl(get('facebook').value)
  if (facebook === null) return { error: 'The Facebook page should be a facebook.com link.' }
  get('facebook').value = facebook

  await writeSettings(values)
  refresh()
  return { ok: true, message: 'Settings saved.' }
}

export async function savePickup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const enabled = formData.get('pickupEnabled') === 'on'
  const note = String(formData.get('pickupNote') ?? '')
    .trim()
    .slice(0, 300)
  if (enabled && !(await getSettings()).address.trim()) {
    return { error: 'Add your shop address in Settings first, so customers know where to collect.' }
  }
  await writeSettings([
    { key: 'pickupEnabled', value: enabled ? '1' : '' },
    { key: 'pickupNote', value: note },
  ])
  refresh()
  return { ok: true, message: enabled ? 'Pickup is on. Customers can choose it at checkout.' : 'Pickup is off.' }
}
