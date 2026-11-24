'use client'

import { useEffect, useState, useTransition } from 'react'
import { payForOrder } from '@/app/actions/checkout'
import { useBag } from './bag-store'

export function PayNowButton({ number, accessKey, label }: { number: string; accessKey: string; label: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<{ message: string; link?: string } | null>(null)
  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await payForOrder(number, accessKey)
            if (result.ok) window.location.assign(result.redirectTo)
            else setError({ message: result.error, link: result.orderLink })
          })
        }
      >
        {pending ? 'Opening Paystack…' : label}
      </button>
      {error && (
        <p className="mt-2 text-sm font-semibold text-rose">
          {error.message}{' '}
          {error.link && (
            <a href={error.link} className="text-plum">
              Go to your bag
            </a>
          )}
        </p>
      )}
    </div>
  )
}

/** Empties the bag when the shopper lands here straight after paying. */
export function ClearBagAfterPayment() {
  const { clear } = useBag()
  useEffect(() => {
    clear()
    const url = new URL(window.location.href)
    url.searchParams.delete('paid')
    window.history.replaceState(window.history.state, '', url)
  }, [clear])
  return null
}
