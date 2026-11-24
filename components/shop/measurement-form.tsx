'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { submitMeasurements } from '@/app/actions/measurements'
import type { MeasurementPurpose } from '@/lib/db/schema'
import {
  checkMeasure,
  formatMeasure,
  fromInches,
  MEASUREMENTS,
  parseMeasure,
  REQUIRED_MEASUREMENTS,
  roundForUnit,
  toInches,
  UNIT_LABELS,
  type MeasurementKey,
  type Unit,
} from '@/lib/measurements'
import { MeasureFigure } from './measure-figure'
import { UnitToggle } from './unit-toggle'

const PURPOSES: { value: MeasurementPurpose; title: string; text: string }[] = [
  { value: 'bespoke', title: 'A bespoke outfit', text: 'Something made for you from scratch.' },
  { value: 'alteration', title: 'Adjusting a piece I bought', text: 'A ready-to-wear piece that needs to fit better.' },
  { value: 'keep', title: 'Keep them on file', text: 'For future orders, so we know your size.' },
]

type Details = {
  name: string
  phone: string
  email: string
  purpose: MeasurementPurpose | ''
  orderNumber: string
  notes: string
  website: string
}

function withoutKey(errors: Record<string, string>, key: string) {
  const next = { ...errors }
  delete next[key]
  return next
}

const EMPTY_VALUES = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, ''])) as Record<MeasurementKey, string>
const DETAILS_STEP = MEASUREMENTS.length
const STEPS = MEASUREMENTS.length + 1

export function MeasurementForm() {
  const [unit, setUnit] = useState<Unit>('in')
  const [values, setValues] = useState(EMPTY_VALUES)
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [details, setDetails] = useState<Details>({
    name: '',
    phone: '',
    email: '',
    purpose: '',
    orderNumber: '',
    notes: '',
    website: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<{ reference: string; whatsappUrl: string | null; name: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  const def = step < DETAILS_STEP ? MEASUREMENTS[step] : null
  const numbers: Partial<Record<MeasurementKey, number>> = {}
  for (const m of MEASUREMENTS) {
    const n = parseMeasure(values[m.key])
    if (n !== null) numbers[m.key] = n
  }

  // Move to the new step (not on first load, so the page doesn't jump). On wide
  // screens the figure sits beside the field, so the field gets focus. On phones,
  // focusing the field would scroll the figure away (and open the keyboard), so
  // the step's heading gets focus and the progress bar scrolls to the top.
  useEffect(() => {
    if (!moved.current) return
    if (step < DETAILS_STEP && window.matchMedia('(min-width: 768px)').matches) {
      input.current?.focus()
      return
    }
    heading.current?.focus({ preventScroll: true })
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [step])

  const go = (next: number) => {
    moved.current = true
    setStepError(null)
    setStep(next)
  }

  function next() {
    if (def) {
      const raw = values[def.key].trim()
      if (!raw) {
        if (REQUIRED_MEASUREMENTS.includes(def.key)) {
          setStepError(`Enter your ${def.label.toLowerCase()}. We can’t start without it.`)
          return
        }
      } else {
        const n = parseMeasure(raw)
        if (n === null) {
          setStepError(`Enter a number, like ${unit === 'in' ? '36 or 36.5' : '92'}.`)
          return
        }
        const problem = checkMeasure(def, n, unit)
        if (problem) {
          setStepError(problem)
          return
        }
      }
    }
    go(step + 1)
  }

  function changeUnit(nextUnit: Unit) {
    setValues((v) => {
      const out = { ...v }
      for (const m of MEASUREMENTS) {
        const n = parseMeasure(v[m.key])
        if (n !== null) out[m.key] = String(roundForUnit(fromInches(toInches(n, unit), nextUnit), nextUnit))
      }
      return out
    })
    setUnit(nextUnit)
    setStepError(null)
  }

  const setDetail = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setDetails((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((all) => withoutKey(all, key))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (step !== DETAILS_STEP) {
      next()
      return
    }
    const found: Record<string, string> = {}
    if (!details.purpose) found.purpose = 'Choose what the measurements are for.'
    if (details.name.trim().length < 2) found.name = 'Enter your name.'
    if (!/^\+?[\d\s()-]{7,20}$/.test(details.phone.trim()))
      found.phone = 'Enter a WhatsApp number we can reach, e.g. 0803 123 4567.'
    if (details.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()))
      found.email = 'Enter a valid email address, or leave it empty.'
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    startTransition(async () => {
      const response = await submitMeasurements({ ...details, unit, values: numbers })
      if (response.ok) {
        setResult({ reference: response.reference, whatsappUrl: response.whatsappUrl, name: details.name.trim() })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      setErrors(response.fieldErrors ?? {})
      setFormError(response.error)
    })
  }

  if (result) {
    return (
      <div role="status" className="mt-10 max-w-xl border border-dashed border-plum bg-white px-6 py-8">
        <h2 className="text-3xl">Thank you, {result.name.split(' ')[0]}</h2>
        <p className="mt-3">
          We’ve received your measurements. Your reference is <strong>{result.reference}</strong>.
        </p>
        <p className="mt-2 text-ink/85">
          We’ll message you on WhatsApp to talk through the style, fabric and price. If you have photos of the style you
          want, send them with your reference.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {result.whatsappUrl && (
            <a href={result.whatsappUrl} className="btn btn-primary">
              Send photos on WhatsApp
            </a>
          )}
          <Link href="/shop" className="btn btn-secondary">
            Back to the shop
          </Link>
        </div>
      </div>
    )
  }

  const optional = def && !REQUIRED_MEASUREMENTS.includes(def.key)
  const empty = def ? values[def.key].trim() === '' : false

  return (
    <form onSubmit={submit} noValidate className="mt-8">
      <div ref={top} className="flex scroll-mt-4 flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted" aria-live="polite">
          Step {step + 1} of {STEPS}
        </p>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>
      <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
        {Array.from({ length: STEPS }, (_, i) => (
          <li
            key={i}
            aria-hidden="true"
            className={`h-1 ${
              i < step
                ? 'bg-plum'
                : i === step
                  ? 'bg-[repeating-linear-gradient(90deg,var(--color-plum)_0_5px,transparent_5px_9px)]'
                  : 'bg-line'
            }`}
          />
        ))}
      </ol>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-12 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div className={`md:sticky md:top-6 md:self-start ${def ? '' : 'hidden md:block'}`}>
          <MeasureFigure
            active={def?.key ?? null}
            values={numbers}
            unit={unit}
            className="mx-auto h-[34vh] w-auto max-w-full md:h-auto md:w-full"
          />
        </div>

        {def ? (
          <div>
            <h2 ref={heading} tabIndex={-1} className="text-3xl outline-none sm:text-4xl">
              {def.label}
            </h2>
            <p className="mt-3 max-w-[52ch] text-ink/85">{def.how}</p>
            <label htmlFor="m-value" className="field-label mt-6">
              Your {def.label.toLowerCase()} in {UNIT_LABELS[unit]}
              {optional && <span className="font-normal text-muted"> (optional)</span>}
            </label>
            <div className="flex max-w-[14rem]">
              <input
                ref={input}
                id="m-value"
                inputMode="decimal"
                autoComplete="off"
                className="field text-lg"
                value={values[def.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [def.key]: e.target.value }))
                  setStepError(null)
                }}
                aria-invalid={stepError ? true : undefined}
                aria-describedby={stepError ? 'm-error' : optional ? 'm-hint' : undefined}
              />
              <span className="flex items-center border border-l-0 border-line bg-mist px-3 text-muted">{unit}</span>
            </div>
            {stepError ? (
              <p id="m-error" className="mt-2 text-sm font-semibold text-rose">
                {stepError}
              </p>
            ) : (
              optional && (
                <p id="m-hint" className="field-hint">
                  Not sure? Leave it empty and we’ll ask you.
                </p>
              )
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {step > 0 && (
                <button type="button" className="btn btn-quiet" onClick={() => go(step - 1)}>
                  Back
                </button>
              )}
              <button type="submit" className="btn btn-primary min-w-32">
                {optional && empty ? 'Skip' : 'Next'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 ref={heading} tabIndex={-1} className="text-3xl outline-none sm:text-4xl">
              Your details
            </h2>
            {formError && (
              <p role="alert" className="border border-dashed border-rose bg-white px-4 py-3 font-semibold text-rose">
                {formError}
              </p>
            )}

            <fieldset>
              <legend className="field-label">What are the measurements for?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PURPOSES.map((p) => (
                  <label key={p.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="purpose"
                      value={p.value}
                      checked={details.purpose === p.value}
                      onChange={() => {
                        setDetails((d) => ({ ...d, purpose: p.value }))
                        if (errors.purpose) setErrors((all) => withoutKey(all, 'purpose'))
                      }}
                      className="peer sr-only"
                    />
                    <span className="block h-full border border-line bg-white px-3 py-2.5 peer-checked:border-plum peer-checked:stitched peer-focus-visible:border-plum">
                      <span className="block text-[0.95rem] font-semibold">{p.title}</span>
                      <span className="block text-sm text-muted">{p.text}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.purpose && <p className="mt-1 text-sm font-semibold text-rose">{errors.purpose}</p>}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="name"
                label="Your name"
                value={details.name}
                onChange={setDetail('name')}
                error={errors.name}
                autoComplete="name"
              />
              <TextField
                id="phone"
                label="WhatsApp number"
                value={details.phone}
                onChange={setDetail('phone')}
                error={errors.phone}
                type="tel"
                autoComplete="tel"
              />
              <TextField
                id="email"
                label="Email (optional)"
                value={details.email}
                onChange={setDetail('email')}
                error={errors.email}
                type="email"
                autoComplete="email"
              />
              {details.purpose === 'alteration' && (
                <TextField
                  id="orderNumber"
                  label="Order number (optional)"
                  value={details.orderNumber}
                  onChange={setDetail('orderNumber')}
                  error={errors.orderNumber}
                  placeholder="DS-…"
                />
              )}
            </div>
            <div>
              <label htmlFor="m-notes" className="field-label">
                {details.purpose === 'alteration'
                  ? 'What needs changing?'
                  : details.purpose === 'bespoke'
                    ? 'What would you like made? (optional)'
                    : 'Anything else we should know? (optional)'}
              </label>
              <textarea
                id="m-notes"
                className="field"
                rows={4}
                maxLength={1000}
                value={details.notes}
                onChange={setDetail('notes')}
                placeholder="Style, fabric, occasion, and the date you need it by"
              />
            </div>
            <div aria-hidden="true" className="hidden">
              <label>
                Leave this empty
                <input tabIndex={-1} autoComplete="off" value={details.website} onChange={setDetail('website')} />
              </label>
            </div>

            <section aria-labelledby="review-title" className="bg-white p-5 ring-1 ring-line">
              <h3 id="review-title" className="font-sans text-base font-bold">
                Your measurements
              </h3>
              <dl className="mt-3 divide-y divide-line">
                {MEASUREMENTS.map((m, i) => (
                  <div key={m.key} className="flex items-center justify-between gap-3 py-2 text-[0.95rem]">
                    <dt>{m.label}</dt>
                    <dd className="flex items-center gap-4">
                      <span className={numbers[m.key] ? 'font-semibold tabular-nums' : 'text-muted'}>
                        {numbers[m.key] ? formatMeasure(numbers[m.key]!, unit) : 'Not given'}
                      </span>
                      <button type="button" className="text-sm font-semibold text-plum" onClick={() => go(i)}>
                        Change<span className="sr-only"> {m.label.toLowerCase()}</span>
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-quiet" onClick={() => go(step - 1)}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? 'Sending…' : 'Send measurements'}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

function TextField({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={`m-${id}`} className="field-label">
        {label}
      </label>
      <input
        id={`m-${id}`}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `m-${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`m-${id}-error`} className="mt-1 text-sm font-semibold text-rose">
          {error}
        </p>
      )}
    </div>
  )
}
