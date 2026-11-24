'use client'

import { useSyncExternalStore } from 'react'

// The shopping bag lives in this browser (localStorage), so shoppers don't need
// an account. Prices and stock are always re-checked on the server at checkout.

export type BagLine = { variantId: number; quantity: number }

const KEY = 'ds-bag-v1'
const MAX_QTY = 20
const EMPTY: BagLine[] = []

let memory: BagLine[] = EMPTY // used when localStorage is unavailable
let snapshot: { raw: string | null; lines: BagLine[] } = { raw: null, lines: EMPTY }
const listeners = new Set<() => void>()

function parse(raw: string | null): BagLine[] {
  if (!raw) return EMPTY
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return EMPTY
    return data
      .filter((l) => Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity) && l.quantity > 0)
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(l.quantity, MAX_QTY) }))
  } catch {
    return EMPTY
  }
}

function read(): BagLine[] {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return memory
  }
  if (raw !== snapshot.raw) snapshot = { raw, lines: parse(raw) }
  return snapshot.lines
}

function write(lines: BagLine[]) {
  memory = lines
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    // Private browsing or storage full: keep the bag in memory for this visit.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function add(variantId: number, quantity: number) {
  const current = read()
  const existing = current.find((l) => l.variantId === variantId)
  write(
    existing
      ? current.map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.min(l.quantity + quantity, MAX_QTY) } : l,
        )
      : [...current, { variantId, quantity: Math.min(quantity, MAX_QTY) }],
  )
}

function setQuantity(variantId: number, quantity: number) {
  const current = read()
  write(
    quantity <= 0
      ? current.filter((l) => l.variantId !== variantId)
      : current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, MAX_QTY) } : l)),
  )
}

function remove(variantId: number) {
  write(read().filter((l) => l.variantId !== variantId))
}

function clear() {
  write(EMPTY)
}

export function useBag() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY)
  return { lines, count: lines.reduce((n, l) => n + l.quantity, 0), add, setQuantity, remove, clear }
}

export const BAG_MAX_QTY = MAX_QTY
