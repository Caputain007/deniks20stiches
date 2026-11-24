import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getDb, schema } from './db'
import { parseSizeChart, type SizeChartRow } from './size-chart'

/** Edited together on Admin → Settings. */
export const SHOP_DETAIL_FIELDS = {
  whatsapp: 'WhatsApp number',
  phone: 'Phone number shown on the site',
  email: 'Contact email',
  address: 'Shop address',
  hours: 'Opening hours',
  instagram: 'Instagram handle',
  facebook: 'Facebook page',
  checkoutNote: 'Note shown at checkout',
} as const

/** Saved from their own admin pages (Delivery and Measurements). */
const OTHER_KEYS = ['pickupEnabled', 'pickupNote', 'sizeChart'] as const

export type ShopDetailKey = keyof typeof SHOP_DETAIL_FIELDS
export type SettingKey = ShopDetailKey | (typeof OTHER_KEYS)[number]
export type ShopSettings = Record<SettingKey, string>

export const SETTINGS_TAG = 'settings'

export async function getSettings(): Promise<ShopSettings> {
  'use cache'
  cacheTag(SETTINGS_TAG)
  cacheLife('max')

  const rows = await getDb().select().from(schema.settings)
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const result = {} as ShopSettings
  for (const key of [...Object.keys(SHOP_DETAIL_FIELDS), ...OTHER_KEYS] as SettingKey[]) result[key] = values[key] ?? ''
  return result
}

export function pickupEnabled(settings: ShopSettings): boolean {
  return settings.pickupEnabled === '1' && settings.address.trim() !== ''
}

export function sizeChart(settings: ShopSettings): SizeChartRow[] {
  return parseSizeChart(settings.sizeChart)
}

/** wa.me link for a WhatsApp number typed in any common format. */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 8) return null
  const intl = digits.startsWith('0') ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** wa.me link that lets the customer pick who to send the text to. */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Google Maps search for the shop's address. */
export function mapsLink(address: string): string | null {
  return address.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null
}
