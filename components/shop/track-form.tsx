'use client'

import { useFormAction } from '@/components/use-form-action'
import { trackOrder } from '@/app/actions/checkout'

export function TrackForm() {
  const { state, onSubmit, pending } = useFormAction(trackOrder)
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {state?.error && (
        <p role="alert" className="border border-dashed border-rose bg-white px-4 py-3 font-semibold text-rose">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="t-number" className="field-label">
          Order number
        </label>
        <input
          id="t-number"
          name="number"
          className="field uppercase"
          placeholder="DS-XXXXXX"
          required
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="t-email" className="field-label">
          Email
        </label>
        <input id="t-email" name="email" type="email" className="field" required autoComplete="email" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Finding your order…' : 'Find my order'}
      </button>
    </form>
  )
}
