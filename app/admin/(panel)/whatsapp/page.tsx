/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyButton } from '@/components/admin/order-forms'
import { formatDate, PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getCatalog } from '@/lib/catalog'
import { formatNaira } from '@/lib/money'
import { getOrigin } from '@/lib/origin'

export const metadata: Metadata = { title: 'WhatsApp catalogue' }

export default async function WhatsappCatalogPage() {
  await requireAdmin()
  const [{ products }, origin] = await Promise.all([getCatalog(), getOrigin()])
  const feedUrl = `${origin}/feeds/meta-catalog.csv`
  const byChange = [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader title="WhatsApp catalogue" />
      <p className="-mt-4 mb-8 max-w-2xl text-muted">
        Keep the prices in your WhatsApp catalogue the same as the website. Each product here links to its page on the
        website, where customers can pay with Paystack.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <Panel title={`Add products in the WhatsApp Business app (${products.length})`}>
          <p className="text-sm text-muted">
            In WhatsApp Business, open <strong className="text-ink">Business tools → Catalogue → Add new item</strong>.
            Copy each field from here, save the photos from the links, and paste the website link so customers can pay
            online. Products you changed most recently are first.
          </p>
          {byChange.length === 0 ? (
            <p className="mt-6 text-muted">
              No live products yet.{' '}
              <Link href="/admin/products/new" className="font-semibold">
                Add a product
              </Link>
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-line">
              {byChange.map((p) => {
                const link = `${origin}/products/${p.slug}`
                const description = [p.description, ...p.details].filter(Boolean).join('\n')
                return (
                  <li key={p.id} className="grid gap-4 py-5 first:pt-0 sm:grid-cols-[5rem_1fr]">
                    <img src={p.images[0].thumbUrl} alt="" className="h-24 w-20 bg-blush object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm">
                        {formatNaira(p.priceKobo)}
                        {p.compareAtKobo && <span className="text-muted"> (was {formatNaira(p.compareAtKobo)})</span>}
                        {!p.inStock && <span className="font-semibold text-rose"> Sold out</span>}
                        <span className="text-muted">. Changed {formatDate(new Date(p.updatedAt))}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyButton text={p.name} label="Copy name" />
                        <CopyButton text={String(p.priceKobo / 100)} label="Copy price" />
                        {description && <CopyButton text={description} label="Copy description" />}
                        <CopyButton text={link} label="Copy link" />
                      </div>
                      <p className="mt-3 text-sm">
                        Photos:{' '}
                        {p.images.map((image, i) => (
                          <span key={image.url}>
                            {i > 0 && ', '}
                            <a href={image.url} target="_blank" rel="noopener" className="font-semibold">
                              {i + 1}
                            </a>
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Sharing links in chats">
            <p className="text-sm">
              Paste a product link into a WhatsApp chat, group or status and it shows the photo, name and price.
              Customers tap it to open the product and pay.
            </p>
          </Panel>
          <Panel title="Automatic updates through Meta">
            <p className="text-sm">
              Meta catalogues (for Facebook, Instagram and WhatsApp numbers managed in Meta Business Suite) can read
              this link on a schedule, so new products and price changes arrive on their own.
            </p>
            <p className="mt-3 break-all bg-mist px-3 py-2 text-sm">{feedUrl}</p>
            <div className="mt-3">
              <CopyButton text={feedUrl} label="Copy feed link" />
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>In Meta Commerce Manager, open your catalogue, or create one for e-commerce products.</li>
              <li>
                Go to <strong>Catalogue → Data sources → Data feed</strong>, choose a scheduled feed and paste the link.
                Set it to update every day.
              </li>
              <li>
                If your WhatsApp number is managed in WhatsApp Manager, connect the catalogue there under{' '}
                <strong>Account tools → Catalogue</strong>. Otherwise use the list on this page in the WhatsApp Business
                app.
              </li>
            </ol>
          </Panel>
        </div>
      </div>
    </>
  )
}
