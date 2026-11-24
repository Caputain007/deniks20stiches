'use client'

import Link from 'next/link'
import { useState } from 'react'
import { fromInches, parseMeasure, roundForUnit, toInches, UNIT_LABELS, type Unit } from '@/lib/measurements'
import { CHART_MEASURES, suggestSize, type ChartMeasure, type SizeChartRow } from '@/lib/size-chart'
import { UnitToggle } from './unit-toggle'

const LABELS: Record<ChartMeasure, string> = { bust: 'Bust', waist: 'Waist', hips: 'Hips' }

/** "hips" is plural on its own; "bust and waist" is plural together. */
const plural = (items: string[]) => items.length > 1 || items[0] === 'hips'

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

export function SizeFinder({ chart }: { chart: SizeChartRow[] }) {
  const [unit, setUnit] = useState<Unit>('in')
  const [values, setValues] = useState<Record<ChartMeasure, string>>({ bust: '', waist: '', hips: '' })

  const inches: Partial<Record<ChartMeasure, number>> = {}
  for (const m of CHART_MEASURES) {
    const n = parseMeasure(values[m])
    if (n !== null) inches[m] = toInches(n, unit)
  }
  const suggestion = suggestSize(chart, inches)
  const show = (n: number) => roundForUnit(fromInches(n, unit), unit)

  const changeUnit = (next: Unit) => {
    setValues((v) => {
      const out = { ...v }
      for (const m of CHART_MEASURES) {
        const n = parseMeasure(v[m])
        if (n !== null) out[m] = String(roundForUnit(fromInches(toInches(n, unit), next), next))
      }
      return out
    })
    setUnit(next)
  }

  let result: React.ReactNode = 'Enter your measurements to see your size.'
  if (suggestion.kind === 'size') {
    const bySize = new Map<string, string[]>()
    for (const m of CHART_MEASURES) {
      const size = suggestion.perMeasure[m]
      if (size) bySize.set(size, [...(bySize.get(size) ?? []), LABELS[m].toLowerCase()])
    }
    result = (
      <>
        <span className="block font-display text-3xl text-plum">Size {suggestion.size}</span>
        {bySize.size > 1 && (
          <span className="mt-1 block text-ink/85">
            Your{' '}
            {[...bySize.entries()]
              .map(([size, ms]) => `${list(ms)} ${plural(ms) ? 'fit' : 'fits'} ${size}`)
              .join(', your ')}
            . Size {suggestion.size} fits them all.
          </span>
        )}
      </>
    )
  } else if (suggestion.kind === 'too-big') {
    result = (
      <span className="block text-ink/85">
        Your {list(suggestion.over.map((m) => LABELS[m].toLowerCase()))}{' '}
        {plural(suggestion.over.map((m) => LABELS[m].toLowerCase())) ? 'are' : 'is'} bigger than our largest size. We
        can make it to fit you:{' '}
        <Link href="/measurements/send" className="font-semibold text-plum">
          send us your measurements
        </Link>
        .
      </span>
    )
  }

  return (
    <section id="size-chart" aria-labelledby="size-title" className="mt-20 scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="size-title" className="text-3xl sm:text-4xl">
            Find your size
          </h2>
          <p className="mt-2 max-w-[56ch] text-muted">
            Enter your bust, waist and hips. We suggest the smallest size that fits all three.
          </p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[22rem_1fr] lg:gap-14">
        <div>
          <div className="grid grid-cols-3 gap-3">
            {CHART_MEASURES.map((m) => (
              <div key={m}>
                <label htmlFor={`fs-${m}`} className="field-label">
                  {LABELS[m]}
                </label>
                <input
                  id={`fs-${m}`}
                  inputMode="decimal"
                  className="field"
                  value={values[m]}
                  onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                  placeholder={unit}
                  aria-describedby="fs-result"
                />
              </div>
            ))}
          </div>
          <p id="fs-result" aria-live="polite" className="mt-6 min-h-20">
            {result}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse bg-white text-left ring-1 ring-line">
            <caption className="sr-only">Size chart in {UNIT_LABELS[unit]}</caption>
            <thead>
              <tr className="border-b border-line text-sm">
                <th scope="col" className="px-4 py-3 font-bold">
                  Size
                </th>
                {CHART_MEASURES.map((m) => (
                  <th key={m} scope="col" className="px-4 py-3 font-bold">
                    {LABELS[m]} ({unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.map((row, i) => {
                const picked = suggestion.kind === 'size' && suggestion.index === i
                return (
                  <tr
                    key={row.size}
                    aria-current={picked ? 'true' : undefined}
                    className={`border-b border-line last:border-0 ${picked ? 'stitched bg-blush text-plum' : ''}`}
                  >
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {row.size}
                    </th>
                    {CHART_MEASURES.map((m) => (
                      <td key={m} className="px-4 py-3 tabular-nums">
                        {show(row[m])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">
            These are body measurements. Between two sizes? Choose the larger one, or send us your measurements and
            we’ll advise.
          </p>
        </div>
      </div>
    </section>
  )
}
