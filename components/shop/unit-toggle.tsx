'use client'

import { useId } from 'react'
import type { Unit } from '@/lib/measurements'

export function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (unit: Unit) => void }) {
  const name = useId()
  return (
    <fieldset className="flex">
      <legend className="sr-only">Measure in</legend>
      {(['in', 'cm'] as const).map((u, i) => (
        <label key={u} className={`cursor-pointer ${i ? '-ml-px' : ''}`}>
          <input
            type="radio"
            name={name}
            value={u}
            checked={unit === u}
            onChange={() => onChange(u)}
            className="peer sr-only"
          />
          <span className="relative block border border-line bg-white px-3.5 py-2 text-sm font-semibold peer-checked:z-10 peer-checked:border-plum peer-checked:text-plum peer-checked:stitched peer-focus-visible:border-plum">
            {u === 'in' ? 'Inches' : 'Centimetres'}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
