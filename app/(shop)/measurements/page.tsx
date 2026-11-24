import type { Metadata } from 'next'
import Link from 'next/link'
import { MeasureGuide } from '@/components/shop/measure-guide'
import { SizeFinder } from '@/components/shop/size-finder'
import { getSettings, sizeChart, whatsappLink } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Know your measurements',
  description:
    'How to measure your bust, waist, hips, shoulders, sleeves and length for modest outfits, and find your size at Deniks20 Stitches.',
}

export default async function MeasurementsPage() {
  const settings = await getSettings()
  const chart = sizeChart(settings)
  const wa = whatsappLink(settings.whatsapp, 'Hello Deniks20 Stitches, I have a question about measuring.')

  return (
    <>
      <h1 className="mt-8 text-4xl sm:text-5xl">Know your measurements</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink/85">
        Choose a measurement to see where the tape goes. Measure over light clothing with a soft tape measure, keep it
        snug but not tight, and write each number down as you go.
      </p>

      <MeasureGuide />

      {chart.length > 0 && <SizeFinder chart={chart} />}

      <section className="mt-20 grid gap-px bg-line md:grid-cols-2">
        <div className="bg-plum px-6 py-10 text-white md:px-10">
          <h2 className="text-3xl">Got your numbers?</h2>
          <p className="mt-3 max-w-[44ch] text-white/85">
            Send them to us for a bespoke outfit, to adjust a piece you bought, or so we know your size for next time.
          </p>
          <Link href="/measurements/send" className="btn mt-6 border-white bg-white text-plum hover:bg-blush">
            Send us your measurements
          </Link>
        </div>
        <div className="bg-white px-6 py-10 md:px-10">
          <h2 className="text-3xl">Need a hand?</h2>
          <p className="mt-3 max-w-[44ch] text-ink/85">
            Some measurements are easier with help. Ask us on WhatsApp
            {settings.address ? ', or visit the shop and we’ll measure you' : ''}.
          </p>
          {wa && (
            <a href={wa} className="btn btn-secondary mt-6">
              Ask on WhatsApp
            </a>
          )}
        </div>
      </section>
    </>
  )
}
