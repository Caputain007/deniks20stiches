'use server'

import { and, asc, count, desc, eq, like, or, sql } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { CATALOG_TAG } from '@/lib/catalog'
import { getDb, schema } from '@/lib/db'
import { MIN_PRODUCT_PHOTOS, PRODUCT_STATUSES, type ProductStatus } from '@/lib/db/schema'
import { publishBlockers } from '@/lib/admin-queries'
import { parseNairaToKobo } from '@/lib/money'
import { slugify } from '@/lib/slug'
import { deleteStoredFiles, isStoredPhotoUrl } from '@/lib/storage'

export type ActionState = { ok?: boolean; message?: string; error?: string } | null
export type SizesState = (ActionState & { sizes?: { id: number; label: string; stock: number }[] }) | null

function changed() {
  updateTag(CATALOG_TAG) // the shop shows the change on the next visit
  refresh() // and this admin page re-renders with fresh data
}

async function uniqueSlug(base: string, exceptId?: number): Promise<string> {
  const rows = await getDb()
    .select({ slug: schema.products.slug, id: schema.products.id })
    .from(schema.products)
    .where(or(eq(schema.products.slug, base), like(schema.products.slug, `${base}-%`)))
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

async function categoryIdOrNull(value: FormDataEntryValue | null): Promise<number | null> {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  const [row] = await getDb()
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
  return row?.id ?? null
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the product a name.' }
  const priceKobo = parseNairaToKobo(String(formData.get('price') ?? ''))
  if (priceKobo === null || priceKobo <= 0) return { error: 'Enter the price in naira, e.g. 25000.' }

  const [product] = await getDb()
    .insert(schema.products)
    .values({
      name: name.slice(0, 120),
      slug: await uniqueSlug(slugify(name)),
      priceKobo,
      categoryId: await categoryIdOrNull(formData.get('categoryId')),
    })
    .returning({ id: schema.products.id })
  // Every piece starts with one size; rename it or add more on the next page.
  await getDb().insert(schema.productVariants).values({ productId: product.id, label: 'One size', stock: 0 })
  redirect(`/admin/products/${product.id}?created=1`)
}

const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Give the product a name.').max(120),
  slug: z.string().trim().max(80),
  description: z.string().trim().max(4000),
  details: z.string().trim().max(2000),
})

export async function saveProductDetails(
  productId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const parsed = detailsSchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
    details: formData.get('details') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const priceKobo = parseNairaToKobo(String(formData.get('price') ?? ''))
  if (priceKobo === null || priceKobo <= 0) return { error: 'Enter the price in naira, e.g. 25000.' }
  const compareRaw = String(formData.get('compareAt') ?? '').trim()
  const compareAtKobo = compareRaw ? parseNairaToKobo(compareRaw) : null
  if (compareRaw && compareAtKobo === null) return { error: 'The "was" price must be an amount in naira, or empty.' }
  if (compareAtKobo !== null && compareAtKobo <= priceKobo) {
    return { error: 'The "was" price must be higher than the price, or leave it empty.' }
  }

  const slug = await uniqueSlug(slugify(parsed.data.slug || parsed.data.name), productId)
  await getDb()
    .update(schema.products)
    .set({
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      details: parsed.data.details,
      priceKobo,
      compareAtKobo,
      categoryId: await categoryIdOrNull(formData.get('categoryId')),
      featured: formData.get('featured') === 'on',
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, productId))
  changed()
  const requested = slugify(parsed.data.slug || parsed.data.name)
  return {
    ok: true,
    message:
      slug === requested
        ? 'Changes saved.'
        : `Changes saved. That web address was taken, so it's now /products/${slug}.`,
  }
}

export async function setProductStatus(productId: number, status: ProductStatus): Promise<ActionState> {
  await requireAdmin()
  if (!Number.isInteger(productId) || !PRODUCT_STATUSES.includes(status)) return { error: 'Unknown status.' }
  if (status === 'active') {
    const blockers = await publishBlockers(productId)
    if (blockers.length) return { error: blockers.join(' ') }
  }
  await getDb().update(schema.products).set({ status, updatedAt: new Date() }).where(eq(schema.products.id, productId))
  changed()
  const messages = {
    active: 'Published. It’s live in the shop.',
    draft: 'Moved to drafts. It’s hidden from the shop.',
    archived: 'Archived. It’s hidden from the shop.',
  }
  return { ok: true, message: messages[status] }
}

export async function deleteProduct(productId: number): Promise<ActionState> {
  await requireAdmin()
  const db = getDb()
  const images = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, productId))
  await db.delete(schema.products).where(eq(schema.products.id, productId))
  await deleteStoredFiles(images.flatMap((i) => [i.url, i.thumbUrl]))
  updateTag(CATALOG_TAG)
  redirect('/admin/products?deleted=1')
}

const imageSchema = z.object({
  url: z.string().max(500).refine(isStoredPhotoUrl, 'Unexpected photo address.'),
  thumbUrl: z.string().max(500).refine(isStoredPhotoUrl, 'Unexpected photo address.'),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
})

export async function addProductImage(productId: number, image: unknown): Promise<ActionState> {
  await requireAdmin()
  const parsed = imageSchema.safeParse(image)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const db = getDb()
  const [last] = await db
    .select({ position: schema.productImages.position })
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, productId))
    .orderBy(desc(schema.productImages.position))
    .limit(1)
  await db.insert(schema.productImages).values({ productId, ...parsed.data, position: (last?.position ?? -1) + 1 })
  changed()
  return { ok: true }
}

export async function saveImageAlt(imageId: number, alt: string): Promise<ActionState> {
  await requireAdmin()
  await getDb()
    .update(schema.productImages)
    .set({ alt: String(alt).trim().slice(0, 200) })
    .where(eq(schema.productImages.id, imageId))
  changed()
  return { ok: true, message: 'Description saved.' }
}

/** Moves a photo one place earlier (-1) or later (1). The first photo is the cover. */
export async function moveImage(imageId: number, direction: -1 | 1): Promise<ActionState> {
  await requireAdmin()
  if (!Number.isInteger(imageId) || (direction !== -1 && direction !== 1)) return { error: 'Unknown move.' }
  const db = getDb()
  const [image] = await db.select().from(schema.productImages).where(eq(schema.productImages.id, imageId))
  if (!image) return { error: 'Photo not found.' }
  const all = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, image.productId))
    .orderBy(asc(schema.productImages.position), asc(schema.productImages.id))
  const index = all.findIndex((i) => i.id === imageId)
  const target = index + direction
  if (target < 0 || target >= all.length) return { ok: true }
  const order = [...all]
  ;[order[index], order[target]] = [order[target], order[index]]
  await db.transaction(async (tx) => {
    for (const [position, img] of order.entries()) {
      if (img.position !== position) {
        await tx.update(schema.productImages).set({ position }).where(eq(schema.productImages.id, img.id))
      }
    }
  })
  changed()
  return { ok: true }
}

export async function deleteImage(imageId: number): Promise<ActionState> {
  await requireAdmin()
  const db = getDb()
  const [image] = await db.select().from(schema.productImages).where(eq(schema.productImages.id, imageId))
  if (!image) return { ok: true }
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, image.productId))
  const [{ photos }] = await db
    .select({ photos: count() })
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, image.productId))
  if (product?.status === 'active' && photos <= MIN_PRODUCT_PHOTOS) {
    return {
      error: `Live products need at least ${MIN_PRODUCT_PHOTOS} photos. Upload the replacement first, then delete this one.`,
    }
  }
  await db.delete(schema.productImages).where(eq(schema.productImages.id, imageId))
  await deleteStoredFiles([image.url, image.thumbUrl])
  changed()
  return { ok: true, message: 'Photo deleted.' }
}

const sizesSchema = z
  .array(
    z.object({
      id: z.number().int().positive().nullable(),
      label: z.string().trim().min(1, 'Every size needs a name, e.g. M or 54.').max(30),
      stock: z.number().int().min(0, 'Stock can’t be negative.').max(100000),
      /** The stock the editor showed before the admin changed it (null for new sizes). */
      loaded: z.number().int().min(0).nullable(),
    }),
  )
  .max(40)

export async function saveSizes(productId: number, sizes: unknown): Promise<SizesState> {
  await requireAdmin()
  const parsed = sizesSchema.safeParse(sizes)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const labels = parsed.data.map((s) => s.label.toLowerCase())
  if (new Set(labels).size !== labels.length) return { error: 'Two sizes have the same name.' }

  const db = getDb()
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId))
  if (!product) return { error: 'Product not found.' }
  if (product.status === 'active' && parsed.data.length === 0) {
    return { error: 'A live product needs at least one size. Move it to drafts first if you want to remove them all.' }
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, productId))
    const keep = new Set(parsed.data.map((s) => s.id).filter((id): id is number => id !== null))
    for (const old of existing) {
      if (!keep.has(old.id)) await tx.delete(schema.productVariants).where(eq(schema.productVariants.id, old.id))
    }
    // Free up labels first so renames that swap names don't clash.
    for (const [position, size] of parsed.data.entries()) {
      if (size.id && existing.some((e) => e.id === size.id)) {
        await tx
          .update(schema.productVariants)
          .set({ label: `__tmp_${size.id}`, position })
          .where(and(eq(schema.productVariants.id, size.id), eq(schema.productVariants.productId, productId)))
      }
    }
    for (const [position, size] of parsed.data.entries()) {
      if (size.id && existing.some((e) => e.id === size.id)) {
        // Apply the admin's change on top of the live number, so orders paid
        // while the page was open aren't undone.
        const stock =
          size.loaded === null
            ? size.stock
            : sql`GREATEST(${schema.productVariants.stock} + ${size.stock - size.loaded}, 0)`
        await tx
          .update(schema.productVariants)
          .set({ label: size.label, stock, position })
          .where(and(eq(schema.productVariants.id, size.id), eq(schema.productVariants.productId, productId)))
      } else {
        await tx.insert(schema.productVariants).values({ productId, label: size.label, stock: size.stock, position })
      }
    }
  })
  changed()
  const saved = await db
    .select({ id: schema.productVariants.id, label: schema.productVariants.label, stock: schema.productVariants.stock })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, productId))
    .orderBy(asc(schema.productVariants.position), asc(schema.productVariants.id))
  const movedOn = saved.filter((v) => {
    const sent = parsed.data.find((p) => p.id === v.id)
    return sent && sent.loaded !== null && v.stock !== sent.stock
  })
  return {
    ok: true,
    message: movedOn.length
      ? `Saved. Orders came in while you were editing, so stock now shows the live numbers (${movedOn
          .map((v) => `${v.label}: ${v.stock}`)
          .join(', ')}).`
      : 'Sizes and stock saved.',
    sizes: saved,
  }
}
