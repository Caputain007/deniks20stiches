import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getDb, schema } from './db'

export const SETTING_FIELDS = {
  whatsapp: 'WhatsApp number',
  phone: 'Phone number shown on the site',
  email: 'Contact email',
  instagram: 'Instagram handle',
  announcement: 'Announcement bar',
  checkoutNote: 'Note shown at checkout',
} as const

export type SettingKey = keyof typeof SETTING_FIELDS
export type ShopSettings = Record<SettingKey, string>

export const SETTINGS_TAG = 'settings'

export async function getSettings(): Promise<ShopSettings> {
  'use cache'
  cacheTag(SETTINGS_TAG)
  cacheLife('max')

  const rows = await getDb().select().from(schema.settings)
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const result = {} as ShopSettings
  for (const key of Object.keys(SETTING_FIELDS) as SettingKey[]) result[key] = values[key] ?? ''
  return result
}

/** wa.me link for a WhatsApp number typed in any common format. */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 8) return null
  const intl = digits.startsWith('0') ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
