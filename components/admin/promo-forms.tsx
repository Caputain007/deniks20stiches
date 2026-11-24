'use client'
/* eslint-disable @next/next/no-img-element -- admin previews */

import { useState, useTransition } from 'react'
import { createCoupon, type ActionState } from '@/app/actions/admin-promos'
import type { BannerPlacement, CouponKind } from '@/lib/db/schema'
import { FormMessage } from './action-button'
import { decode, encode, randomName, store } from './photo-tools'

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>
type StorageMode = 'blob' | 'local' | 'none'

export type BannerValues = {
  placement: BannerPlacement
  title: string
  body: string
  linkLabel: string
  linkUrl: string
  imageUrl: string
  imageWidth: number | null
  imageHeight: number | null
  startsAt: string
  endsAt: string
  active: boolean
}

export const EMPTY_BANNER: BannerValues = {
  placement: 'bar',
  title: '',
  body: '',
  linkLabel: '',
  linkUrl: '',
  imageUrl: '',
  imageWidth: null,
  imageHeight: null,
  startsAt: '',
  endsAt: '',
  active: true,
}

/** Submits without React's form reset; `onSaved` runs after a successful save. */
function useSubmit(action: FormAction, onSaved?: (form: HTMLFormElement) => void) {
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await action(state, formData)
      setState(result)
      if (result?.ok) onSaved?.(form)
    })
  }
  return { state, pending, onSubmit }
}

function DateFields({ id, startsAt, endsAt }: { id: string; startsAt: string; endsAt: string }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className="field-label">
            Starts (optional)
          </label>
          <input id={`${id}-start`} name="startsAt" type="datetime-local" defaultValue={startsAt} className="field" />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="field-label">
            Ends (optional)
          </label>
          <input id={`${id}-end`} name="endsAt" type="datetime-local" defaultValue={endsAt} className="field" />
        </div>
      </div>
      <p className="field-hint">
        Nigerian time. Leave the start empty to begin now, and the end empty to keep it running.
      </p>
    </div>
  )
}

/* ---------- Banners ---------- */

export function BannerForm({
  id,
  action,
  initial = EMPTY_BANNER,
  mode,
  isNew = false,
}: {
  id: string
  action: FormAction
  initial?: BannerValues
  mode: StorageMode
  isNew?: boolean
}) {
  const [placement, setPlacement] = useState<BannerPlacement>(initial.placement)
  const [image, setImage] = useState(
    initial.imageUrl ? { url: initial.imageUrl, width: initial.imageWidth, height: initial.imageHeight } : null,
  )
  const [upload, setUpload] = useState<{ working: boolean; error?: string }>({ working: false })
  const { state, pending, onSubmit } = useSubmit(action, (form) => {
    if (!isNew) return
    form.reset()
    setPlacement('bar')
    setImage(null)
  })
  const hero = placement === 'hero'

  async function pickImage(file: File | undefined) {
    if (!file || mode === 'none') return
    setUpload({ working: true })
    try {
      const source = await decode(file)
      const picture = await encode(source, 2000, 0.85)
      if ('close' in source) source.close()
      const url = await store(mode, `banners/${randomName()}.${picture.ext}`, picture.blob)
      setImage({ url, width: picture.width, height: picture.height })
      setUpload({ working: false })
    } catch (error) {
      setUpload({ working: false, error: (error as Error).message || 'Upload failed. Try another picture.' })
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="field-label">Where it shows</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['bar', 'Bar across the top of every page'],
              ['hero', 'Home page banner'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="placement"
                value={value}
                checked={placement === value}
                onChange={() => setPlacement(value)}
                className="peer sr-only"
              />
              <span className="block border border-line bg-white px-3 py-2 text-sm font-semibold peer-checked:border-plum peer-checked:text-plum peer-checked:stitched peer-focus-visible:border-plum">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-title`} className="field-label">
          {hero ? 'Headline' : 'Message'}
        </label>
        <input
          id={`${id}-title`}
          name="title"
          defaultValue={initial.title}
          maxLength={hero ? 90 : 160}
          className="field"
          placeholder={hero ? 'e.g. The Eid edit is here' : 'e.g. Free delivery in Lokoja this week'}
          required
        />
      </div>

      {hero && (
        <div>
          <label htmlFor={`${id}-body`} className="field-label">
            Text under the headline (optional)
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            defaultValue={initial.body}
            rows={2}
            maxLength={300}
            className="field min-h-0"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor={`${id}-label`} className="field-label">
            {hero ? 'Button text' : 'Link text'} (optional)
          </label>
          <input
            id={`${id}-label`}
            name="linkLabel"
            defaultValue={initial.linkLabel}
            maxLength={40}
            className="field"
            placeholder={hero ? 'Shop now' : 'See more'}
          />
        </div>
        <div>
          <label htmlFor={`${id}-link`} className="field-label">
            Link (optional)
          </label>
          <input
            id={`${id}-link`}
            name="linkUrl"
            defaultValue={initial.linkUrl}
            maxLength={300}
            className="field"
            placeholder="/sale"
          />
        </div>
      </div>
      <p className="-mt-2 field-hint">
        A page on this site, like /sale or /shop/hijabs, or a full link starting with https://
      </p>

      {hero && (
        <div>
          <p className="field-label">Picture (optional)</p>
          <input type="hidden" name="imageUrl" value={image?.url ?? ''} />
          <input type="hidden" name="imageWidth" value={image?.width ?? ''} />
          <input type="hidden" name="imageHeight" value={image?.height ?? ''} />
          {image ? (
            <div className="flex flex-wrap items-end gap-4">
              <img src={image.url} alt="" className="h-32 w-48 object-cover ring-1 ring-line" />
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setImage(null)}>
                Remove picture
              </button>
            </div>
          ) : mode === 'none' ? (
            <p className="text-sm text-muted">Connect photo storage (Vercel Blob) to upload pictures.</p>
          ) : (
            <label className="btn btn-quiet btn-sm cursor-pointer">
              {upload.working ? 'Uploading…' : 'Choose a picture'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={upload.working}
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            </label>
          )}
          {upload.error && <p className="mt-1 text-sm font-semibold text-rose">{upload.error}</p>}
          <p className="field-hint">A wide photo works best. Without one, the home page keeps its usual photo.</p>
        </div>
      )}

      <DateFields id={id} startsAt={initial.startsAt} endsAt={initial.endsAt} />

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 accent-plum" />
        Show this banner
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending || upload.working}>
          {pending ? 'Saving…' : isNew ? 'Add banner' : 'Save banner'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

/* ---------- Coupons ---------- */

export function CouponForm() {
  const [kind, setKind] = useState<CouponKind>('percent')
  const { state, pending, onSubmit } = useSubmit(createCoupon, (form) => {
    form.reset()
    setKind('percent')
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="c-code" className="field-label">
          Code
        </label>
        <input
          id="c-code"
          name="code"
          className="field uppercase placeholder:normal-case"
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. EID20"
          required
        />
        <p className="field-hint">What customers type at checkout. Letters, numbers and dashes.</p>
      </div>

      <fieldset>
        <legend className="field-label">What it gives</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['percent', 'Percent off'],
              ['amount', 'Naira off'],
              ['free_delivery', 'Free delivery'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="peer sr-only"
              />
              <span className="block border border-line bg-white px-3 py-2 text-sm font-semibold peer-checked:border-plum peer-checked:text-plum peer-checked:stitched peer-focus-visible:border-plum">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'percent' && (
        <div className="max-w-[12rem]">
          <label htmlFor="c-percent" className="field-label">
            Percent off the items
          </label>
          <div className="flex">
            <input id="c-percent" name="percent" inputMode="numeric" className="field" placeholder="10" required />
            <span className="flex items-center border border-l-0 border-line bg-mist px-3 text-muted">%</span>
          </div>
        </div>
      )}
      {kind === 'amount' && (
        <div className="max-w-[14rem]">
          <label htmlFor="c-amount" className="field-label">
            Amount off the items
          </label>
          <div className="flex">
            <span className="flex items-center border border-r-0 border-line bg-mist px-3 text-muted">₦</span>
            <input id="c-amount" name="amount" inputMode="decimal" className="field" placeholder="2000" required />
          </div>
        </div>
      )}
      {kind === 'free_delivery' && (
        <p className="text-sm text-muted">
          Takes the delivery fee off. It doesn’t apply to pickup, which is already free.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="c-min" className="field-label">
            Minimum order (optional)
          </label>
          <div className="flex">
            <span className="flex items-center border border-r-0 border-line bg-mist px-3 text-muted">₦</span>
            <input id="c-min" name="minSubtotal" inputMode="decimal" className="field" />
          </div>
          <p className="field-hint">Before delivery.</p>
        </div>
        <div>
          <label htmlFor="c-max" className="field-label">
            How many times it can be used (optional)
          </label>
          <input id="c-max" name="maxUses" inputMode="numeric" className="field" placeholder="No limit" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="oncePerCustomer" className="h-4 w-4 accent-plum" />
        Once per customer (by email address)
      </label>

      <DateFields id="c" startsAt="" endsAt="" />

      <div>
        <label htmlFor="c-note" className="field-label">
          Private note (optional)
        </label>
        <input
          id="c-note"
          name="note"
          maxLength={200}
          className="field"
          placeholder="e.g. For our Instagram followers"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create coupon'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
