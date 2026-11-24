'use client'

import { useState, useTransition } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { addAdmin, changePassword } from '@/app/actions/admin-auth'
import { createCategory, saveSettings, saveShippingRates, type ActionState } from '@/app/actions/admin-shop'
import { COUNTRIES, NIGERIAN_STATES, countryName } from '@/lib/geo'
import { REST_OF_WORLD } from '@/lib/shipping-rules'
import { FormMessage } from './action-button'

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

/* ---------- Categories ---------- */

export function NewCategoryForm() {
  const { state, onSubmit, pending } = useFormAction(createCategory, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="c-new" className="field-label">
        Name
      </label>
      <input id="c-new" name="name" className="field" placeholder="e.g. Jilbabs" required />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add category'}
      </button>
      <FormMessage state={state} />
    </form>
  )
}

export function CategoryEditForm({
  action,
  category,
  first,
}: {
  action: FormAction
  category: { name: string; slug: string; description: string }
  first: boolean
}) {
  const { state, onSubmit, pending } = useFormAction(action)
  const id = category.slug
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`c-name-${id}`} className="field-label">
            Name
          </label>
          <input id={`c-name-${id}`} name="name" defaultValue={category.name} className="field" required />
        </div>
        <div>
          <label htmlFor={`c-slug-${id}`} className="field-label">
            Web address
          </label>
          <div className="flex">
            <span className="flex items-center border border-r-0 border-line bg-mist px-2 text-sm text-muted">
              /shop/
            </span>
            <input id={`c-slug-${id}`} name="slug" defaultValue={category.slug} className="field" />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor={`c-desc-${id}`} className="field-label">
          Description (optional)
        </label>
        <textarea
          id={`c-desc-${id}`}
          name="description"
          defaultValue={category.description}
          rows={2}
          className="field min-h-0"
        />
        {first && <p className="field-hint">Shown under the category name on its page.</p>}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-quiet btn-sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

/* ---------- Delivery fees ---------- */

type Rate = { country: string; region: string; fee: string; eta: string }

export function DeliveryRatesForm({ initial }: { initial: Rate[] }) {
  const find = (country: string, region: string) => initial.find((r) => r.country === country && r.region === region)
  const [nigeriaDefault, setNigeriaDefault] = useState<Rate>(
    find('NG', '') ?? { country: 'NG', region: '', fee: '', eta: '' },
  )
  const [states, setStates] = useState<Rate[]>(
    NIGERIAN_STATES.map((s) => find('NG', s) ?? { country: 'NG', region: s, fee: '', eta: '' }),
  )
  const [international, setInternational] = useState<Rate[]>(
    initial.filter((r) => r.country !== 'NG' && r.country !== REST_OF_WORLD),
  )
  const [rest, setRest] = useState<Rate>(
    find(REST_OF_WORLD, '') ?? { country: REST_OF_WORLD, region: '', fee: '', eta: '' },
  )
  const [adding, setAdding] = useState('')
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      setState(await saveShippingRates([nigeriaDefault, ...states, ...international, rest]))
    })

  const overrides = states.filter((s) => s.fee !== '').length

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-sans text-lg font-bold">Nigeria</h2>
        <p className="mt-1 text-sm text-muted">
          Set one fee for all states, then change it for any state that costs more or less. Leave a fee empty to stop
          delivering there. Use 0 for free delivery.
        </p>
        <RateRow label="All states" rate={nigeriaDefault} onChange={setNigeriaDefault} strong />
        <details className="mt-4" open={overrides > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-plum">
            Different fee for some states{overrides ? ` (${overrides} set)` : ''}
          </summary>
          <div className="mt-3 space-y-2">
            {states.map((s, i) => (
              <RateRow
                key={s.region}
                label={s.region}
                rate={s}
                placeholder={nigeriaDefault.fee ? `${nigeriaDefault.fee} (all states)` : 'No delivery'}
                onChange={(next) => setStates((all) => all.map((x, j) => (j === i ? next : x)))}
              />
            ))}
          </div>
        </details>
      </section>

      <section>
        <h2 className="font-sans text-lg font-bold">Outside Nigeria</h2>
        <p className="mt-1 text-sm text-muted">
          Add the countries you ship to. Customers pay in naira; their bank converts.
        </p>
        <div className="mt-3 space-y-2">
          {international.map((r, i) => (
            <div key={r.country} className="flex items-end gap-2">
              <div className="flex-1">
                <RateRow
                  label={countryName(r.country)}
                  rate={r}
                  onChange={(next) => setInternational((all) => all.map((x, j) => (j === i ? next : x)))}
                />
              </div>
              <button
                type="button"
                className="mb-2 px-2 text-sm font-semibold text-rose"
                onClick={() => setInternational((all) => all.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex max-w-md gap-2">
          <label htmlFor="add-country" className="sr-only">
            Add a country
          </label>
          <select id="add-country" className="field" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose a country…</option>
            {COUNTRIES.filter((c) => c.code !== 'NG' && !international.some((r) => r.country === c.code)).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={!adding}
            onClick={() => {
              setInternational((all) => [...all, { country: adding, region: '', fee: '', eta: '' }])
              setAdding('')
            }}
          >
            Add
          </button>
        </div>
        <RateRow label="Every other country" rate={rest} onChange={setRest} placeholder="No delivery" />
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save delivery fees'}
        </button>
        <FormMessage state={state} />
      </div>
    </div>
  )
}

function RateRow({
  label,
  rate,
  onChange,
  placeholder,
  strong,
}: {
  label: string
  rate: Rate
  onChange: (rate: Rate) => void
  placeholder?: string
  strong?: boolean
}) {
  const id = `${rate.country}-${rate.region || 'all'}`
  return (
    <div className={`mt-3 grid items-center gap-2 sm:grid-cols-[12rem_1fr_1fr] ${strong ? 'font-semibold' : ''}`}>
      <label htmlFor={`fee-${id}`} className="text-sm">
        {label}
      </label>
      <div className="flex">
        <span className="flex items-center border border-r-0 border-line bg-mist px-3 text-sm text-muted">₦</span>
        <input
          id={`fee-${id}`}
          inputMode="decimal"
          className="field min-h-10 py-1.5"
          value={rate.fee}
          placeholder={placeholder ?? 'No delivery'}
          onChange={(e) => onChange({ ...rate, fee: e.target.value })}
        />
      </div>
      <input
        aria-label={`Delivery time for ${label}`}
        className="field min-h-10 py-1.5"
        value={rate.eta}
        placeholder="Delivery time, e.g. 2–4 working days"
        maxLength={60}
        onChange={(e) => onChange({ ...rate, eta: e.target.value })}
      />
    </div>
  )
}

/* ---------- Shop settings ---------- */

export function ShopSettingsForm({ values }: { values: Record<string, string> }) {
  const { state, onSubmit, pending } = useFormAction(saveSettings)
  const text = (
    name: string,
    label: string,
    hint?: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`s-${name}`} className="field-label">
        {label}
      </label>
      <input id={`s-${name}`} name={name} defaultValue={values[name]} className="field" {...props} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {text(
        'whatsapp',
        'WhatsApp number',
        'With the country code and no + sign, e.g. 2349017181181. Used for every WhatsApp button.',
        { inputMode: 'tel' },
      )}
      {text('phone', 'Phone number shown in the footer', undefined, { inputMode: 'tel' })}
      {text(
        'email',
        'Contact email',
        'Shown in the footer. New-order alerts go here too if order emails are switched on.',
        { type: 'email' },
      )}
      {text('instagram', 'Instagram handle', undefined, { placeholder: '@deniks20stitches' })}
      {text('announcement', 'Announcement bar', 'Short message across the top of every page. Leave empty to hide it.', {
        maxLength: 160,
      })}
      <div>
        <label htmlFor="s-checkoutNote" className="field-label">
          Note at checkout
        </label>
        <textarea
          id="s-checkoutNote"
          name="checkoutNote"
          defaultValue={values.checkoutNote}
          rows={3}
          className="field"
          maxLength={400}
        />
        <p className="field-hint">For example, how long orders take to prepare before they ship.</p>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function PasswordForm() {
  const { state, onSubmit, pending } = useFormAction(changePassword, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="pw-current" className="field-label">
          Current password
        </label>
        <input
          id="pw-current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      <div>
        <label htmlFor="pw-next" className="field-label">
          New password
        </label>
        <input
          id="pw-next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="field"
        />
        <p className="field-hint">At least 10 characters.</p>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function AddAdminForm() {
  const { state, onSubmit, pending } = useFormAction(addAdmin, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="a-name" className="field-label">
            Name
          </label>
          <input id="a-name" name="name" className="field" />
        </div>
        <div>
          <label htmlFor="a-email" className="field-label">
            Email
          </label>
          <input id="a-email" name="email" type="email" required className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="a-password" className="field-label">
          Temporary password
        </label>
        <input
          id="a-password"
          name="password"
          type="text"
          minLength={10}
          required
          className="field"
          autoComplete="off"
        />
        <p className="field-hint">Share it privately. They can change it in Settings after signing in.</p>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? 'Adding…' : 'Add admin'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
