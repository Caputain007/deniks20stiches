'use client'

import { useState, useTransition } from 'react'

type Result = { ok?: boolean; message?: string; error?: string } | null | void

/**
 * Runs a Server Action from a button. With `confirm`, the first click asks
 * "are you sure?" inline instead of acting straight away.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  confirm,
  className = 'btn btn-quiet btn-sm',
}: {
  action: () => Promise<Result>
  children: React.ReactNode
  pendingLabel?: string
  confirm?: string
  className?: string
}) {
  const [pending, startTransition] = useTransition()
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState<Result>(null)

  const run = () =>
    startTransition(async () => {
      setAsking(false)
      setResult(await action())
    })

  return (
    <div className="inline-flex flex-col items-start gap-2">
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{confirm}</span>
          <button type="button" className="btn btn-danger btn-sm" onClick={run}>
            Yes
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAsking(false)}>
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={className}
          disabled={pending}
          onClick={() => (confirm ? setAsking(true) : run())}
        >
          {pending ? (pendingLabel ?? 'Working…') : children}
        </button>
      )}
      <span aria-live="polite" className="text-sm">
        {result?.error && <span className="font-semibold text-rose">{result.error}</span>}
        {result?.message && !result.error && <span className="text-leaf">{result.message}</span>}
      </span>
    </div>
  )
}

export function FormMessage({ state }: { state: { ok?: boolean; message?: string; error?: string } | null }) {
  return (
    <p aria-live="polite" className="text-sm">
      {state?.error && <span className="font-semibold text-rose">{state.error}</span>}
      {state?.ok && state.message && <span className="font-semibold text-leaf">{state.message}</span>}
    </p>
  )
}
