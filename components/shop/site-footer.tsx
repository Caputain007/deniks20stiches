import Link from 'next/link'
import { getSettings, mapsLink, whatsappLink, type ShopSettings } from '@/lib/settings'
import { siteUrl } from '@/lib/site-url'

/** Tells search engines where the shop is and how to reach it. */
function storeJsonLd(settings: ShopSettings) {
  const base = siteUrl()
  const instagram = settings.instagram.replace(/^@/, '').trim()
  const sameAs = [settings.facebook, instagram && `https://instagram.com/${instagram}`].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    name: 'Deniks20 Stitches',
    description: 'Malaysian hijabs, modest ready-to-wear, abayas and bespoke tailoring.',
    ...(base ? { url: base, image: `${base}/brand/editorial.webp` } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.address
      ? { address: { '@type': 'PostalAddress', streetAddress: settings.address, addressCountry: 'NG' } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export async function SiteFooter() {
  const settings = await getSettings()
  const wa = whatsappLink(settings.whatsapp, 'Hello Deniks20 Stitches, I have a question.')
  const instagram = settings.instagram.replace(/^@/, '').trim()
  const maps = mapsLink(settings.address)

  return (
    <footer className="mt-24 bg-blush">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd(settings)).replace(/</g, '\\u003c') }}
      />
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="font-display text-2xl">Deniks20 Stitches</p>
          <p className="mt-3 text-muted">
            Malaysian hijabs, modest ready-to-wear and abayas, with bespoke tailoring on request. We deliver across
            Nigeria and abroad.
          </p>
        </div>
        <div>
          <h2 className="font-sans text-sm font-bold">Get in touch</h2>
          <ul className="mt-3 space-y-2">
            {wa && (
              <li>
                <a href={wa} className="hover:text-plum">
                  WhatsApp us
                </a>
              </li>
            )}
            {settings.phone && (
              <li>
                <a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`} className="hover:text-plum">
                  {settings.phone}
                </a>
              </li>
            )}
            {settings.email && (
              <li>
                <a href={`mailto:${settings.email}`} className="break-all hover:text-plum">
                  {settings.email}
                </a>
              </li>
            )}
            {instagram && (
              <li>
                <a href={`https://instagram.com/${instagram}`} className="hover:text-plum">
                  Instagram @{instagram}
                </a>
              </li>
            )}
            {settings.facebook && (
              <li>
                <a href={settings.facebook} className="hover:text-plum">
                  Facebook
                </a>
              </li>
            )}
          </ul>
        </div>
        {settings.address && (
          <div>
            <h2 className="font-sans text-sm font-bold">Visit the shop</h2>
            <address className="mt-3 not-italic">{settings.address}</address>
            {settings.hours && <p className="mt-2 text-muted">{settings.hours}</p>}
            {maps && (
              <a href={maps} className="mt-2 inline-block hover:text-plum" target="_blank" rel="noopener noreferrer">
                Get directions
              </a>
            )}
          </div>
        )}
        <div>
          <h2 className="font-sans text-sm font-bold">Help</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/track" className="hover:text-plum">
                Track an order
              </Link>
            </li>
            <li>
              <Link href="/measurements" className="hover:text-plum">
                Know your measurements
              </Link>
            </li>
            <li>
              <Link href="/measurements/send" className="hover:text-plum">
                Send us your measurements
              </Link>
            </li>
            <li>
              <Link href="/bespoke" className="hover:text-plum">
                Bespoke tailoring
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap">
        <div className="flex flex-wrap justify-between gap-3 border-t border-line py-6 text-sm text-muted">
          <span>© Deniks20 Stitches</span>
          <span>Payments are processed securely by Paystack.</span>
        </div>
      </div>
    </footer>
  )
}
