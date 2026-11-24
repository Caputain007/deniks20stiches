import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

// Money is stored in kobo (1 naira = 100 kobo), the unit Paystack charges in.
const kobo = (name: string) => bigint(name, { mode: 'number' })
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** A product can only be published once it has at least this many photos. */
export const MIN_PRODUCT_PHOTOS = 4

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
})

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull().default(''),
    /** One detail per line (fabric, fit, care…), shown as a list. */
    details: text('details').notNull().default(''),
    priceKobo: kobo('price_kobo').notNull().default(0),
    /** Optional "was" price, shown crossed out when higher than the price. */
    compareAtKobo: kobo('compare_at_kobo'),
    status: text('status', { enum: PRODUCT_STATUSES }).notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_status_idx').on(t.status), index('products_category_idx').on(t.categoryId)],
)

export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Large version (longest side up to 1600px). */
    url: text('url').notNull(),
    /** Small version (longest side up to 640px) for grids and thumbnails. */
    thumbUrl: text('thumb_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    alt: text('alt').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.position)],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Size label, e.g. "S", "M", "54", "One size". */
    label: text('label').notNull(),
    stock: integer('stock').notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('product_variants_product_label_idx').on(t.productId, t.label)],
)

/**
 * Delivery fees set in admin. Lookup order for an address:
 * (country, region) → (country, '') → ('ZZ', '') for the rest of the world.
 * Region is only used for Nigerian states.
 */
export const shippingRates = pgTable(
  'shipping_rates',
  {
    id: serial('id').primaryKey(),
    country: varchar('country', { length: 2 }).notNull(),
    region: text('region').notNull().default(''),
    feeKobo: kobo('fee_kobo').notNull(),
    eta: text('eta').notNull().default(''),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('shipping_rates_country_region_idx').on(t.country, t.region)],
)

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    number: text('number').notNull().unique(),
    /** Secret used in the customer's order link. */
    accessKey: text('access_key').notNull(),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    customerName: text('customer_name').notNull(),
    shipCountry: varchar('ship_country', { length: 2 }).notNull(),
    shipRegion: text('ship_region').notNull().default(''),
    shipCity: text('ship_city').notNull(),
    shipAddress1: text('ship_address1').notNull(),
    shipAddress2: text('ship_address2').notNull().default(''),
    shipPostcode: text('ship_postcode').notNull().default(''),
    /** Landmark or delivery instructions from the customer. */
    deliveryNote: text('delivery_note').notNull().default(''),
    subtotalKobo: kobo('subtotal_kobo').notNull(),
    shippingKobo: kobo('shipping_kobo').notNull(),
    totalKobo: kobo('total_kobo').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
    shippingEta: text('shipping_eta').notNull().default(''),
    paymentReference: text('payment_reference').unique(),
    paymentUrl: text('payment_url'),
    paymentChannel: text('payment_channel'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    courier: text('courier').notNull().default(''),
    trackingNumber: text('tracking_number').notNull().default(''),
    trackingUrl: text('tracking_url').notNull().default(''),
    adminNotes: text('admin_notes').notNull().default(''),
    /** Set when a paid order needed more stock than was left. */
    stockIssue: boolean('stock_issue').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('orders_status_created_idx').on(t.status, t.createdAt), index('orders_email_idx').on(t.email)],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    variantLabel: text('variant_label').notNull(),
    imageUrl: text('image_url').notNull().default(''),
    unitPriceKobo: kobo('unit_price_kobo').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
)

/** Verified payment events from Paystack, kept for troubleshooting. */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: serial('id').primaryKey(),
    reference: text('reference').notNull(),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('payment_events_reference_idx').on(t.reference)],
)

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  /** Bumped on password change so older sessions stop working. */
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: createdAt(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    ip: text('ip').notNull(),
    email: text('email').notNull(),
    success: boolean('success').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('login_attempts_ip_idx').on(t.ip, t.createdAt),
    index('login_attempts_email_idx').on(t.email, t.createdAt),
  ],
)

/** Small key/value store for shop settings editable in admin. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: updatedAt(),
})

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
}))

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}))

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}))

export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems) }))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}))
