'use client'

import { useState, useTransition } from 'react'
import { saveSizeChart, type ActionState } from '@/app/actions/admin-measurements'
import type { SizeChartRow } from '@/lib/size-chart'
import { FormMessage } from './action-button'

type Row = { size: string; bust: string; waist: string; hips: string }
const COLUMNS = ['bust', 'waist', 'hips'] as const

export function SizeChartForm({ initial }: { initial: SizeChartRow[] }) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((r) => ({ size: r.size, bust: String(r.bust), waist: String(r.waist), hips: String(r.hips) })),
  )
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, [key]: value } : r)))

  return (
    <div>
      <p className="text-sm text-muted">
        Body measurements in inches: the largest bust, waist and hips each size fits, smallest size first. “Find your
        size” on the measurements page suggests the smallest size that fits all three.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-2 font-semibold">Size</th>
              <th className="py-2 pr-2 font-semibold">Bust (in)</th>
              <th className="py-2 pr-2 font-semibold">Waist (in)</th>
              <th className="py-2 pr-2 font-semibold">Hips (in)</th>
              <th className="py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Size name, row ${i + 1}`}
                    className="field min-h-10 w-20 py-1.5"
                    value={row.size}
                    maxLength={12}
                    onChange={(e) => update(i, 'size', e.target.value)}
                  />
                </td>
                {COLUMNS.map((col) => (
                  <td key={col} className="py-1 pr-2">
                    <input
                      aria-label={`${col} for ${row.size || `row ${i + 1}`}`}
                      className="field min-h-10 w-20 py-1.5"
                      inputMode="decimal"
                      value={row[col]}
                      onChange={(e) => update(i, col, e.target.value)}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <button
                    type="button"
                    className="px-2 text-sm font-semibold text-rose"
                    onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-plum"
        onClick={() => setRows((all) => [...all, { size: '', bust: '', waist: '', hips: '' }])}
      >
        Add a size
      </button>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-5">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setState(await saveSizeChart(rows))
            })
          }
        >
          {pending ? 'Saving…' : 'Save size chart'}
        </button>
        <FormMessage state={state} />
      </div>
    </div>
  )
}
