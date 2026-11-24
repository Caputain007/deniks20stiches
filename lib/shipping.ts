import 'server-only'
import { cacheLife, cacheTag, io } from 'next/cache'
import { getDb, schema } from './db'
import type { ShippingRate } from './shipping-rules'

export const SHIPPING_TAG = 'shipping'

/** All delivery fees, cached for the checkout page's instant quotes. */
export async function getShippingRates(): Promise<ShippingRate[]> {
  'use cache'
  cacheTag(SHIPPING_TAG)
  cacheLife('max')
  return readShippingRates()
}

/** Uncached read, used when an order is placed. */
export async function readShippingRates(): Promise<ShippingRate[]> {
  await io() // resolves at once inside "use cache" and during requests
  const rows = await getDb().select().from(schema.shippingRates)
  return rows.map((r) => ({ country: r.country, region: r.region, feeKobo: r.feeKobo, eta: r.eta }))
}
