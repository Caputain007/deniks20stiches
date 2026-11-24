'use client'
/* eslint-disable @next/next/no-img-element -- thumbnails are already small */

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { checkCoupon, placeOrder } from '@/app/actions/checkout'
import { couponDiscount, type CouponTerms } from '@/lib/coupon-rules'
import type { Fulfillment } from '@/lib/db/schema'
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

export type PickupInfo = { address: string; note: string; mapsUrl: string | null }

export function CheckoutForm({
  rates,
  checkoutNote,
  whatsapp,
  paymentsReady,
  pickup,
}: {
  rates: ShippingRate[]
  checkoutNote: string
  whatsapp: string | null
  paymentsReady: boolean
  pickup: PickupInfo | null
}) {
  const { rows, loading, subtotalKobo, problems, bag } = useBagItems()
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<{ message: string; orderLink?: string; fromFields?: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ terms: CouponTerms; label: string } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, startCouponCheck] = useTransition()

  const isPickup = fulfillment === 'pickup' && pickup !== null
  const isNigeria = fields.country === 'NG'
  const rate =
    isPickup || (isNigeria && !fields.region) ? null : findRate(rates, fields.country, isNigeria ? fields.region : '')
  const noDelivery = !isPickup && !rate && (!isNigeria || Boolean(fields.region))
  const shippingKobo = isPickup ? 0 : (rate?.feeKobo ?? 0)
  const feeKnown = isPickup || rate !== null
  const discountKobo = coupon ? couponDiscount(coupon.terms, subtotalKobo, shippingKobo) : 0
  const total = subtotalKobo + shippingKobo - discountKobo

  const clearError = (key: string) => {
    if (!errors[key]) return
    const next = { ...errors }
    delete next[key]
    setErrors(next)
    // The banner only repeated the field errors; drop it once they're all fixed.
    if (Object.keys(next).length === 0 && formError?.fromFields) setFormError(null)
  }

  const set =
    (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setFields((f) => ({ ...f, [key]: value, ...(key === 'country' ? { region: '' } : {}) }))
      clearError(key)
    }

  function applyCoupon() {
    const code = couponInput.trim()
    if (!code) {
      setCouponError('Enter a coupon code.')
      return
    }
    setCouponError(null)
    startCouponCheck(async () => {
      const result = await checkCoupon({
        code,
        lines: bag.lines,
        fulfillment: isPickup ? 'pickup' : 'delivery',
        country: fields.country,
        region: fields.region,
        email: fields.email,
      })
      if (result.ok) {
        setCoupon({ terms: result.terms, label: result.label })
        setCouponInput('')
        clearError('couponCode')
      } else {
        setCouponError(result.error)
      }
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    startTransition(async () => {
      const result = await placeOrder({
        ...fields,
        fulfillment: isPickup ? 'pickup' : 'delivery',
        couponCode: coupon?.terms.code ?? '',
        lines: bag.lines,
      })
      if (result.ok) {
        window.location.assign(result.redirectTo)
        return
      }
      const fieldErrors = { ...(result.fieldErrors ?? {}) }
      if (fieldErrors.couponCode) {
        // The code no longer applies: take it off so the customer can pay without it.
        setCouponError(fieldErrors.couponCode)
        setCouponInput(coupon?.terms.code ?? '')
        setCoupon(null)
        delete fieldErrors.couponCode
      }
      setErrors(fieldErrors)
      setFormError({
        message: result.error,
        orderLink: result.orderLink,
        fromFields: Boolean(result.fieldErrors) && Object.keys(fieldErrors).length > 0,
      })
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

  const couponNote = (() => {
    if (!coupon) return null
    if (coupon.terms.kind === 'free_delivery') {
      if (isPickup) return 'Pickup is already free, so this code saves nothing here.'
      if (!feeKnown) return 'Choose your delivery address to see your saving.'
    }
    if (subtotalKobo < coupon.terms.minSubtotalKobo) {
      return `This code needs an order of ${formatNaira(coupon.terms.minSubtotalKobo)} or more.`
    }
    return null
  })()

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

        {pickup && (
          <fieldset>
            <legend className="font-display text-2xl">How would you like to get it?</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: 'delivery', title: 'Delivery', text: 'To your address in Nigeria or abroad.' },
                  { value: 'pickup', title: 'Pick up from our shop', text: `Free. ${pickup.address}` },
                ] as const
              ).map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="fulfillment"
                    value={option.value}
                    checked={fulfillment === option.value}
                    onChange={() => setFulfillment(option.value)}
                    className="peer sr-only"
                  />
                  <span className="block h-full border border-line bg-white px-4 py-3 peer-checked:border-plum peer-checked:stitched peer-focus-visible:border-plum">
                    <span className="block font-semibold peer-checked:text-plum">{option.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{option.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
            isPickup
              ? 'We’ll message you on this number when your order is ready to collect.'
              : 'For the courier to reach you. Include the country code if you’re outside Nigeria.',
          )}
          {field('name', 'Full name', { autoComplete: 'name', required: true })}
        </fieldset>

        {isPickup ? (
          <fieldset className="space-y-4">
            <legend className="font-display text-2xl">Pickup</legend>
            <div className="border border-dashed border-plum bg-white px-4 py-3">
              <p className="font-semibold">{pickup.address}</p>
              {pickup.note && <p className="mt-1 text-sm text-muted">{pickup.note}</p>}
              {pickup.mapsUrl && (
                <a
                  href={pickup.mapsUrl}
                  className="mt-2 inline-block text-sm font-semibold text-plum"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
            <div>
              <label htmlFor="f-note" className="field-label">
                Anything we should know? (optional)
              </label>
              <textarea
                id="f-note"
                className="field"
                value={fields.note}
                onChange={set('note')}
                maxLength={500}
                rows={3}
                placeholder="For example, who is collecting the order"
              />
            </div>
          </fieldset>
        ) : (
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
        )}
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

        <div className="mt-2 border-t border-line pt-4">
          {coupon ? (
            <div className="flex items-start justify-between gap-3 text-sm">
              <p>
                <span className="font-semibold">{coupon.terms.code}</span>{' '}
                <span className="text-muted">{coupon.label}</span>
              </p>
              <button
                type="button"
                className="font-semibold text-plum"
                onClick={() => {
                  setCoupon(null)
                  setCouponError(null)
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="f-coupon" className="field-label">
                Coupon code
              </label>
              <div className="flex gap-2">
                <input
                  id="f-coupon"
                  className="field min-h-11 uppercase placeholder:normal-case"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value)
                    setCouponError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCoupon()
                    }
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={40}
                  aria-invalid={couponError ? true : undefined}
                  aria-describedby={couponError ? 'e-coupon' : undefined}
                />
                <button
                  type="button"
                  className="btn btn-quiet min-h-11"
                  onClick={applyCoupon}
                  disabled={checkingCoupon}
                >
                  {checkingCoupon ? 'Checking…' : 'Apply'}
                </button>
              </div>
            </div>
          )}
          <p id="e-coupon" aria-live="polite" className="text-sm">
            {couponError && <span className="mt-1 block font-semibold text-rose">{couponError}</span>}
            {couponNote && <span className="mt-1 block text-amber">{couponNote}</span>}
          </p>
        </div>

        <dl className="mt-4 space-y-2 border-t border-line pt-4">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatNaira(subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{isPickup ? 'Pickup' : 'Delivery'}</dt>
            <dd>
              {isPickup
                ? 'Free'
                : rate
                  ? formatNaira(rate.feeKobo)
                  : isNigeria && !fields.region
                    ? 'Choose your state'
                    : '—'}
            </dd>
          </div>
          {!isPickup && rate?.eta && <p className="text-right text-sm text-muted">Arrives in {rate.eta}</p>}
          {discountKobo > 0 && coupon && (
            <div className="flex justify-between text-leaf">
              <dt>Coupon {coupon.terms.code}</dt>
              <dd>−{formatNaira(discountKobo)}</dd>
            </div>
          )}
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
