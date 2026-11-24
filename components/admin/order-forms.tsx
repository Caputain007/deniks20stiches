'use client'

import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { FormMessage } from './action-button'

type State = { ok?: boolean; message?: string; error?: string } | null
type FormAction = (prev: State, formData: FormData) => Promise<State>

export function ShipForm({
  action,
  defaults,
  alreadyShipped,
  canEmail,
}: {
  action: FormAction
  defaults: { courier: string; trackingNumber: string; trackingUrl: string }
  alreadyShipped: boolean
  canEmail: boolean
}) {
  const { state, onSubmit, pending } = useFormAction(action)
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="s-courier" className="field-label">
            Courier
          </label>
          <input
            id="s-courier"
            name="courier"
            defaultValue={defaults.courier}
            className="field"
            placeholder="e.g. GIG Logistics, DHL"
          />
        </div>
        <div>
          <label htmlFor="s-number" className="field-label">
            Tracking number (optional)
          </label>
          <input id="s-number" name="trackingNumber" defaultValue={defaults.trackingNumber} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="s-url" className="field-label">
          Tracking link (optional)
        </label>
        <input
          id="s-url"
          name="trackingUrl"
          type="url"
          defaultValue={defaults.trackingUrl}
          className="field"
          placeholder="https://"
        />
      </div>
      {canEmail && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked={!alreadyShipped} className="h-4 w-4 accent-plum" />
          Email the customer that it’s on its way
        </label>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : alreadyShipped ? 'Update tracking' : 'Mark as shipped'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function PickupReadyForm({
  action,
  canEmail,
  readySince,
}: {
  action: FormAction
  canEmail: boolean
  /** When the order was marked ready, or null while it's still being prepared. */
  readySince: string | null
}) {
  const { state, onSubmit, pending } = useFormAction(action)
  if (readySince) {
    return (
      <div className="space-y-2">
        <p className="text-sm">Waiting at the shop since {readySince}.</p>
        <FormMessage state={state} />
      </div>
    )
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">When the order is packed and waiting at the shop, let the customer know.</p>
      {canEmail && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-plum" />
          Email the customer that it’s ready to collect
        </label>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Mark ready to collect'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function NotesForm({ action, defaultValue }: { action: FormAction; defaultValue: string }) {
  const { state, onSubmit, pending } = useFormAction(action)
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="n-notes" className="sr-only">
        Private notes
      </label>
      <textarea
        id="n-notes"
        name="adminNotes"
        defaultValue={defaultValue}
        rows={4}
        className="field"
        placeholder="Only admins see these notes."
      />
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-quiet btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save notes'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm no-print"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

export function PrintButton({ label = 'Print packing slip' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-quiet no-print" onClick={() => window.print()}>
      {label}
    </button>
  )
}
