'use client'
/* eslint-disable @next/next/no-img-element -- thumbnails are already small */

import Link from 'next/link'
import { formatNaira } from '@/lib/money'
import { BAG_MAX_QTY } from './bag-store'
import { useBagItems } from './use-bag-items'

export function BagView() {
  const { bag, rows, loading, failed, subtotalKobo, problems } = useBagItems()

  if (loading) {
    return <div className="mt-10 h-40 animate-pulse bg-blush" aria-label="Loading your bag" />
  }
  if (rows.length === 0) {
    return (
      <div className="mt-10 border border-dashed border-line px-6 py-14 text-center">
        <p className="font-display text-2xl">Your bag is empty</p>
        <p className="mt-2 text-muted">Pick a size on any piece and add it here.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-line border-y border-line">
        {rows.map(({ variantId, quantity, item }) => {
          const maxQty = item ? Math.min(Math.max(item.stock, quantity), BAG_MAX_QTY) : quantity
          return (
            <li key={variantId} className="flex gap-4 py-5">
              <div className="h-32 w-24 shrink-0 bg-blush">
                {item?.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                {item ? (
                  <>
                    <Link href={`/products/${item.slug}`} className="font-semibold no-underline hover:text-plum">
                      {item.name}
                    </Link>
                    <p className="text-sm text-muted">Size {item.size}</p>
                    <p className="mt-1 text-sm">{formatNaira(item.priceKobo)}</p>
                    {!item.available && <p className="mt-1 text-sm font-semibold text-rose">No longer available</p>}
                    {item.available && item.stock === 0 && (
                      <p className="mt-1 text-sm font-semibold text-rose">Sold out</p>
                    )}
                    {item.available && item.stock > 0 && item.stock < quantity && (
                      <p className="mt-1 text-sm font-semibold text-rose">
                        Only {item.stock} left. Lower the quantity to continue.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-rose">This item is no longer available</p>
                )}
                <div className="mt-auto flex items-center gap-4 pt-3">
                  <label className="sr-only" htmlFor={`qty-${variantId}`}>
                    Quantity
                  </label>
                  <select
                    id={`qty-${variantId}`}
                    className="field w-20 py-1"
                    value={quantity}
                    onChange={(e) => bag.setQuantity(variantId, Number(e.target.value))}
                  >
                    {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm font-semibold text-plum hover:underline"
                    onClick={() => bag.remove(variantId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="shrink-0 font-semibold">{item?.available ? formatNaira(item.priceKobo * quantity) : ''}</p>
            </li>
          )
        })}
      </ul>

      <aside className="self-start bg-white p-6 ring-1 ring-line">
        <div className="flex justify-between text-lg">
          <span>Subtotal</span>
          <span className="font-semibold">{formatNaira(subtotalKobo)}</span>
        </div>
        <p className="mt-2 text-sm text-muted">Delivery is added at checkout once you enter your address.</p>
        {failed && (
          <p className="mt-4 text-sm font-semibold text-rose">We couldn’t load the latest prices. Refresh the page.</p>
        )}
        {problems.length > 0 ? (
          <p className="mt-6 border border-dashed border-rose px-3 py-2 text-sm text-rose">
            Fix the items marked above to continue.
          </p>
        ) : (
          <Link href="/checkout" className="btn btn-primary mt-6 w-full">
            Checkout
          </Link>
        )}
        <Link href="/shop" className="mt-4 block text-center text-sm font-semibold text-plum">
          Continue shopping
        </Link>
      </aside>
    </div>
  )
}
