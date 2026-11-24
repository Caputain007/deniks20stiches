'use client'
/* eslint-disable @next/next/no-img-element -- thumbnails are already small */

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { placeOrder } from '@/app/actions/checkout'
import { COUNTRIES, NIGERIAN_STATES, countryName } from '@/lib/geo'
import { formatNaira } from '@/lib/money'
import { findRate, type ShippingRate } from '@/lib/shipping-rules'
import { useBagItems } from './use-bag-items'

type Fields = {
  email: string
  phone: string
  name: string
  country: string
  region: string
  city: string
  address1: string
  address2: string
  postcode: string
  note: string
}

const EMPTY: Fields = {
  email: '',
  phone: '',
  name: '',
  country: 'NG',
  region: '',
  city: '',
  address1: '',
  address2: '',
  postcode: '',
  note: '',
}

export function CheckoutForm({
  rates,
  checkoutNote,
  whatsapp,
  paymentsReady,
}: {
  rates: ShippingRate[]
  checkoutNote: string
  whatsapp: string | null
  paymentsReady: boolean
}) {
  const { rows, loading, subtotalKobo, problems, bag } = useBagItems()
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<{ message: string; orderLink?: string; fromFields?: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  const isNigeria = fields.country === 'NG'
  const rate = isNigeria && !fields.region ? null : findRate(rates, fields.country, isNigeria ? fields.region : '')
  const noDelivery = !rate && (!isNigeria || Boolean(fields.region))
  const total = subtotalKobo + (rate?.feeKobo ?? 0)

  const set =
    (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setFields((f) => ({ ...f, [key]: value, ...(key === 'country' ? { region: '' } : {}) }))
      if (errors[key]) {
        const next = { ...errors }
        delete next[key]
        setErrors(next)
        // The banner only repeated the field errors; drop it once they're all fixed.
        if (Object.keys(next).length === 0 && formError?.fromFields) setFormError(null)
      }
    }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    startTransition(async () => {
      const result = await placeOrder({ ...fields, lines: bag.lines })
      if (result.ok) {
        window.location.assign(result.redirectTo)
        return
      }
      setErrors(result.fieldErrors ?? {})
      setFormError({ message: result.error, orderLink: result.orderLink, fromFields: Boolean(result.fieldErrors) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  if (loading) return <div className="mt-10 h-72 animate-pulse bg-blush" aria-label="Loading checkout" />
  if (rows.length === 0) {
    return (
      <div className="mt-10 border border-dashed border-line px-6 py-14 text-center">
        <p className="font-display text-2xl">Your bag is empty</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    )
  }

  const field = (
    key: keyof Fields,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <div>
      <label htmlFor={`f-${key}`} className="field-label">
        {label}
      </label>
      <input
        id={`f-${key}`}
        name={key}
        className="field"
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `e-${key}` : hint ? `h-${key}` : undefined}
        {...props}
      />
      {errors[key] ? (
        <p id={`e-${key}`} className="mt-1 text-sm font-semibold text-rose">
          {errors[key]}
        </p>
      ) : hint ? (
        <p id={`h-${key}`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-10">
        {formError && (
          <div role="alert" className="border border-dashed border-rose bg-white px-4 py-3 text-rose">
            <p className="font-semibold">{formError.message}</p>
            {formError.orderLink && (
              <Link href={formError.orderLink} className="mt-1 inline-block font-semibold text-plum">
                Go to your order
              </Link>
            )}
          </div>
        )}
        {!paymentsReady && (
          <p className="border border-dashed border-amber bg-white px-4 py-3 text-amber">
            Online payment isn’t switched on yet.{' '}
            {whatsapp && (
              <a href={whatsapp} className="font-semibold">
                Order on WhatsApp instead
              </a>
            )}
          </p>
        )}

        <fieldset className="space-y-4">
          <legend className="font-display text-2xl">Your details</legend>
          {field(
            'email',
            'Email',
            { type: 'email', autoComplete: 'email', inputMode: 'email', required: true },
            'We’ll send your order confirmation here.',
          )}
          {field(
            'phone',
            'Phone number',
            { type: 'tel', autoComplete: 'tel', required: true },
            'For the courier to reach you. Include the country code if you’re outside Nigeria.',
          )}
          {field('name', 'Full name', { autoComplete: 'name', required: true })}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-2xl">Delivery address</legend>
          <div>
            <label htmlFor="f-country" className="field-label">
              Country
            </label>
            <select
              id="f-country"
              className="field"
              value={fields.country}
              onChange={set('country')}
              autoComplete="country"
            >
              <option value="NG">Nigeria</option>
              {COUNTRIES.filter((c) => c.code !== 'NG').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {isNigeria ? (
            <div>
              <label htmlFor="f-region" className="field-label">
                State
              </label>
              <select
                id="f-region"
                className="field"
                value={fields.region}
                onChange={set('region')}
                aria-invalid={errors.region ? true : undefined}
                autoComplete="address-level1"
              >
                <option value="">Choose your state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.region && <p className="mt-1 text-sm font-semibold text-rose">{errors.region}</p>}
            </div>
          ) : (
            field(
              'region',
              'State, province or region',
              { autoComplete: 'address-level1' },
              'Leave blank if your country doesn’t use one.',
            )
          )}
          {field('city', 'Town or city', { autoComplete: 'address-level2', required: true })}
          {field('address1', 'Street address', { autoComplete: 'address-line1', required: true })}
          {field('address2', 'Flat, floor or estate (optional)', { autoComplete: 'address-line2' })}
          {!isNigeria && field('postcode', 'Postcode or ZIP code', { autoComplete: 'postal-code' })}
          <div>
            <label htmlFor="f-note" className="field-label">
              Landmark or delivery instructions (optional)
            </label>
            <textarea
              id="f-note"
              className="field"
              value={fields.note}
              onChange={set('note')}
              maxLength={500}
              rows={3}
            />
          </div>
        </fieldset>
      </div>

      <aside className="self-start bg-white p-6 ring-1 ring-line lg:sticky lg:top-6">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="mt-4 divide-y divide-line">
          {rows.map(({ variantId, quantity, item }) => (
            <li key={variantId} className="flex gap-3 py-3 text-sm">
              <div className="h-16 w-12 shrink-0 bg-blush">
                {item?.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item?.available ? item.name : 'No longer available'}</p>
                <p className="text-muted">
                  {item?.available ? `Size ${item.size}, qty ${quantity}` : `Qty ${quantity}`}
                </p>
              </div>
              <p>{item?.available ? formatNaira(item.priceKobo * quantity) : ''}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatNaira(subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd>{rate ? formatNaira(rate.feeKobo) : isNigeria && !fields.region ? 'Choose your state' : '—'}</dd>
          </div>
          {rate?.eta && <p className="text-right text-sm text-muted">Arrives in {rate.eta}</p>}
          <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd>{formatNaira(total)}</dd>
          </div>
        </dl>

        {noDelivery && (
          <p className="mt-4 text-sm font-semibold text-rose">
            We don’t deliver to {isNigeria ? fields.region : countryName(fields.country)} through the website yet.{' '}
            {whatsapp && (
              <a href={whatsapp} className="text-plum">
                Message us on WhatsApp
              </a>
            )}
          </p>
        )}
        {problems.length > 0 && (
          <p className="mt-4 text-sm font-semibold text-rose">
            Some items in your bag have changed.{' '}
            <Link href="/bag" className="text-plum">
              Review your bag
            </Link>
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary mt-6 w-full"
          disabled={pending || !paymentsReady || noDelivery || problems.length > 0}
        >
          {pending ? 'Opening Paystack…' : `Pay ${formatNaira(total)}`}
        </button>
        <p className="mt-3 text-sm text-muted">
          You’ll pay on Paystack by card, bank transfer or USSD, then come back here.
        </p>
        {checkoutNote && <p className="mt-3 whitespace-pre-line text-sm text-muted">{checkoutNote}</p>}
      </aside>
    </form>
  )
}
