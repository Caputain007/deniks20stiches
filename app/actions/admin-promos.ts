'use server'

import { count, eq } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { BANNERS_TAG, isSafeBannerLink } from '@/lib/banners'
import { isUniqueViolation } from '@/lib/codes'
import { COUPON_CODE_PATTERN, normalizeCode } from '@/lib/coupons'
import { getDb, schema } from '@/lib/db'
import { BANNER_PLACEMENTS, COUPON_KINDS, type BannerPlacement, type CouponKind } from '@/lib/db/schema'
import { fromLagosInput } from '@/lib/lagos-time'
import { parseNairaToKobo } from '@/lib/money'
import { deleteStoredFiles, isStoredPhotoUrl } from '@/lib/storage'

export type ActionState = { ok?: boolean; message?: string; error?: string } | null

const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? '')
    .trim()
    .slice(0, max)

function readDates(formData: FormData): { startsAt: Date | null; endsAt: Date | null } | { error: string } {
  const startsAt = fromLagosInput(String(formData.get('startsAt') ?? ''))
  const endsAt = fromLagosInput(String(formData.get('endsAt') ?? ''))
  if (startsAt === undefined || endsAt === undefined) return { error: 'Enter the dates as a day and a time.' }
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'The end must be after the start.' }
  return { startsAt, endsAt }
}

/* ---------- Banners ---------- */

function readBanner(formData: FormData) {
  const placement = String(formData.get('placement') ?? '') as BannerPlacement
  if (!BANNER_PLACEMENTS.includes(placement)) return { error: 'Choose where the banner goes.' } as const
  const title = text(formData, 'title', placement === 'bar' ? 160 : 90)
  if (title.length < 2) {
    return {
      error: placement === 'bar' ? 'Write the message for the bar.' : 'Write a headline for the banner.',
    } as const
  }
  const linkUrl = text(formData, 'linkUrl', 300)
  if (!isSafeBannerLink(linkUrl)) {
    return { error: 'The link should be a page on this site, like /shop/hijabs, or start with https://' } as const
  }
  const imageUrl = placement === 'hero' ? text(formData, 'imageUrl', 500) : ''
  if (imageUrl && !isStoredPhotoUrl(imageUrl)) return { error: 'Upload the picture again.' } as const
  const dimension = (key: string) => {
    const n = Number(formData.get(key))
    return imageUrl && Number.isInteger(n) && n > 0 && n < 10_000 ? n : null
  }
  const dates = readDates(formData)
  if ('error' in dates) return dates
  return {
    values: {
      placement,
      title,
      body: placement === 'hero' ? text(formData, 'body', 300) : '',
      linkLabel: text(formData, 'linkLabel', 40),
      linkUrl,
      imageUrl,
      imageWidth: dimension('imageWidth'),
      imageHeight: dimension('imageHeight'),
      active: formData.get('active') === 'on',
      ...dates,
    },
  } as const
}

function bannersChanged() {
  updateTag(BANNERS_TAG)
  refresh()
}

export async function createBanner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const banner = readBanner(formData)
  if ('error' in banner) return { error: banner.error }
  await getDb().insert(schema.banners).values(banner.values)
  bannersChanged()
  return { ok: true, message: 'Banner added.' }
}

export async function saveBanner(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const banner = readBanner(formData)
  if ('error' in banner) return { error: banner.error }
  const db = getDb()
  const [before] = await db.select().from(schema.banners).where(eq(schema.banners.id, id))
  if (!before) return { error: 'This banner was deleted.' }
  await db
    .update(schema.banners)
    .set({ ...banner.values, updatedAt: new Date() })
    .where(eq(schema.banners.id, id))
  if (before.imageUrl && before.imageUrl !== banner.values.imageUrl) await deleteStoredFiles([before.imageUrl])
  bannersChanged()
  return { ok: true, message: 'Saved.' }
}

export async function deleteBanner(id: number): Promise<ActionState> {
  await requireAdmin()
  const [deleted] = await getDb().delete(schema.banners).where(eq(schema.banners.id, id)).returning()
  if (deleted?.imageUrl) await deleteStoredFiles([deleted.imageUrl])
  bannersChanged()
  return { ok: true, message: 'Banner deleted.' }
}

/* ---------- Coupons ---------- */

export async function createCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const code = normalizeCode(String(formData.get('code') ?? ''))
  if (!COUPON_CODE_PATTERN.test(code)) {
    return { error: 'Use 3 to 30 letters and numbers for the code (dashes are fine), e.g. EID20.' }
  }
  const kind = String(formData.get('kind') ?? '') as CouponKind
  if (!COUPON_KINDS.includes(kind)) return { error: 'Choose what the code gives.' }

  let value = 0
  if (kind === 'percent') {
    value = Number(formData.get('percent'))
    if (!Number.isInteger(value) || value < 1 || value > 90) return { error: 'The percentage should be from 1 to 90.' }
  } else if (kind === 'amount') {
    const kobo = parseNairaToKobo(String(formData.get('amount') ?? ''))
    if (kobo === null || kobo <= 0) return { error: 'Enter the amount off in naira, e.g. 2000.' }
    value = kobo
  }

  const minRaw = String(formData.get('minSubtotal') ?? '').trim()
  const minSubtotalKobo = minRaw ? parseNairaToKobo(minRaw) : 0
  if (minSubtotalKobo === null) return { error: 'The minimum order should be an amount in naira, or empty.' }
  if (kind === 'amount' && minSubtotalKobo > 0 && minSubtotalKobo < value) {
    return { error: 'The minimum order should be at least the amount off.' }
  }

  const maxRaw = String(formData.get('maxUses') ?? '').trim()
  const maxUses = maxRaw ? Number(maxRaw) : null
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100_000)) {
    return { error: 'The number of uses should be a whole number, or empty for no limit.' }
  }

  const dates = readDates(formData)
  if ('error' in dates) return { error: dates.error }

  try {
    await getDb()
      .insert(schema.coupons)
      .values({
        code,
        kind,
        value,
        minSubtotalKobo,
        maxUses,
        oncePerCustomer: formData.get('oncePerCustomer') === 'on',
        note: text(formData, 'note', 200),
        ...dates,
      })
  } catch (error) {
    if (isUniqueViolation(error)) return { error: `There’s already a code called ${code}.` }
    throw error
  }
  refresh()
  return { ok: true, message: `${code} is ready to use.` }
}

export async function setCouponActive(id: number, active: boolean): Promise<ActionState> {
  await requireAdmin()
  await getDb()
    .update(schema.coupons)
    .set({ active: Boolean(active) })
    .where(eq(schema.coupons.id, id))
  refresh()
  return { ok: true, message: active ? 'Turned on.' : 'Turned off. Customers can’t use it any more.' }
}

export async function deleteCoupon(id: number): Promise<ActionState> {
  await requireAdmin()
  const db = getDb()
  const [{ orders }] = await db.select({ orders: count() }).from(schema.orders).where(eq(schema.orders.couponId, id))
  if (orders > 0) {
    return { error: `It’s on ${orders} order${orders === 1 ? '' : 's'}, so it stays on record. Turn it off instead.` }
  }
  await db.delete(schema.coupons).where(eq(schema.coupons.id, id))
  refresh()
  return { ok: true, message: 'Coupon deleted.' }
}
