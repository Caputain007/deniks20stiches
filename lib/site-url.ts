/** The public address of the shop: SITE_URL if set, otherwise Vercel's production domain. */
export function siteUrl(): string | null {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return null
}
