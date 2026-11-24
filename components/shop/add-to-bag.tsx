'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import type { CatalogSize } from '@/lib/catalog'
import { BAG_MAX_QTY, useBag } from './bag-store'

export function AddToBag({ sizes, productName }: { sizes: CatalogSize[]; productName: string }) {
  const bag = useBag()
  const groupId = useId()
  const available = sizes.filter((s) => s.stock > 0)
  const [selectedId, setSelectedId] = useState<number | null>(available.length === 1 ? available[0].id : null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = sizes.find((s) => s.id === selectedId) ?? null
  const inBag = selected ? (bag.lines.find((l) => l.variantId === selected.id)?.quantity ?? 0) : 0
  const canAdd = selected ? Math.min(selected.stock, BAG_MAX_QTY) - inBag : 0

  if (available.length === 0) {
    return <p className="mt-8 border border-line bg-white px-4 py-3 font-semibold">Sold out in every size</p>
  }

  function add() {
    setAdded(null)
    if (!selected) {
      setError('Choose a size first.')
      return
    }
    if (canAdd <= 0) {
      setError('You already have every piece we have in this size in your bag.')
      return
    }
    const qty = Math.min(quantity, canAdd)
    bag.add(selected.id, qty)
    setError(null)
    setQuantity(1)
    setAdded(`${productName}, size ${selected.label}${qty > 1 ? ` × ${qty}` : ''}`)
  }

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="mb-3 text-sm font-bold">
          Size{selected ? <span className="font-normal text-muted">: {selected.label}</span> : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const soldOut = size.stock <= 0
            return (
              <label key={size.id} className={soldOut ? 'cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="radio"
                  name={groupId}
                  value={size.id}
                  checked={selectedId === size.id}
                  disabled={soldOut}
                  onChange={() => {
                    setSelectedId(size.id)
                    setError(null)
                    setAdded(null)
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-12 min-w-14 items-center justify-center border border-line bg-white px-4 text-[0.95rem] font-semibold peer-checked:border-plum peer-checked:text-plum peer-checked:stitched peer-focus-visible:border-plum peer-disabled:bg-transparent peer-disabled:font-normal peer-disabled:text-muted peer-disabled:line-through">
                  {size.label}
                  {soldOut && <span className="sr-only"> (sold out)</span>}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {selected && selected.stock <= 3 && (
        <p className="mt-3 text-sm font-semibold text-rose">Only {selected.stock} left in this size.</p>
      )}

      <div className="mt-6 flex gap-3">
        <label className="sr-only" htmlFor={`${groupId}-qty`}>
          Quantity
        </label>
        <select
          id={`${groupId}-qty`}
          className="field w-24"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        >
          {Array.from({ length: Math.max(1, Math.min(selected ? canAdd : 10, 10)) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="btn btn-primary flex-1">
          Add to bag
        </button>
      </div>

      <div aria-live="polite" className="min-h-6">
        {error && <p className="mt-3 text-sm font-semibold text-rose">{error}</p>}
        {added && (
          <div className="mt-4 border border-dashed border-plum bg-white px-4 py-3">
            <p className="text-sm">
              Added to your bag: <strong>{added}</strong>
            </p>
            <div className="mt-2 flex gap-5 text-sm font-semibold">
              <Link href="/bag" className="text-plum">
                View bag
              </Link>
              <Link href="/checkout" className="text-plum">
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
