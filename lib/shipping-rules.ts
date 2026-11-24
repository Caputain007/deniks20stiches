// Pure delivery-fee lookup, shared by the checkout form (instant quotes) and
// the server (which recalculates the fee when the order is placed).

export type ShippingRate = { country: string; region: string; feeKobo: number; eta: string }

export const REST_OF_WORLD = 'ZZ'

/** (country, state) → (country, any state) → rest of the world. Null means "we don't deliver there". */
export function findRate(rates: ShippingRate[], country: string, region: string): ShippingRate | null {
  const exact = region ? rates.find((r) => r.country === country && r.region === region) : undefined
  return (
    exact ??
    rates.find((r) => r.country === country && r.region === '') ??
    rates.find((r) => r.country === REST_OF_WORLD && r.region === '') ??
    null
  )
}
