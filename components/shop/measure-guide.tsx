'use client'

import { useState } from 'react'
import { MEASUREMENTS, type MeasurementKey } from '@/lib/measurements'
import { MeasureFigure } from './measure-figure'

/** Pick a measurement to see where it goes on the figure and how to take it. */
export function MeasureGuide() {
  const [active, setActive] = useState<MeasurementKey>('bust')

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,25rem)_1fr] lg:gap-14">
      {/* On phones the figure stays in view while you go down the list. */}
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-mist px-5 py-2 md:-mx-8 md:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="lg:sticky lg:top-6">
          <MeasureFigure active={active} className="mx-auto h-[36vh] w-auto max-w-full lg:h-auto lg:w-full" />
        </div>
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {MEASUREMENTS.map((m) => {
          const open = m.key === active
          return (
            <li key={m.key}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`how-${m.key}`}
                onClick={() => setActive(m.key)}
                className={`flex w-full items-center justify-between gap-4 px-1 py-4 text-left text-lg ${open ? 'font-semibold text-plum' : 'hover:text-plum'}`}
              >
                {m.label}
                <span
                  aria-hidden="true"
                  className={`h-px w-8 shrink-0 ${open ? 'bg-[repeating-linear-gradient(90deg,var(--color-plum)_0_5px,transparent_5px_9px)]' : 'bg-line'}`}
                />
              </button>
              <div id={`how-${m.key}`} hidden={!open} className="px-1 pb-5">
                <p className="max-w-[56ch] text-ink/85">{m.how}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
