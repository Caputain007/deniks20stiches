'use client'

import { useState, useTransition } from 'react'

type Result = { ok?: boolean; message?: string; error?: string } | null

/** One button per status; the current one is stitched. Stays on screen after a change, with its message. */
export function StatusSwitch<T extends string>({
  label,
  value,
  options,
  action,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  action: (next: T) => Promise<Result>
}) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Result>(null)
  return (
    <div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const current = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={current}
              disabled={pending || current}
              onClick={() =>
                startTransition(async () => {
                  setResult(await action(option.value))
                })
              }
              className="btn btn-quiet btn-sm aria-pressed:border-plum aria-pressed:text-plum aria-pressed:stitched aria-pressed:opacity-100 disabled:cursor-default"
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-sm">
        {result?.error && <span className="font-semibold text-rose">{result.error}</span>}
        {result?.message && !result.error && <span className="text-leaf">{result.message}</span>}
      </p>
    </div>
  )
}
