'use client'

import { useState, useTransition } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { createProduct, saveSizes, type ActionState, type SizesState } from '@/app/actions/admin-products'
import { FormMessage } from './action-button'

type Category = { id: number; name: string }

function CategorySelect({ categories, defaultValue }: { categories: Category[]; defaultValue?: number | null }) {
  return (
    <div>
      <label htmlFor="p-category" className="field-label">
        Category
      </label>
      <select id="p-category" name="categoryId" className="field" defaultValue={defaultValue ?? ''}>
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function PriceInput({
  name,
  label,
  defaultValue,
  hint,
  placeholder = '25000',
}: {
  name: string
  label: string
  defaultValue?: string
  hint?: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={`p-${name}`} className="field-label">
        {label}
      </label>
      <div className="flex items-stretch">
        <span className="flex items-center border border-r-0 border-line bg-mist px-3 text-muted">₦</span>
        <input
          id={`p-${name}`}
          name={name}
          inputMode="decimal"
          defaultValue={defaultValue}
          className="field"
          placeholder={placeholder}
        />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export function NewProductForm({ categories }: { categories: Category[] }) {
  const { state, onSubmit, pending } = useFormAction(createProduct)
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="p-name" className="field-label">
          Product name
        </label>
        <input id="p-name" name="name" required className="field" placeholder="e.g. Deep plum embroidered dress" />
      </div>
      <CategorySelect categories={categories} />
      <PriceInput name="price" label="Price" />
      <div className="flex items-center gap-4 pt-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create and add photos'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function ProductDetailsForm({
  action,
  categories,
  product,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  categories: Category[]
  product: {
    name: string
    slug: string
    categoryId: number | null
    price: string
    compareAt: string
    description: string
    details: string
    featured: boolean
  }
}) {
  const { state, onSubmit, pending } = useFormAction(action)
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="p-name" className="field-label">
          Product name
        </label>
        <input id="p-name" name="name" required defaultValue={product.name} className="field" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <CategorySelect categories={categories} defaultValue={product.categoryId} />
        <PriceInput name="price" label="Price" defaultValue={product.price} />
      </div>
      <PriceInput
        name="compareAt"
        label={'"Was" price (optional)'}
        defaultValue={product.compareAt}
        hint="For a sale: the old, higher price. It shows crossed out next to the price."
        placeholder=""
      />
      <div>
        <label htmlFor="p-description" className="field-label">
          Description
        </label>
        <textarea
          id="p-description"
          name="description"
          rows={5}
          defaultValue={product.description}
          className="field"
          placeholder="What makes this piece special: the cut, the fabric, how it's worn."
        />
      </div>
      <div>
        <label htmlFor="p-details" className="field-label">
          Details
        </label>
        <textarea
          id="p-details"
          name="details"
          rows={4}
          defaultValue={product.details}
          className="field"
          placeholder={'One per line, e.g.\nChiffon, fully lined\nLength: 56 inches\nHand wash cold'}
        />
        <p className="field-hint">Each line shows as its own point under the description.</p>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="featured" defaultChecked={product.featured} className="h-4 w-4 accent-plum" />
        <span>
          Show on the home page{' '}
          <span className="text-sm text-muted">
            (once 4 or more products are ticked, the home page shows only these)
          </span>
        </span>
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-plum">Web address</summary>
        <div className="mt-3">
          <label htmlFor="p-slug" className="field-label">
            Address of the product page
          </label>
          <div className="flex items-stretch">
            <span className="flex items-center border border-r-0 border-line bg-mist px-3 text-muted">/products/</span>
            <input id="p-slug" name="slug" defaultValue={product.slug} className="field" />
          </div>
          <p className="field-hint">Changing it breaks links that people have already shared.</p>
        </div>
      </details>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

type SizeRow = { key: string; id: number | null; label: string; stock: string }

const PRESETS: { label: string; sizes: string[] }[] = [
  { label: 'S–XXL', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Abaya lengths 52–60', sizes: ['52', '54', '56', '58', '60'] },
  { label: 'UK 8–18', sizes: ['8', '10', '12', '14', '16', '18'] },
  { label: 'One size', sizes: ['One size'] },
]

let nextKey = 0
const newKey = () => `new-${nextKey++}`

export function SizesEditor({
  productId,
  sizes,
}: {
  productId: number
  sizes: { id: number; label: string; stock: number }[]
}) {
  const [rows, setRows] = useState<SizeRow[]>(
    sizes.map((s) => ({ key: `id-${s.id}`, id: s.id, label: s.label, stock: String(s.stock) })),
  )
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()

  const update = (key: string, patch: Partial<SizeRow>) => {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setState(null)
  }

  const applyPreset = (labels: string[]) => {
    setRows((current) => {
      const existing = new Set(current.map((r) => r.label.toLowerCase()))
      const additions = labels
        .filter((l) => !existing.has(l.toLowerCase()))
        .map((label) => ({ key: newKey(), id: null, label, stock: '0' }))
      // Replace a lone untouched "One size" row when adding a size range.
      const base =
        current.length === 1 && current[0].label === 'One size' && current[0].stock === '0' && labels[0] !== 'One size'
          ? []
          : current
      return [...base, ...additions]
    })
    setState(null)
  }

  const save = () =>
    startTransition(async () => {
      const payload = rows.map((r) => ({
        id: r.id,
        label: r.label.trim(),
        stock: Number(r.stock === '' ? 0 : r.stock),
      }))
      if (payload.some((p) => !Number.isInteger(p.stock) || p.stock < 0)) {
        setState({ error: 'Stock must be a whole number, 0 or more.' })
        return
      }
      const result: SizesState = await saveSizes(productId, payload)
      if (result?.ok && result.sizes) {
        setRows(result.sizes.map((s) => ({ key: `id-${s.id}`, id: s.id, label: s.label, stock: String(s.stock) })))
      }
      setState(result)
    })

  const total = rows.reduce((n, r) => n + (Number(r.stock) || 0), 0)

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Add each size you sell and how many you have. Customers can’t buy more than you have in stock, and the shop
        updates the numbers after every paid order.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        <span className="self-center text-sm font-semibold">Quick add:</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet btn-sm" onClick={() => applyPreset(p.sizes)}>
            {p.label}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="mb-2 grid grid-cols-[1fr_7rem_auto] gap-3 text-sm font-semibold">
          <span>Size</span>
          <span>In stock</span>
          <span className="sr-only">Remove</span>
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-3">
            <input
              aria-label={`Size ${i + 1} name`}
              value={row.label}
              onChange={(e) => update(row.key, { label: e.target.value })}
              className="field"
              placeholder="e.g. M or 54"
              maxLength={30}
            />
            <input
              aria-label={`Size ${i + 1} stock`}
              value={row.stock}
              onChange={(e) => update(row.key, { stock: e.target.value.replace(/[^\d]/g, '') })}
              inputMode="numeric"
              className="field"
            />
            <button
              type="button"
              className="px-2 text-sm font-semibold text-rose"
              onClick={() => {
                setRows((r) => r.filter((x) => x.key !== row.key))
                setState(null)
              }}
              aria-label={`Remove size ${row.label || i + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-plum"
        onClick={() => setRows((r) => [...r, { key: newKey(), id: null, label: '', stock: '0' }])}
      >
        + Add a size
      </button>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save sizes and stock'}
        </button>
        <span className="text-sm text-muted">{total} in stock in total</span>
        <FormMessage state={state} />
      </div>
    </div>
  )
}
