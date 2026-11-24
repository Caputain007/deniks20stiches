import type { Metadata } from 'next'
import Link from 'next/link'
import { MeasureFigure } from '@/components/shop/measure-figure'
import { getSettings, mapsLink, pickupEnabled, whatsappLink } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Bespoke tailoring',
  description:
    'Abayas, gowns and modest outfits made to your measurements by Deniks20 Stitches. Measure yourself, send us the numbers and agree the details on WhatsApp.',
}

export default async function BespokePage() {
  const settings = await getSettings()
  const wa = whatsappLink(settings.whatsapp, "Hello Deniks20 Stitches, I'd like to ask about bespoke tailoring.")
  const maps = mapsLink(settings.address)

  const steps = [
    {
      title: 'Measure yourself',
      text: 'Follow our measuring guide. You need a soft tape measure and about ten minutes, and a friend helps with the shoulders.',
      link: { href: '/measurements', label: 'Open the measuring guide' },
    },
    {
      title: 'Send us your measurements',
      text: 'Enter them one at a time, with a picture showing where each one goes. Tell us what you’d like made and you’ll get a reference number.',
      link: { href: '/measurements/send', label: 'Send your measurements' },
    },
    {
      title: 'Agree the details on WhatsApp',
      text: 'We message you to talk through the style, fabric, price and the date you need it. Send photos of styles you like.',
    },
    {
      title: 'We sew it for you',
      text: pickupEnabled(settings)
        ? 'Once you’ve agreed the price and paid, we make your outfit and deliver it, or you collect it from our shop.'
        : 'Once you’ve agreed the price and paid, we make your outfit and deliver it to you.',
    },
  ]

  return (
    <div className="wrap pt-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div>
          <h1 className="text-4xl sm:text-5xl">Bespoke tailoring</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-ink/85">
            We make abayas, gowns, two-piece sets and other modest outfits to your measurements. You choose the style
            and fabric; we cut and sew it to fit you.
          </p>

          <h2 className="mt-12 text-3xl">How it works</h2>
          <ol className="mt-6 space-y-8">
            {steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-plum font-display text-xl text-plum"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-sans text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 max-w-[58ch] text-ink/85">{step.text}</p>
                  {step.link && (
                    <Link href={step.link.href} className="mt-2 inline-block font-semibold text-plum">
                      {step.link.label}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/measurements/send" className="btn btn-primary">
              Send your measurements
            </Link>
            {wa && (
              <a href={wa} className="btn btn-secondary">
                Ask on WhatsApp
              </a>
            )}
          </div>

          {settings.address && (
            <section className="mt-14 max-w-xl border border-dashed border-line bg-white px-5 py-5">
              <h2 className="font-sans text-lg font-bold">Rather be measured in person?</h2>
              <p className="mt-2 text-ink/85">
                Visit our shop and we’ll take your measurements: {settings.address}.
                {settings.hours && ` Open ${settings.hours}.`}
              </p>
              {maps && (
                <a
                  href={maps}
                  className="mt-2 inline-block font-semibold text-plum"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              )}
            </section>
          )}
        </div>
        <div className="hidden lg:block">
          <MeasureFigure active="length" className="mx-auto max-w-[18rem]" />
        </div>
      </div>
    </div>
  )
}
