import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag, io } from 'next/cache'
import { getDb, schema } from './db'

export const BANNERS_TAG = 'banners'

export type Banner = typeof schema.banners.$inferSelect
export type LiveBanner = Pick<
  Banner,
  'id' | 'title' | 'body' | 'linkLabel' | 'linkUrl' | 'imageUrl' | 'imageWidth' | 'imageHeight'
>
export type LiveBanners = { bar: LiveBanner | null; hero: LiveBanner | null }

export function isLive(banner: Pick<Banner, 'active' | 'startsAt' | 'endsAt'>, now: number): boolean {
  return (
    banner.active &&
    (!banner.startsAt || banner.startsAt.getTime() <= now) &&
    (!banner.endsAt || banner.endsAt.getTime() > now)
  )
}

/**
 * The banners showing right now, newest first. Cached until an admin edits a
 * banner, or until the next scheduled start or end, whichever comes first.
 */
export async function getLiveBanners(): Promise<LiveBanners> {
  'use cache'
  cacheTag(BANNERS_TAG)
  await io()

  const rows = await getDb()
    .select()
    .from(schema.banners)
    .where(eq(schema.banners.active, true))
    .orderBy(desc(schema.banners.updatedAt), desc(schema.banners.id))
  const now = Date.now()

  const nextChange = rows
    .flatMap((b) => [b.startsAt, b.endsAt])
    .map((d) => d?.getTime() ?? 0)
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0]
  if (nextChange) {
    const seconds = Math.max(60, Math.ceil((nextChange - now) / 1000))
    cacheLife({ stale: 300, revalidate: seconds, expire: Math.max(seconds * 2, 86_400) })
  } else {
    cacheLife('max')
  }

  const live = rows.filter((b) => isLive(b, now))
  const pick = (placement: Banner['placement']): LiveBanner | null => {
    const b = live.find((x) => x.placement === placement)
    return b
      ? {
          id: b.id,
          title: b.title,
          body: b.body,
          linkLabel: b.linkLabel,
          linkUrl: b.linkUrl,
          imageUrl: b.imageUrl,
          imageWidth: b.imageWidth,
          imageHeight: b.imageHeight,
        }
      : null
  }
  return { bar: pick('bar'), hero: pick('hero') }
}

/** Links admins can use: a page on this site ("/shop/hijabs") or a full https address. */
export function isSafeBannerLink(url: string): boolean {
  if (url === '') return true
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(url)) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}
