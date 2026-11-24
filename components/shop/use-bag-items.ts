'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getBagItems, type BagItemDetails } from '@/app/actions/checkout'
import { useBag, type BagLine } from './bag-store'

const noop = () => () => {}

/** False during the server render and hydration, true once the browser's bag can be read. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}

export type BagRow = BagLine & { item: BagItemDetails | null }

/** The bag's lines joined with live product details from the server. */
export function useBagItems() {
  const bag = useBag()
  const hydrated = useHydrated()
  const [items, setItems] = useState<BagItemDetails[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    getBagItems(bag.lines)
      .then((result) => {
        if (!cancelled) {
          setItems(result)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [bag.lines, hydrated])

  const rows: BagRow[] = bag.lines.map((line) => ({
    ...line,
    item: items?.find((i) => i.variantId === line.variantId) ?? null,
  }))
  const loading = !hydrated || (bag.lines.length > 0 && items === null && !failed)
  const subtotalKobo = rows.reduce((sum, r) => sum + (r.item?.available ? r.item.priceKobo * r.quantity : 0), 0)
  const problems = rows.filter((r) => items && (!r.item || !r.item.available || r.item.stock < r.quantity))

  return { bag, rows, loading, failed, subtotalKobo, problems }
}
