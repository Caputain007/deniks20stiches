import { Suspense } from 'react'
import { MeasurementTabs, MeasurementTabsFallback } from '@/components/shop/measurement-tabs'

export default function MeasurementsLayout({ children }: LayoutProps<'/measurements'>) {
  return (
    <div className="wrap pt-8">
      <Suspense fallback={<MeasurementTabsFallback />}>
        <MeasurementTabs />
      </Suspense>
      {children}
    </div>
  )
}
