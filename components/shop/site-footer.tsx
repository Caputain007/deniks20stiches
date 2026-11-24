import Link from 'next/link'
import { getSettings, whatsappLink } from '@/lib/settings'

export async function SiteFooter() {
  const settings = await getSettings()
  const wa = whatsappLink(settings.whatsapp, 'Hello Deniks20 Stitches, I have a question.')
  const instagram = settings.instagram.replace(/^@/, '').trim()

  return (
    <footer className="mt-24 bg-blush">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
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
                <a href={`mailto:${settings.email}`} className="hover:text-plum">
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
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-sm font-bold">Your order</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/track" className="hover:text-plum">
                Track an order
              </Link>
            </li>
            <li>
              <Link href="/bag" className="hover:text-plum">
                Your bag
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-plum">
                Shop all
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
