import type { Metadata } from 'next'
import { MeasurementForm } from '@/components/shop/measurement-form'

export const metadata: Metadata = {
  title: 'Send us your measurements',
  description: 'Send Deniks20 Stitches your measurements for a bespoke outfit or an alteration, one step at a time.',
}

export default function SendMeasurementsPage() {
  return (
    <>
      <h1 className="mt-8 text-4xl sm:text-5xl">Send us your measurements</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink/85">
        One measurement at a time, with a picture showing where the tape goes. Have a soft tape measure ready; it takes
        about ten minutes.
      </p>
      <MeasurementForm />
    </>
  )
}
