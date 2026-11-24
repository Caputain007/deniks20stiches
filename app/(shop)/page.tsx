/* eslint-disable @next/next/no-img-element -- product photos are already resized on upload */
import Image from 'next/image'
import Link from 'next/link'
import { BannerLink } from '@/components/shop/banner-link'
import { ProductGrid } from '@/components/shop/product-card'
import { getLiveBanners } from '@/lib/banners'
import { getCatalog } from '@/lib/catalog'
import { getSettings, pickupEnabled, whatsappLink } from '@/lib/settings'
import editorial from '@/public/brand/editorial.webp'

export default async function HomePage() {
  const [{ categories, products }, settings, { hero }] = await Promise.all([
    getCatalog(),
    getSettings(),
    getLiveBanners(),
  ])
  const featured = products.filter((p) => p.featured)
  const showcase = (featured.length >= 4 ? featured : products).slice(0, 8)
  const shelves = categories
    .filter((c) => c.productCount > 0)
    .map((c) => ({ ...c, cover: products.find((p) => p.category?.slug === c.slug)?.images[0] }))
  const wa = whatsappLink(settings.whatsapp, "Hello Deniks20 Stitches, I'd like to ask about your collection.")

  return (
    <>
      <section className="wrap grid pt-6 md:grid-cols-[5fr_7fr] md:pt-10">
        <div className="order-2 flex flex-col justify-center bg-blush px-6 py-10 md:order-1 md:px-12 md:py-16">
          <h1 className="text-[2.6rem] leading-[1.05] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
            {hero?.title || 'Modest style for every day'}
          </h1>
          <p className="mt-6 max-w-[36ch] whitespace-pre-line text-lg text-ink/85">
            {hero
              ? hero.body
              : 'Ready-to-wear outfits, Malaysian hijabs and abayas, delivered across Nigeria and abroad. Bespoke tailoring on request.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {hero?.linkUrl ? (
              <BannerLink href={hero.linkUrl} className="btn btn-primary">
                {hero.linkLabel || 'Shop now'}
              </BannerLink>
            ) : (
              <Link href="/shop" className="btn btn-primary">
                Shop the collection
              </Link>
            )}
            {wa && (
              <a href={wa} className="btn btn-secondary">
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="relative order-1 aspect-[3/2] md:order-2 md:aspect-auto md:min-h-[34rem]">
          {hero?.imageUrl ? (
            <img
              src={hero.imageUrl}
              alt=""
              width={hero.imageWidth ?? undefined}
              height={hero.imageHeight ?? undefined}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              src={editorial}
              alt="Two women wearing a deep plum and a dusty rose hijab with matching embroidered modest dresses"
              fill
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover"
              placeholder="blur"
            />
          )}
        </div>
      </section>

      {shelves.length > 1 && (
        <section className="wrap mt-20" aria-labelledby="categories-title">
          <h2 id="categories-title" className="text-3xl sm:text-4xl">
            Shop by category
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {shelves.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop/${c.slug}`} className="group block no-underline">
                  <div className="aspect-[3/4] overflow-hidden bg-blush">
                    {c.cover && (
                      <img
                        src={c.cover.thumbUrl}
                        alt=""
                        width={c.cover.width}
                        height={c.cover.height}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <p className="mt-3 font-display text-xl group-hover:text-plum">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.productCount} {c.productCount === 1 ? 'piece' : 'pieces'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="wrap mt-20" aria-labelledby="new-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="new-title" className="text-3xl sm:text-4xl">
            {featured.length >= 4 ? 'Our picks' : 'New in'}
          </h2>
          {products.length > showcase.length && (
            <Link href="/shop" className="font-semibold text-plum">
              See all {products.length} pieces
            </Link>
          )}
        </div>
        <div className="mt-8">
          {showcase.length > 0 ? (
            <ProductGrid products={showcase} />
          ) : (
            <div className="border border-dashed border-line px-6 py-14 text-center">
              <p className="font-display text-2xl">The new collection is on its way</p>
              <p className="mx-auto mt-3 max-w-md text-muted">
                We’re photographing the latest pieces. Message us on WhatsApp to ask what’s available today.
              </p>
              {wa && (
                <a href={wa} className="btn btn-primary mt-6">
                  Chat on WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="wrap mt-24">
        <div className="grid gap-px bg-line md:grid-cols-2">
          <div className="bg-plum px-6 py-12 text-white md:px-12">
            <h2 className="text-3xl">Bespoke tailoring</h2>
            <p className="mt-4 max-w-[46ch] text-white/85">
              Have a style in mind, or need a piece in your exact measurements? Measure yourself with our guide, send us
              the numbers, and we’ll agree fabric, fit and price with you on WhatsApp.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/bespoke" className="btn border-white bg-white text-plum hover:bg-blush">
                How bespoke works
              </Link>
              <Link href="/measurements" className="btn border-white/70 text-white hover:bg-plum-deep">
                Measuring guide
              </Link>
            </div>
          </div>
          <div className="bg-mist px-6 py-12 md:px-12">
            <h2 className="text-3xl">Delivery and payment</h2>
            <ul className="mt-4 space-y-3 text-ink/85">
              <li>We deliver across Nigeria and abroad.</li>
              <li>Your delivery fee is shown at checkout, before you pay.</li>
              {pickupEnabled(settings) && <li>Or collect your order free from our shop: {settings.address}.</li>}
              <li>Pay securely with Paystack: card, bank transfer or USSD.</li>
            </ul>
            <Link href="/track" className="mt-6 inline-block font-semibold text-plum">
              Track an order
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
