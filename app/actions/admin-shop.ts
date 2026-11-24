'use server'

import { asc, count, eq, sql } from 'drizzle-orm'
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
import { getSettings, SETTING_FIELDS, SETTINGS_TAG, type SettingKey } from '@/lib/settings'
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
  const db = getDb()
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId))
  if (!order) return { error: 'Order not found.' }
  if (order.status !== 'paid' && order.status !== 'shipped')
    return { error: 'Only paid orders can be marked as shipped.' }

  const [updated] = await db
    .update(schema.orders)
    .set({ ...parsed.data, status: 'shipped', shippedAt: order.shippedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId))
    .returning()

  const notify = formData.get('notify') === 'on'
  if (notify) {
    const origin = await getOrigin()
    const settings = await getSettings()
    after(() => sendOrderShippedEmail(updated, origin, settings.email))
  }
  refresh()
  return { ok: true, message: order.status === 'shipped' ? 'Tracking details updated.' : 'Marked as shipped.' }
}

export async function setOrderStatus(
  orderId: number,
  status: 'delivered' | 'cancelled' | 'paid',
): Promise<ActionState> {
  await requireAdmin()
  const db = getDb()
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId))
  if (!order) return { error: 'Order not found.' }

  if (status === 'delivered') {
    if (order.status !== 'shipped' && order.status !== 'paid')
      return { error: 'Only paid or shipped orders can be delivered.' }
    await db
      .update(schema.orders)
      .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
    refresh()
    return { ok: true, message: 'Marked as delivered.' }
  }

  if (status === 'cancelled') {
    if (order.status === 'cancelled') return { ok: true }
    if (order.status !== 'pending' && order.status !== 'paid') {
      return { error: 'Shipped orders can’t be cancelled here. Handle the return with the customer.' }
    }
    await db.transaction(async (tx) => {
      // A paid order took stock when it was paid; give it back.
      if (order.status === 'paid') {
        const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId))
        for (const item of items) {
          if (item.variantId) {
            await tx
              .update(schema.productVariants)
              .set({ stock: sql`${schema.productVariants.stock} + ${item.quantity}` })
              .where(eq(schema.productVariants.id, item.variantId))
          }
        }
      }
      await tx
        .update(schema.orders)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
    })
    if (order.status === 'paid') updateTag(CATALOG_TAG)
    refresh()
    return {
      ok: true,
      message:
        order.status === 'paid'
          ? 'Order cancelled and its items put back in stock. Refund the customer from your Paystack dashboard.'
          : 'Order cancelled.',
    }
  }

  // Undo a mistaken "delivered": back to shipped (or paid if it never shipped).
  if (status === 'paid' && order.status === 'delivered') {
    await db
      .update(schema.orders)
      .set({ status: order.shippedAt ? 'shipped' : 'paid', deliveredAt: null, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
    refresh()
    return { ok: true, message: 'Delivery undone.' }
  }
  return { error: 'That change isn’t possible for this order.' }
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

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const values = (Object.keys(SETTING_FIELDS) as SettingKey[]).map((key) => ({
    key,
    value: String(formData.get(key) ?? '')
      .trim()
      .slice(0, key === 'checkoutNote' || key === 'announcement' ? 400 : 120),
  }))
  const email = values.find((v) => v.key === 'email')?.value
  if (email && !z.email().safeParse(email).success) return { error: 'The contact email doesn’t look right.' }
  const whatsapp = values.find((v) => v.key === 'whatsapp')?.value
  if (whatsapp && whatsapp.replace(/\D/g, '').length < 8)
    return { error: 'Enter the WhatsApp number with its country code, e.g. 2349017181181.' }

  const db = getDb()
  await db.transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(schema.settings)
        .values({ key: v.key, value: v.value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: v.value, updatedAt: new Date() } })
    }
  })
  updateTag(SETTINGS_TAG)
  refresh()
  return { ok: true, message: 'Settings saved.' }
}
